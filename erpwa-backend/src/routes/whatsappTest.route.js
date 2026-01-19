import express from "express";
import fetch from "node-fetch";
import prisma from "../prisma.js";
import { decrypt } from "../utils/encryption.js";

const router = express.Router();

// DEV TEST ROUTE (uses encrypted token from DB)
router.post("/send-test", async (req, res) => {
  try {
    const { to, text } = req.body;

    if (!to || !text) {
      return res.status(400).json({
        message: "to and text are required",
      });
    }

    // 1️⃣ Load vendor that owns the test phone number
    const vendor = await prisma.vendor.findFirst({
      where: {
        whatsappPhoneNumberId: process.env.WHATSAPP_TEST_PHONE_NUMBER_ID,
      },
    });

    if (!vendor || !vendor.whatsappAccessToken) {
      return res.status(400).json({
        message: "WhatsApp not configured for test vendor",
      });
    }

    // 2️⃣ Decrypt access token
    const accessToken = decrypt(vendor.whatsappAccessToken);

    // 3️⃣ Send WhatsApp message
    const response = await fetch(
      `https://graph.facebook.com/v24.0/${vendor.whatsappPhoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({
        ok: false,
        metaError: data,
      });
    }

    return res.json({
      ok: true,
      whatsapp: data,
    });
  } catch (err) {
    console.error("WhatsApp test send error:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
