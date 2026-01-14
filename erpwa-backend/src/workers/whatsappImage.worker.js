import prisma from "../prisma.js";
import { sendWhatsAppImage } from "../services/whatsapp.service.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function processImageQueue() {
  while (true) {
    const message = await prisma.message.findFirst({
      where: {
        status: "queued",
        messageType: "image",
      },
      orderBy: { createdAt: "asc" },
      include: {
        conversation: { include: { lead: true } },
      },
    });

    if (!message) {
      await sleep(2000);
      continue;
    }

    // 🔒 LOCK MESSAGE
    await prisma.message.update({
      where: { id: message.id },
      data: { status: "processing" },
    });

    try {
      const media = await prisma.messageMedia.findFirst({
        where: { messageId: message.id },
      });

      if (!media) {
        throw new Error("Media not found");
      }

      await sendWhatsAppImage({
        to: message.conversation.lead.phone,
        imageUrl: media.mediaUrl,
        caption: media.caption,
      });

      await prisma.message.update({
        where: { id: message.id },
        data: { status: "sent" },
      });

      await prisma.messageDelivery.updateMany({
        where: { messageId: message.id },
        data: { status: "sent" },
      });

      await sleep(1000); // WhatsApp-safe
    } catch (err) {
      console.error("WhatsApp send failed:", err.message);

      await prisma.message.update({
        where: { id: message.id },
        data: { status: "queued" }, // retry later
      });

      await sleep(5000);
    }
  }
}
