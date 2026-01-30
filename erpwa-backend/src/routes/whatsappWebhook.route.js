import express from "express";
import prisma from "../prisma.js";
import { getIO } from "../socket.js";
import { uploadToS3 } from "../services/media.service.js";
import { downloadWhatsappMedia } from "../services/whatsappMedia.service.js";
import { decrypt } from "../utils/encryption.js";
import {
  checkAndStartWorkflow,
  handleWorkflowResponse,
} from "../services/workflowEngine.service.js";

const router = express.Router();

/* ===============================
   HELPER: Log activity (MOVED TO SERVICE)
=============================== */
import { logActivity } from "../services/activityLog.service.js";


/* ===============================
   WEBHOOK VERIFICATION (META)
=============================== */
router.get("/", async (req, res) => {
  const startTime = Date.now();
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    await logActivity({
      vendorId: null,
      eventType: "verification", // Maps to event
      event: "verification",
      status: "success",
      payload: { mode, challenge: "***" },
      responseCode: 200,
      processingMs: Date.now() - startTime,
      type: "webhook",
    });
    return res.status(200).send(challenge);
  }

  await logActivity({
    vendorId: null,
    event: "verification",
    status: "error",
    payload: { mode, token: token ? "***" : null },
    responseCode: 403,
    error: "Invalid verification token",
    processingMs: Date.now() - startTime,
    type: "webhook",
  });

  return res.sendStatus(403);
});

