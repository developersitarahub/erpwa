import express from "express";
import fetch from "node-fetch";
import prisma from "../prisma.js";
import multer from "multer";
import FormData from "form-data";
import { uploadToS3 } from "../services/media.service.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/requireRole.middleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { decrypt } from "../utils/encryption.js";
import { getIO } from "../socket.js";

async function getWhatsappConfig(conversation) {
  if (
    !conversation.vendor?.whatsappAccessToken ||
    !conversation.vendor?.whatsappPhoneNumberId
  ) {
    throw new Error("WhatsApp not configured");
  }

  const accessToken = decrypt(conversation.vendor.whatsappAccessToken);

  return {
    accessToken,
    phoneNumberId: conversation.vendor.whatsappPhoneNumberId,
  };
}

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/send-message",
  authenticate,
  requireRoles(["vendor_owner", "vendor_admin", "sales"]),
  asyncHandler(async (req, res) => {
    const { conversationId, text, replyToMessageId } = req.body;

    /* ===============================
       1️⃣ Validate input
    =============================== */
    if (!conversationId || !text || !text.trim()) {
      return res.status(400).json({
        message: "conversationId and text are required",
      });
    }

    /* ===============================
       2️⃣ Load conversation + relations
    =============================== */
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        lead: true,
        vendor: true,
      },
    });

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found",
      });
    }

    // 🔒 ROLE-BASED ACCESS: Sales persons can only message their assigned leads
    // Admins and owners can message anyone
    if (req.user.role === "sales") {
      // Allow if assigned to this sales person OR if no assignment (backward compatibility)
      if (
        conversation.lead.salesPersonId &&
        conversation.lead.salesPersonId !== req.user.id
      ) {
        return res.status(403).json({
          message: "You don't have access to this conversation",
        });
      }
    }

    if (!conversation.isOpen) {
      return res.status(400).json({
        message: "Conversation is closed",
      });
    }

    /* ===============================
       3️⃣ Check 24h WhatsApp window
    =============================== */
    if (
      !conversation.sessionExpiresAt ||
      conversation.sessionExpiresAt < new Date()
    ) {
      return res.status(400).json({
        message: "24-hour window expired. Use template message.",
      });
    }

    /* ===============================
       4️⃣ Validate WhatsApp config
    =============================== */
    if (
      !conversation.vendor?.whatsappAccessToken ||
      !conversation.vendor?.whatsappPhoneNumberId
    ) {
      return res.status(400).json({
        message: "WhatsApp is not configured for this vendor",
      });
    }

    /* ===============================
       5️⃣ Decrypt access token
    =============================== */
    let accessToken;
    try {
      accessToken = decrypt(conversation.vendor.whatsappAccessToken);
    } catch {
      return res.status(400).json({
        message: "Invalid WhatsApp access token",
      });
    }

    /* ===============================
       6️⃣ Send message to WhatsApp
    =============================== */
    const response = await fetch(
      `https://graph.facebook.com/v24.0/${conversation.vendor.whatsappPhoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: conversation.lead.phoneNumber,
          type: "text",
          text: { body: text },
          ...(replyToMessageId
            ? {
                context: {
                  message_id: replyToMessageId,
                },
              }
            : {}),
        }),
      },
    );

    const metaData = await response.json();

    const whatsappMessageId = metaData.messages?.[0]?.id;

    if (!whatsappMessageId) {
      return res.status(500).json({
        message: "WhatsApp did not return message ID",
        metaData,
      });
    }

    if (!response.ok) {
      return res.status(400).json({
        message: "Failed to send WhatsApp message",
        metaError: metaData,
      });
    }

    /* ===============================
       7️⃣ Persist outbound message
    =============================== */
    const message = await prisma.message.create({
      data: {
        vendorId: conversation.vendorId,
        conversationId: conversation.id,
        senderId: req.user.id,
        direction: "outbound",
        channel: "whatsapp",
        messageType: "text",
        content: text,
        whatsappMessageId,
        replyToMessageId,
        status: "sent",
        outboundPayload: metaData,
      },
    });

    /* ===============================
       🔥 EMIT REALTIME MESSAGE (SAFE)
    =============================== */
    try {
      const io = getIO();

      io.to(`conversation:${conversation.id}`).emit("message:new", {
        id: message.id,
        whatsappMessageId: message.whatsappMessageId,
        text: message.content,
        sender: "executive",
        timestamp: new Date(message.createdAt).toISOString(),
        status: "sent",

        // 🔥 THIS WAS MISSING
        replyToMessageId: message.replyToMessageId,
      });

      io.to(`vendor:${conversation.vendorId}`).emit("inbox:update", {
        conversationId: conversation.id,
      });
    } catch {
      // socket failure must NEVER break API
    }

    /* ===============================
       8️⃣ Update conversation ordering
    =============================== */
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
      },
    });

    /* ===============================
       9️⃣ Respond success
    =============================== */
    res.json({
      message: "Message sent",
      data: message,
    });
  }),
);

router.post(
  "/send-media",
  authenticate,
  requireRoles(["vendor_owner", "vendor_admin", "sales"]),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const { conversationId, replyToMessageId, caption } = req.body;
    const file = req.file;

    if (!conversationId || !file) {
      return res
        .status(400)
        .json({ message: "conversationId and file required" });
    }

    if (file.size > 100 * 1024 * 1024) {
      return res.status(400).json({
        message: "File exceeds WhatsApp 100MB limit",
      });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { lead: true, vendor: true },
    });

    if (!conversation || !conversation.vendor) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // 🔒 ROLE-BASED ACCESS: Sales persons can only send media to their assigned leads
    // Admins and owners can send to anyone
    if (req.user.role === "sales") {
      // Allow if assigned to this sales person OR if no assignment (backward compatibility)
      if (
        conversation.lead.salesPersonId &&
        conversation.lead.salesPersonId !== req.user.id
      ) {
        return res.status(403).json({
          message: "You don't have access to this conversation",
        });
      }
    }

    if (
      !conversation.sessionExpiresAt ||
      conversation.sessionExpiresAt < new Date()
    ) {
      return res.status(400).json({
        message: "24-hour window expired. Use template message.",
      });
    }

    let accessToken, phoneNumberId;

    try {
      ({ accessToken, phoneNumberId } = await getWhatsappConfig(conversation));
    } catch {
      return res.status(400).json({
        message: "WhatsApp is not configured for this vendor",
      });
    }

    /* ===============================
       1️⃣ Upload media to WhatsApp
    =============================== */
    const waForm = new FormData();
    waForm.append("messaging_product", "whatsapp");
    waForm.append("file", file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const uploadRes = await fetch(
      `https://graph.facebook.com/v24.0/${phoneNumberId}/media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...waForm.getHeaders(),
        },
        body: waForm,
      },
    );

    const uploadData = await uploadRes.json();

    if (!uploadData.id) {
      return res
        .status(500)
        .json({ message: "WhatsApp media upload failed", uploadData });
    }

    const mediaId = uploadData.id;

    /* ===============================
       2️⃣ Send media message
    =============================== */
    const mediaType = file.mimetype.startsWith("image/")
      ? "image"
      : file.mimetype.startsWith("video/")
        ? "video"
        : file.mimetype.startsWith("audio/")
          ? "audio"
          : "document";

    const sendRes = await fetch(
      `https://graph.facebook.com/v24.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: conversation.lead.phoneNumber,
          type: mediaType,
          [mediaType]: {
            id: mediaId,
            ...(caption && { caption }),
            ...(mediaType === "document" && {
              filename: file.originalname,
            }),
          },
          ...(replyToMessageId && {
            context: { message_id: replyToMessageId },
          }),
        }),
      },
    );

    const sendData = await sendRes.json();

    if (!sendRes.ok || !sendData.messages?.[0]?.id) {
      return res.status(500).json({
        message: "WhatsApp media send failed",
        sendData,
      });
    }

    const whatsappMessageId = sendData.messages[0].id;

    let mediaUrl = null;
    let message;
    try {
      const extension = file.originalname.split(".").pop();

      mediaUrl = await uploadToS3({
        buffer: file.buffer,
        mimeType: file.mimetype,
        vendorId: conversation.vendorId,
        conversationId,
        extension,
      });
      /* ===============================
   4️⃣ Save outbound media message (SUCCESS)
=============================== */
      message = await prisma.message.create({
        data: {
          vendorId: conversation.vendorId,
          conversationId,
          senderId: req.user.id,
          direction: "outbound",
          channel: "whatsapp",
          messageType: mediaType,
          content: `[${mediaType} message]`,
          whatsappMessageId,
          replyToMessageId,
          status: "sent",
        },
      });

      await prisma.messageMedia.create({
        data: {
          messageId: message.id,
          mediaType,
          mimeType: file.mimetype,
          mediaUrl,
          fileName: file.originalname,
          caption: caption || null, // ✅ ADD THIS
        },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
        },
      });
    } catch (err) {
      console.error("S3 upload failed after WhatsApp send:", err);

      // mark message as failed (optional but correct)
      await prisma.message.create({
        data: {
          vendorId: conversation.vendorId,
          conversationId,
          senderId: req.user.id,
          direction: "outbound",
          channel: "whatsapp",
          messageType: mediaType,
          content: `[${mediaType} message]`,
          whatsappMessageId,
          status: "failed",
        },
      });

      return res.status(500).json({
        message: "Media sent to WhatsApp but failed to store",
      });
    }

    /* ===============================
       5️⃣ SOCKET EMIT (REALTIME)
    =============================== */
    const io = getIO();

    io.to(`conversation:${conversationId}`).emit("message:new", {
      id: message.id,
      whatsappMessageId,
      sender: "executive",
      timestamp: message.createdAt.toISOString(),
      status: "sent",
      replyToMessageId,
      mediaUrl,
      mimeType: file.mimetype,
      caption: caption || undefined, // ✅ ADD THIS
    });

    io.to(`vendor:${conversation.vendorId}`).emit("inbox:update");

    res.json({ success: true });
  }),
);

export default router;
