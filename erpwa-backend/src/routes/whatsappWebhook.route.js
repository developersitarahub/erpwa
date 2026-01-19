import express from "express";
import prisma from "../prisma.js";
import { getIO } from "../socket.js";
import { uploadToS3 } from "../services/media.service.js";
import { downloadWhatsappMedia } from "../services/whatsappMedia.service.js";
import { decrypt } from "../utils/encryption.js";

const router = express.Router();

/* ===============================
   WEBHOOK VERIFICATION (META)
=============================== */
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

/* ===============================
   WEBHOOK EVENT HANDLER
=============================== */
router.post("/", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value) return res.sendStatus(200);

    /* ===============================
       Resolve Vendor by phone_number_id
    =============================== */
    const phoneNumberId = value.metadata?.phone_number_id;
    if (!phoneNumberId) return res.sendStatus(200);

    const vendor = await prisma.vendor.findFirst({
      where: { whatsappPhoneNumberId: phoneNumberId },
    });

    if (!vendor) return res.sendStatus(200);

    /* =====================================================
       1️⃣ HANDLE INBOUND CUSTOMER MESSAGES
    ===================================================== */
    if (value.messages?.length) {
      for (const msg of value.messages) {
        // ✅ WhatsApp message timestamp (seconds → ms)
        const inboundAt = new Date(Number(msg.timestamp) * 1000);

        // ✅ 24 hour window from LAST inbound message
        const sessionExpiresAt = new Date(
          inboundAt.getTime() + 24 * 60 * 60 * 1000
        );

        const whatsappMessageId = msg.id;
        const from = msg.from;

        // 🔹 Deduplication
        const exists = await prisma.message.findFirst({
          where: { whatsappMessageId },
        });
        if (exists) continue;

        // 🔹 Find or create lead
        const lead = await prisma.lead.upsert({
          where: {
            vendorId_phoneNumber: {
              vendorId: vendor.id,
              phoneNumber: from,
            },
          },
          update: { lastContactedAt: inboundAt },
          create: {
            vendorId: vendor.id,
            phoneNumber: from,
            whatsappOptIn: true,
            optInSource: "inbound",
            optInAt: inboundAt,
          },
        });

        // 🔹 Find or create conversation
        const conversation = await prisma.conversation.upsert({
          where: {
            vendorId_leadId: {
              vendorId: vendor.id,
              leadId: lead.id,
            },
          },
          update: {
            lastMessageAt: inboundAt,
            isOpen: true,

            // 🔥 THIS IS THE FIX
            sessionStartedAt: inboundAt,
            sessionExpiresAt,
          },
          create: {
            vendorId: vendor.id,
            leadId: lead.id,
            channel: "whatsapp",
            isOpen: true,

            // 🔥 SOURCE OF TRUTH
            sessionStartedAt: inboundAt,
            sessionExpiresAt,
            lastMessageAt: inboundAt,
          },
        });

        // 🔹 Extract message text
        let content = "";
        if (msg.type === "text") {
          content = msg.text.body;
        } else if (msg.type === "button") {
          content = msg.button.text;
        } else {
          content = `[${msg.type} message]`;
        }

        const replyToWhatsappMessageId = msg.context?.id ?? null;

        // 🔹 Store inbound message
        const inboundMessage = await prisma.message.create({
          data: {
            vendorId: vendor.id,
            conversationId: conversation.id,
            direction: "inbound",
            channel: "whatsapp",
            messageType: msg.type,
            content,
            whatsappMessageId,
            replyToMessageId: replyToWhatsappMessageId,
            status: "received",
            inboundPayload: msg,
          },
        });

        if (
          ["image", "video", "audio", "document", "sticker"].includes(msg.type)
        ) {
          try {
            const accessToken = decrypt(vendor.whatsappAccessToken);

            const mediaId = msg[msg.type].id;
            const caption = msg[msg.type].caption || null;

            const { buffer, mimeType, fileName } = await downloadWhatsappMedia(
              mediaId,
              accessToken
            );

            const extension =
              fileName?.split(".").pop() ||
              (mimeType === "application/pdf"
                ? "pdf"
                : mimeType.split("/")[1] || "bin");

            const mediaUrl = await uploadToS3({
              buffer,
              mimeType,
              vendorId: vendor.id,
              conversationId: conversation.id,
              extension,
            });

            await prisma.messageMedia.create({
              data: {
                messageId: inboundMessage.id,
                mediaType: msg.type,
                mimeType,
                mediaUrl,
                caption,
                fileName,
              },
            });
          } catch (err) {
            console.error("Inbound media processing failed:", err);
            // ❗ NEVER throw from webhook
          }
        }

        /* 🔥 EMIT INBOX UPDATE */
        try {
          const io = getIO();
          io.to(`vendor:${vendor.id}`).emit("inbox:update", {
            conversationId: conversation.id,
          });
        } catch {}

        /* 🔥 SAFE SOCKET EMIT (OPTIONAL) */
        try {
          const io = getIO();
          const fullMessage = await prisma.message.findUnique({
            where: { id: inboundMessage.id },
            include: { media: true },
          });

          io.to(`conversation:${conversation.id}`).emit("message:new", {
            id: fullMessage.id,
            whatsappMessageId: fullMessage.whatsappMessageId,
            sender: "customer",
            timestamp: fullMessage.createdAt.toISOString(),
            replyToMessageId: fullMessage.replyToMessageId,

            text: fullMessage.media.length ? undefined : fullMessage.content,

            mediaUrl: fullMessage.media[0]?.mediaUrl,
            mimeType: fullMessage.media[0]?.mimeType,
            caption: fullMessage.media[0]?.caption,
          });
        } catch {
          // socket not ready – ignore (webhook must never fail)
        }
      }
    }

    /* =====================================================
       2️⃣ HANDLE MESSAGE STATUS UPDATES
    ===================================================== */
    if (value.statuses?.length) {
      for (const waStatus of value.statuses) {
        const whatsappMessageId = waStatus.id;
        const waState = waStatus.status; // sent | delivered | read | failed

        // 🛑 Ignore statuses we don't care about
        if (!["delivered", "read", "failed"].includes(waState)) continue;

        // 🔒 Only update messages that are already SENT or DELIVERED
        const updated = await prisma.message.updateMany({
          where: {
            whatsappMessageId,
            status: { in: ["sent", "delivered"] },
          },
          data: {
            status:
              waState === "read"
                ? "read"
                : waState === "delivered"
                ? "delivered"
                : "failed",
            errorCode: waStatus.errors?.[0]?.code?.toString() || null,
          },
        });

        if (!updated.count) continue;

        const message = await prisma.message.findFirst({
          where: { whatsappMessageId },
          select: { conversationId: true },
        });

        if (!message) continue;

        // ✅ Keep inbox ordering correct
        await prisma.conversation.update({
          where: { id: message.conversationId },
          data: { lastMessageAt: new Date() },
        });

        // 🔥 Realtime status update to UI
        try {
          const io = getIO();
          io.to(`conversation:${message.conversationId}`).emit(
            "message:status",
            {
              whatsappMessageId,
              status: waState,
            }
          );
        } catch {}
      }
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("WhatsApp webhook error:", err);
    return res.sendStatus(200); // 👈 NEVER fail webhook
  }
});

export default router;