/* ===============================
   WEBHOOK EVENT HANDLER
=============================== */
router.post("/", async (req, res) => {
  const startTime = Date.now();
  let vendorId = null;
  let eventType = "unknown";
  let direction = null;
  let phoneNumber = null;
  let messageId = null;
  let logStatus = "success";
  let errorMessage = null;

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value) {
      logStatus = "ignored";
      await logActivity({
        vendorId,
        whatsappBusinessId: null, // Can't resolve from empty payload
        whatsappPhoneNumberId: null,
        event: "empty",
        status: logStatus,
        payload: req.body,
        responseCode: 200,
        error: "No value in payload",
        processingMs: Date.now() - startTime,
        type: "webhook",
      });
      return res.sendStatus(200);
    }

    /* ===============================
       Resolve Vendor
    =============================== */
    const phoneNumberId = value.metadata?.phone_number_id;
    const wabaId = entry?.id; // WABA ID from the entry object

    let vendor = null;

    if (phoneNumberId) {
      vendor = await prisma.vendor.findFirst({
        where: { whatsappPhoneNumberId: phoneNumberId },
      });
    }

    // Fallback: Try finding by WABA ID (useful for template updates which lack phone_number_id)
    if (!vendor && wabaId) {
      vendor = await prisma.vendor.findFirst({
        where: { whatsappBusinessId: wabaId },
      });
    }

    if (!vendor) {
      logStatus = "ignored";
      await logActivity({
        vendorId: null, // Can't resolve vendor
        whatsappBusinessId: wabaId,
        whatsappPhoneNumberId: phoneNumberId,
        event: "unknown",
        status: logStatus,
        payload: req.body,
        responseCode: 200,
        error: `No vendor found. PhoneID: ${phoneNumberId}, WABA ID: ${wabaId}`,
        processingMs: Date.now() - startTime,
        type: "webhook",
      });
      return res.sendStatus(200);
    }

    vendorId = vendor.id;

    /* =====================================================
       1️⃣ HANDLE INBOUND CUSTOMER MESSAGES
    ===================================================== */
    if (value.messages?.length) {
      eventType = "message";
      direction = "inbound";
      console.log("📨 INBOUND MESSAGE received, count:", value.messages.length);

      for (const msg of value.messages) {
        phoneNumber = msg.from;
        messageId = msg.id;
        console.log(
          "📨 Processing message from:",
          phoneNumber,
          "type:",
          msg.type,
        );

        // ✅ WhatsApp message timestamp (seconds → ms)
        const inboundAt = new Date(Number(msg.timestamp) * 1000);

        // ✅ 24 hour window from LAST inbound message
        const sessionExpiresAt = new Date(
          inboundAt.getTime() + 24 * 60 * 60 * 1000,
        );

        const whatsappMessageId = msg.id;
        const from = msg.from;

        // 🔹 Deduplication
        const exists = await prisma.message.findFirst({
          where: { whatsappMessageId },
        });
        if (exists) {
          // Log ignored duplicate
          await logActivity({
            vendorId,
            status: "ignored",
            event: "receive_duplicate",
            payload: msg,
            messageId: msg.id,
            phoneNumber: msg.from,
            direction: "inbound",
            processingMs: Date.now() - startTime,
            error: "Duplicate message",
            responseCode: 200,
            type: msg.type,
          });
          continue;
        }

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
        } else if (msg.type === "interactive") {
          // Handle replies to List Messages or Button Messages
          const interactive = msg.interactive;
          if (interactive.type === "list_reply") {
            content = interactive.list_reply.title;
          } else if (interactive.type === "button_reply") {
            content = interactive.button_reply.title;
            // Also store ID if needed, but 'content' helps with workflow matching
          } else {
            content = "[interactive]";
          }
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

        // Handle Media download logic
        if (
          ["image", "video", "audio", "document", "sticker"].includes(msg.type)
        ) {
          try {
            const accessToken = decrypt(vendor.whatsappAccessToken);

            const mediaId = msg[msg.type].id;
            const caption = msg[msg.type].caption || null;

            const { buffer, mimeType, fileName } = await downloadWhatsappMedia(
              mediaId,
              accessToken,
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
        } catch { }

        /* 🔥 SAFE SOCKET EMIT (OPTIONAL) */
        try {
          const io = getIO();
          const fullMessage = await prisma.message.findUnique({
            where: { id: inboundMessage.id },
            include: { media: true },
          });

          console.log(
            "📤 Emitting message:new to conversation:",
            conversation.id,
          );
          console.log("📤 Message data:", {
            id: fullMessage.id,
            sender: "customer",
            text: fullMessage.media.length ? undefined : fullMessage.content,
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
        } catch (socketErr) { }

        // ============================================
        // 🚀 WORKFLOW ENGINE INTEGRATION
        // ============================================
        try {
          // 1. Check if user is already in a workflow session
          const isSessionHandled = await handleWorkflowResponse(
            vendor.id,
            conversation.id,
            inboundMessage,
          );

          if (!isSessionHandled) {
            // 2. If not, check if message triggers a NEW workflow
            // Content variable is already extracted above
            await checkAndStartWorkflow(vendor.id, conversation.id, content);
          }
        } catch (wfError) {
          console.error("Workflow Error:", wfError);
        }

        // Log successful message processing
        await logActivity({
          vendorId,
          conversationId: conversation.id,
          messageId: inboundMessage.id,
          phoneNumber,
          status: "received", // Consistent with ActivityLog
          event: "Received", // Operation
          category: lead.categoryId ? String(lead.categoryId) : null,
          payload: msg,
          direction: "inbound",
          responseCode: 200,
          processingMs: Date.now() - startTime,
          type: msg.type,
          whatsappBusinessId: wabaId,
          whatsappPhoneNumberId: phoneNumberId || vendor.whatsappPhoneNumberId,
        });
      }
    }

    /* =====================================================
       2️⃣ HANDLE MESSAGE STATUS UPDATES
    ===================================================== */
    /* =====================================================
       2️⃣ HANDLE MESSAGE STATUS UPDATES
    ===================================================== */
    if (value.statuses?.length) {
      eventType = "status";
      direction = "outbound_status";

      for (const waStatus of value.statuses) {
        const whatsappMessageId = waStatus.id;
        const waState = waStatus.status; // sent | delivered | read | failed
        phoneNumber = waStatus.recipient_id;
        messageId = whatsappMessageId; // Always use WAMID

        // Log "sent" status
        if (waState === "sent") {
          await logActivity({
            vendorId,
            status: "sent",
            event: "Sent", // Operation name
            payload: waStatus,
            messageId: whatsappMessageId, // WAMID
            phoneNumber,
            direction: "outbound_status",
            processingMs: Date.now() - startTime,
            responseCode: 200,
            whatsappBusinessId: wabaId,
            whatsappPhoneNumberId: phoneNumberId || vendor.whatsappPhoneNumberId,
          });
          continue;
        }

        // 🛑 Ignore statuses we don't care about (anything other than sent, delivered, read, failed)
        if (!["delivered", "read", "failed"].includes(waState)) {
          continue; // Ignore
        }

        // 🔒 Only update messages that are already SENT or DELIVERED
        const messageToUpdate = await prisma.message.findFirst({
          where: { whatsappMessageId },
          select: { id: true, conversationId: true, messageType: true },
        });

        if (!messageToUpdate) {
          // Even if we don't find it in DB, we log the status update for visibility, using WAMID
          await logActivity({
            vendorId,
            status: waState === "failed" ? "failed" : waState,
            event: "Sent", // Keep event as "Sent" even for updates
            payload: waStatus,
            messageId: whatsappMessageId, // WAMID
            phoneNumber,
            direction: "outbound_status",
            processingMs: Date.now() - startTime,
            responseCode: 200,
            error:
              waState === "failed" && waStatus.errors?.length
                ? waStatus.errors[0].message
                : null,
            whatsappBusinessId: wabaId,
            whatsappPhoneNumberId: phoneNumberId || vendor.whatsappPhoneNumberId,
          });
          continue;
        }

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

        // 📝 Log activity for status update - logic inside logActivity will handle upsert via WAMID
        const isActualError = waState === "failed" && waStatus.errors?.length;
        await logActivity({
          vendorId,
          conversationId: messageToUpdate.conversationId, // Pass context if known
          messageId: whatsappMessageId, // WAMID
          phoneNumber,
          status: waState === "failed" ? "failed" : waState,
          event: "Sent", // Keep event as "Sent" -> Status column will show "Delivered"/"Read"
          error: isActualError ? waStatus.errors[0]?.message : null,
          payload: waStatus,
          direction: "outbound_status",
          responseCode: 200,
          processingMs: Date.now() - startTime,
          // type can be inferred by logActivity via WAMID
          whatsappBusinessId: wabaId,
          whatsappPhoneNumberId: phoneNumberId || vendor.whatsappPhoneNumberId,
        });

        // ✅ Keep inbox ordering correct
        await prisma.conversation.update({
          where: { id: messageToUpdate.conversationId },
          data: { lastMessageAt: new Date() },
        });

        // 🔥 Realtime status update to UI
        try {
          const io = getIO();
          io.to(`conversation:${messageToUpdate.conversationId}`).emit(
            "message:status",
            {
              whatsappMessageId,
              status: waState,
            },
          );
        } catch { }
      }
    }

    /* =====================================================
       3️⃣ HANDLE TEMPLATE APPROVAL EVENTS
    ===================================================== */
    if (value.message_template_status_update) {
      eventType = "template_status";
      direction = "inbound";

      const templateUpdate = value.message_template_status_update;
      const templateEvent = templateUpdate.event; // APPROVED | REJECTED | PENDING
      // const templateId = templateUpdate.message_template_id;

      let opEvent = "Template Update";
      let opStatus = "received";

      if (templateEvent === "APPROVED") {
        opEvent = "Template Created";
        opStatus = "created";
      } else if (templateEvent === "REJECTED") {
        opEvent = "Template Rejected";
        opStatus = "failed";
      } else if (templateEvent === "PENDING") {
        opEvent = "Template Pending";
        opStatus = "pending";
      } else {
        // Fallback for "created" or other events
        opEvent = templateEvent;
        opStatus = "received";
      }

      await logActivity({
        vendorId,
        type: "Template", // Proper casing
        status: opStatus,
        event: opEvent,
        payload: templateUpdate,
        responseCode: 200,
        processingMs: Date.now() - startTime,
        direction: "inbound",
        whatsappBusinessId: wabaId, // Usually present for template updates
        whatsappPhoneNumberId: phoneNumberId || vendor.whatsappPhoneNumberId,
      });
    }

    /* =====================================================
       3️⃣ HANDLE TEMPLATE APPROVAL EVENTS
    ===================================================== */
    if (value.message_template_status_update) {
      eventType = "template_status";
      direction = "inbound";

      const templateUpdate = value.message_template_status_update;
      const templateEvent = templateUpdate.event; // APPROVED | REJECTED | PENDING
      // const templateId = templateUpdate.message_template_id;

      let opEvent = "Template Update";
      let opStatus = "received";

      if (templateEvent === "APPROVED") {
        opEvent = "Template Created";
        opStatus = "created";
      } else if (templateEvent === "REJECTED") {
        opEvent = "Template Rejected";
        opStatus = "failed";
      } else if (templateEvent === "PENDING") {
        opEvent = "Template Pending";
        opStatus = "pending";
      } else {
        // Fallback for "created" or other events
        opEvent = templateEvent;
        opStatus = "received";
      }

      await logActivity({
        vendorId,
        type: "Template", // Proper casing
        status: opStatus,
        event: opEvent,
        payload: templateUpdate,
        responseCode: 200,
        processingMs: Date.now() - startTime,
        direction: "inbound",
      });
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("WhatsApp webhook error:", err);

    // Log the error
    await logActivity({
      vendorId,
      status: "error",
      event: "uncaught_error",
      payload: req.body,
      responseCode: 200,
      error: err.message || "Unknown error",
      processingMs: Date.now() - startTime,
      type: "webhook",
    });

    return res.sendStatus(200); // 👈 NEVER fail webhook
  }
});

export default router;
