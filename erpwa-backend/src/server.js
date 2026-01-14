import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import "./cron/templateStatus.cron.js";
import prisma from "./prisma.js";
import authRoutes from "./routes/auth.routes.js";
import vendorWhatsappRoutes from "./routes/vendorWhatsapp.route.js";
import vendorWhatsappMessageRoutes from "./routes/vendorWhatsappMessage.route.js";
import whatsappWebhookRoutes from "./routes/whatsappWebhook.route.js";
import whatsappTestRoutes from "./routes/whatsappTest.route.js";
import vendorTemplateRoutes from "./routes/vendorTemplate.route.js";
import vendorWhatsappTemplateSendRoutes from "./routes/vendorWhatsappTemplateSend.route.js";
import inboxRoutes from "./routes/inbox.route.js";
import categoryRoutes from "./routes/category.routes.js";
import leadRoutes from "./routes/lead.routes.js";
import leadManagementRoutes from "./routes/leadManagement.routes.js";
import galleryRoutes from "./routes/gallery.routes.js";
import campaignRoutes from "./routes/campaign.routes.js";
import recipientRoutes from "./routes/recipient.routes.js";
import { initSocket } from "./socket.js";
import userRoutes from "./routes/user.routes.js";
import testUploadRoute from "./routes/testUpload.route.js";

const app = express();
app.set("trust proxy", 1);
/* ================= MIDDLEWARE ================= */
app.use(express.json());
app.use(cookieParser());

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.set("etag", false);

/* ================= ROUTES ================= */
app.get("/ping", (req, res) => res.send("pong"));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/whatsapp-test", whatsappTestRoutes);
app.use("/api/vendor", vendorWhatsappRoutes);
app.use("/api/vendor/whatsapp", vendorWhatsappMessageRoutes);
app.use("/api/vendor/templates", vendorTemplateRoutes);
app.use("/api/vendor/whatsapp/template", vendorWhatsappTemplateSendRoutes);
app.use("/api/inbox", inboxRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/leads-management", leadManagementRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/campaign", campaignRoutes);
app.use("/api/recipients", recipientRoutes);
app.use("/webhook", whatsappWebhookRoutes);
app.use("/test", testUploadRoute);

/* ================= SERVER START ================= */
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ Database connected successfully");
  } catch (error) {
    console.error("❌ Database connection failed");
    console.error(error);
  }

  const server = http.createServer(app);
  initSocket(server);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Backend + WebSocket running on port ${PORT}`);
  });
}

startServer();
