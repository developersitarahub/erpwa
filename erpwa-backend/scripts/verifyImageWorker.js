import prisma from "../prisma.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function verify() {
  console.log("🔍 Starting WhatsApp image worker verification...");

  // 1️⃣ Fetch latest image message
  const message = await prisma.message.findFirst({
    where: { messageType: "image" },
    orderBy: { createdAt: "desc" },
  });

  if (!message) {
    console.error("❌ No image message found");
    process.exit(1);
  }

  console.log("📨 Found message:", message.id);
  console.log("⏳ Initial status:", message.status);

  // 2️⃣ Wait for worker
  await sleep(5000);

  // 3️⃣ Re-fetch message
  const updated = await prisma.message.findUnique({
    where: { id: message.id },
  });

  console.log("📬 Updated status:", updated.status);

  if (updated.status === "sent") {
    console.log("✅ SUCCESS: Worker processed image correctly");
    process.exit(0);
  } else {
    console.error("❌ FAILED: Message not sent");
    process.exit(1);
  }
}

verify().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
