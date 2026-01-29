import express from "express";
import fetch from "node-fetch";
import prisma from "../prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireRoles } from "../middleware/requireRole.middleware.js";
import { encrypt } from "../utils/encryption.js";

const router = express.Router();

console.log("✅ vendorWhatsapp routes loaded");

/**
 * ===============================
 * VENDOR WHATSAPP SETUP
 * ===============================
 * Access: vendor_owner only
 */
router.post(
  "/whatsapp/setup",
  authenticate,
  requireRoles(["vendor_owner"]),
  asyncHandler(async (req, res) => {
    const { whatsappBusinessId, whatsappPhoneNumberId, whatsappAccessToken } =
      req.body;

    // 1️⃣ Validate input
    if (!whatsappBusinessId || !whatsappPhoneNumberId || !whatsappAccessToken) {
      return res.status(400).json({
        message:
          "WhatsApp Business ID, Phone Number ID, and Access Token are required",
      });
    }

    // 2️⃣ Validate credentials with Meta API
    const metaResp = await fetch(
      `https://graph.facebook.com/v24.0/${whatsappPhoneNumberId}?fields=display_phone_number`,
      {
        headers: {
          Authorization: `Bearer ${whatsappAccessToken}`,
        },
      },
    );

    if (!metaResp.ok) {
      const err = await metaResp.json();
      return res.status(400).json({
        message: "Invalid WhatsApp credentials",
        metaError: err?.error?.message,
      });
    }

    // 3️⃣ Encrypt access token
    const encryptedToken = encrypt(whatsappAccessToken);

    // 4️⃣ Save credentials to Vendor
    await prisma.vendor.update({
      where: { id: req.user.vendorId },
      data: {
        whatsappBusinessId,
        whatsappPhoneNumberId,
        whatsappAccessToken: encryptedToken, // 🔐 encrypted at rest
        whatsappStatus: "connected",
        whatsappVerifiedAt: new Date(),
        whatsappLastError: null,
      },
    });

    res.json({
      message: "WhatsApp successfully connected",
    });
  }),
);

/**
 * ===============================
 * GET EMBEDDED SIGNUP URL
 * ===============================
 * Access: vendor_owner only
 */
router.get(
  "/whatsapp/embedded-signup-url",
  authenticate,
  requireRoles(["vendor_owner"]),
  asyncHandler(async (req, res) => {
    const appId = process.env.META_APP_ID;
    const redirectUri = process.env.META_OAUTH_REDIRECT_URI;

    if (!appId || !redirectUri) {
      return res.status(500).json({
        message: "Meta OAuth configuration is missing",
      });
    }

    // Build Meta's embedded signup URL
    const signupUrl = `https://www.facebook.com/v24.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&state=${req.user.vendorId}&scope=whatsapp_business_management,whatsapp_business_messaging&response_type=code`;

    res.json({ signupUrl });
  }),
);

/**
 * ===============================
 * EMBEDDED SIGNUP CALLBACK
 * ===============================
 * Access: vendor_owner only
 * Exchanges the OAuth code for an access token
 */
router.post(
  "/whatsapp/embedded-setup",
  authenticate,
  requireRoles(["vendor_owner"]),
  asyncHandler(async (req, res) => {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        message: "Authorization code is required",
      });
    }

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const redirectUri = process.env.META_OAUTH_REDIRECT_URI;

    if (!appId || !appSecret || !redirectUri) {
      return res.status(500).json({
        message: "Meta OAuth configuration is missing",
      });
    }

    // 1️⃣ Exchange code for access token
    const tokenUrl = `https://graph.facebook.com/v24.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&code=${code}`;

    const tokenResp = await fetch(tokenUrl);
    const tokenData = await tokenResp.json();

    if (!tokenResp.ok || !tokenData.access_token) {
      return res.status(400).json({
        message: "Failed to exchange code for access token",
        metaError: tokenData?.error?.message,
      });
    }

    const accessToken = tokenData.access_token;

    // 2️⃣ Get WhatsApp Business Account details
    const wabaUrl = `https://graph.facebook.com/v24.0/debug_token?input_token=${accessToken}&access_token=${appId}|${appSecret}`;
    const wabaResp = await fetch(wabaUrl);
    const wabaData = await wabaResp.json();

    if (!wabaResp.ok) {
      return res.status(400).json({
        message: "Failed to verify access token",
        metaError: wabaData?.error?.message,
      });
    }

    // 3️⃣ Get WhatsApp Business Accounts associated with this token
    const accountsUrl = `https://graph.facebook.com/v24.0/me/businesses?access_token=${accessToken}`;
    const accountsResp = await fetch(accountsUrl);
    const accountsData = await accountsResp.json();

    if (
      !accountsResp.ok ||
      !accountsData.data ||
      accountsData.data.length === 0
    ) {
      return res.status(400).json({
        message: "No WhatsApp Business Account found",
        metaError: accountsData?.error?.message,
      });
    }

    // Get the first business account
    const businessId = accountsData.data[0].id;

    // 4️⃣ Get WhatsApp Business Account ID (WABA)
    const wabaListUrl = `https://graph.facebook.com/v24.0/${businessId}/owned_whatsapp_business_accounts?access_token=${accessToken}`;
    const wabaListResp = await fetch(wabaListUrl);
    const wabaListData = await wabaListResp.json();

    if (
      !wabaListResp.ok ||
      !wabaListData.data ||
      wabaListData.data.length === 0
    ) {
      return res.status(400).json({
        message: "No WhatsApp Business Account found for this business",
        metaError: wabaListData?.error?.message,
      });
    }

    const whatsappBusinessId = wabaListData.data[0].id;

    // 5️⃣ Get Phone Number ID
    const phoneUrl = `https://graph.facebook.com/v24.0/${whatsappBusinessId}/phone_numbers?access_token=${accessToken}`;
    const phoneResp = await fetch(phoneUrl);
    const phoneData = await phoneResp.json();

    if (!phoneResp.ok || !phoneData.data || phoneData.data.length === 0) {
      return res.status(400).json({
        message: "No phone number found for this WhatsApp Business Account",
        metaError: phoneData?.error?.message,
      });
    }

    const whatsappPhoneNumberId = phoneData.data[0].id;

    // 6️⃣ Encrypt access token
    const encryptedToken = encrypt(accessToken);

    // 7️⃣ Save credentials to Vendor
    await prisma.vendor.update({
      where: { id: req.user.vendorId },
      data: {
        whatsappBusinessId,
        whatsappPhoneNumberId,
        whatsappAccessToken: encryptedToken,
        whatsappStatus: "connected",
        whatsappVerifiedAt: new Date(),
        whatsappLastError: null,
      },
    });

    res.json({
      message: "WhatsApp successfully connected via embedded signup",
    });
  }),
);

/**
 * ===============================
 * GET WHATSAPP CONFIG (SAFE)
 * ===============================
 * Access: vendor_owner, vendor_admin
 */
router.get(
  "/whatsapp",
  authenticate,
  requireRoles(["vendor_owner", "vendor_admin"]),
  asyncHandler(async (req, res) => {
    const vendor = await prisma.vendor.findUnique({
      where: { id: req.user.vendorId },
      select: {
        whatsappBusinessId: true,
        whatsappPhoneNumberId: true,
        whatsappStatus: true,
        whatsappVerifiedAt: true,
        whatsappLastError: true,
      },
    });

    res.json(vendor);
  }),
);

export default router;
