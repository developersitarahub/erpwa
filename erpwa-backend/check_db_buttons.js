import prisma from "./src/prisma.js";

async function checkMessages() {
  try {
    console.log("🔍 Checking latest 5 outbound messages...");
    const messages = await prisma.message.findMany({
      where: {
        direction: "outbound",
        channel: "whatsapp",
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        content: true,
        messageType: true,
        outboundPayload: true,
        createdAt: true,
      },
    });

    console.log(JSON.stringify(messages, null, 2));

    if (messages.length === 0) {
      console.log("⚠️ No outbound messages found.");
    }
  } catch (error) {
    console.error("❌ Error querying database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMessages();
