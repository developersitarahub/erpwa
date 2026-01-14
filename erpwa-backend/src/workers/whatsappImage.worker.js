import prisma from "../prisma.js";
import { sendWhatsAppImage } from "../services/whatsapp.service.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function processImageQueue() {
  while (true) {
    // 1️⃣ Fetch ONE queued image message
    const message = await prisma.message.findFirst({
      where: {
        status: "queued",
        messageType: "image",
      },
      include: {
        conversation: {
          include: { lead: true },
        },
        media: true,
      },
    });

    if (!message) {
      await sleep(2000); // nothing to do
      continue;
    }

    try {
      const media = await prisma.messageMedia.findFirst({
        where: { messageId: message.id },
      });

      // 2️⃣ Send image to WhatsApp
      await sendWhatsAppImage({
        to: message.conversation.lead.phone,
        imageUrl: media.mediaUrl,
        caption: media.caption,
      });

      // 3️⃣ Mark as sent
      await prisma.message.update({
        where: { id: message.id },
        data: { status: "sent" },
      });

      await prisma.messageDelivery.updateMany({
        where: { messageId: message.id },
        data: { status: "sent" },
      });

      // 4️⃣ RATE LIMIT (DO NOT REMOVE)
      await sleep(1000);
    } catch (err) {
      await prisma.message.update({
        where: { id: message.id },
        data: { status: "failed" },
      });

      console.error("WhatsApp send failed:", err.message);
      await sleep(3000);
    }
  }
}
