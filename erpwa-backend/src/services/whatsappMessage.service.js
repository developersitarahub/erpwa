import axios from "axios";
import prisma from "../prisma.js";
import { decrypt } from "../utils/encryption.js";
import { getIO } from "../socket.js";

/**
 * Validates and sends a WhatsApp message via Cloud API,
 * then logs it to the database so it appears in chat history.
 *
 * @param {string} vendorId
 * @param {string} conversationId
 * @param {object} contentObj  { type: 'text'|'image'|'interactive', text?, image?, interactive? }
 */
export async function sendMessage(vendorId, conversationId, contentObj) {
  try {
    // 1. Fetch Context (Vendor & Conversation)
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });
    if (
      !vendor ||
      !vendor.whatsappAccessToken ||
      !vendor.whatsappPhoneNumberId
    ) {
      throw new Error("Vendor missing WhatsApp credentials");
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { lead: true },
    });

    if (!conversation || !conversation.lead?.phoneNumber) {
      throw new Error("Conversation or lead phone number not found");
    }

    const accessToken = decrypt(vendor.whatsappAccessToken);
    const phoneNumberId = vendor.whatsappPhoneNumberId;
    const to = conversation.lead.phoneNumber;

    // 2. Construct Payload
    const url = `https://graph.facebook.com/v24.0/${phoneNumberId}/messages`;

    let whatsappPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
      type: contentObj.type,
    };

    let bodyText = ""; // For DB logging

    switch (contentObj.type) {
      case "text":
        whatsappPayload.text = { body: contentObj.text };
        bodyText = contentObj.text;
        break;

      case "image":
        whatsappPayload.image = contentObj.image; // { link: '...' }
        bodyText = contentObj.image.caption || "[Image]";
        break;

      case "interactive":
        whatsappPayload.interactive = contentObj.interactive;
        // Try to extract a readable text for DB
        bodyText = contentObj.interactive.body?.text || "[Interactive Message]";
        break;

      default:
        throw new Error(`Unsupported message type: ${contentObj.type}`);
    }

    // 3. Send to WhatsApp
    const res = await axios.post(url, whatsappPayload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    // 4. Log to Database (Message Table)
    const waMessageId = res.data.messages?.[0]?.id;

    if (waMessageId) {
      const newMessage = await prisma.message.create({
        data: {
          vendorId,
          conversationId,
          direction: "outbound",
          channel: "whatsapp",
          messageType: contentObj.type,
          content: bodyText,
          whatsappMessageId: waMessageId,
          status: "sent",
          outboundPayload: whatsappPayload, // Save the interactive payload
        },
      });

      // 5. Emit Socket Event for Real-time Update
      try {
        const io = getIO();
        io.to(`conversation:${conversationId}`).emit("message:new", {
          id: newMessage.id,
          whatsappMessageId: newMessage.whatsappMessageId,
          sender: "executive", // Treat bot messages as "executive" (outbound)
          timestamp: newMessage.createdAt.toISOString(),
          text:
            contentObj.type === "text" || contentObj.type === "interactive"
              ? bodyText
              : undefined,
          // Handle media if we add support for saving media urls in sendMessage later
          // For now, chatbot images are usually links, not uploaded to our S3 in this flow necessarily,
          // but if we wanted to show the image preview in chat:
          mediaUrl:
            contentObj.type === "image" ? contentObj.image.link : undefined,
          caption:
            contentObj.type === "image" ? contentObj.image.caption : undefined,
          mimeType: contentObj.type === "image" ? "image/jpeg" : undefined, // Approximation or derived
          outboundPayload: whatsappPayload,
        });
      } catch (err) {
        console.error("Failed to emit socket event:", err);
      }
    }

    return res.data;
  } catch (error) {
    console.error(
      "❌ sendMessage Error:",
      error.response?.data || error.message,
    );
    throw error; // Rethrow to let caller handle flow error
  }
}
