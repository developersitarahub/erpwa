import { processWhatsappQueue } from "./whatsapp.worker.js";

processWhatsappQueue().catch((err) => {
  console.error("❌ WhatsApp worker crashed:", err);
  process.exit(1);
});
