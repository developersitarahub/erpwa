import express from "express";
import fetch from "node-fetch";
import prisma from "../prisma.js";
import { decrypt } from "../utils/encryption.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/requireRole.middleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { uploadTemplateMediaToS3 } from "../services/templateMedia.service.js";
import { upload } from "../middleware/upload.middleware.js";
import { uploadTemplateMediaToMeta } from "../utils/uploadTemplateMediaToMeta.js";



const router = express.Router();

/**
 * ===============================
 * GET ALL TEMPLATES
 * ===============================
 */
router.get(
  "/",
  authenticate,
  requireRoles(["vendor_owner", "vendor_admin", "sales"]),
  asyncHandler(async (req, res) => {
    console.log(`🔍 Fetching templates for Vendor ID: ${req.user.vendorId}`);

    const templates = await prisma.template.findMany({
      where: { vendorId: req.user.vendorId },
      include: {
        languages: true,
        media: true, // Include header media info (linked by language in logic, but fetched at top level)
        buttons: true, // Include buttons
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`✅ Found ${templates.length} templates for this vendor.`);

    if (templates.length === 0) {
      const totalTemplates = await prisma.template.count();
      console.log(`⚠️ Total templates in DB: ${totalTemplates}. Possible Vendor ID mismatch.`);
    }

    res.json(templates);
  })
);

/**
 * ===============================
 * CREATE TEMPLATE (DRAFT)
 * ===============================
 */
router.post(
  "/",
  authenticate,
  requireRoles(["vendor_owner", "vendor_admin", "sales"]),
  upload.single("header.file"),
  asyncHandler(async (req, res) => {
    const {
      metaTemplateName,
      displayName,
      category,
      language,
      body,
      footerText,
      buttons = [],
    } = req.body;

    if (!metaTemplateName || !category || !language || !body) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const headerType = req.body["header.type"] || "TEXT";
    const headerFile = req.file;


    if (!["TEXT", "IMAGE", "VIDEO", "DOCUMENT"].includes(headerType)) {
      return res.status(400).json({ message: "Invalid header type" });
    }

    const existingTemplate = await prisma.template.findUnique({
      where: {
        vendorId_metaTemplateName: {
          vendorId: req.user.vendorId,
          metaTemplateName,
        },
      },
    });

    if (existingTemplate) {
      return res
        .status(409)
        .json({ message: "Template with this name already exists for this vendor." });
    }

    /** TEMPLATE */
    const template = await prisma.template.create({
      data: {
        vendorId: req.user.vendorId,
        metaTemplateName,
        displayName,
        category,
        status: "draft",
      },
    });

    /** TEMPLATE LANGUAGE */
    const templateLanguage = await prisma.templateLanguage.create({
      data: {
        templateId: template.id,
        language,
        body,
        footerText,
        headerType,
        headerText: headerType === "TEXT" ? (req.body["header.text"] || req.body.headerText) : null,
        metaStatus: "draft",
      },
    });

    /** HEADER MEDIA (S3 ONLY, NO WHATSAPP YET) */
    if (["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType)) {
      if (!headerFile) {
        return res.status(400).json({ message: "Header media file is required" });
      }

      const uploadResult = await uploadTemplateMediaToS3({
        buffer: headerFile.buffer,
        mimeType: headerFile.mimetype,
        vendorId: req.user.vendorId,
        templateId: template.id,
        language,
        extension: headerFile.originalname.split(".").pop(),
      });

      await prisma.templateMedia.create({
        data: {
          templateId: template.id,
          language,
          mediaType: headerType.toLowerCase(),
          s3Url: uploadResult.url,
          uploadStatus: "pending",
          mimeType: headerFile.mimetype,
        },
      });
    }


    /** BUTTONS */
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];

      await prisma.templateButton.create({
        data: {
          templateId: template.id,
          type: btn.type,
          text: btn.text,
          position: i,
          value:
            btn.type === "URL" || btn.type === "PHONE_NUMBER"
              ? btn.value
              : null,
        },
      });
    }

    res.json({ template, language: templateLanguage });
  })
);

/**
 * ===============================
 * GET SINGLE TEMPLATE (FOR EDIT)
 * ===============================
 */
router.get(
  "/:id",
  authenticate,
  requireRoles(["vendor_owner", "vendor_admin", "sales"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const template = await prisma.template.findUnique({
      where: { id },
      include: {
        languages: true,
        buttons: true,
      },
    });

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    if (template.vendorId !== req.user.vendorId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    res.json(template);
  })
);

/**
 * ===============================
 * UPDATE TEMPLATE (DRAFT/REJECTED)
 * ===============================
 */
router.put(
  "/:id",
  authenticate,
  requireRoles(["vendor_owner", "vendor_admin", "sales"]),
  upload.single("header.file"),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      displayName,
      category,
      language: langCode,
      body,
      footerText,
      buttons = [],
    } = req.body;

    const template = await prisma.template.findUnique({
      where: { id },
      include: { languages: true },
    });

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    if (template.status === "approved" || template.status === "pending") {
      return res.status(403).json({ message: "Cannot edit approved or pending templates" });
    }

    // Handle Header File
    const headerType = req.body["header.type"] || "TEXT";
    const headerFile = req.file;

    // Update Template
    await prisma.template.update({
      where: { id },
      data: {
        displayName,
        category,
        status: "draft", // Reset to draft if it was rejected
      },
    });

    // Update Language
    // Note: We assume 1 language per template for now based on current logic
    const langId = template.languages[0]?.id;
    if (langId) {
      await prisma.templateLanguage.update({
        where: { id: langId },
        data: {
          language: langCode,
          body,
          footerText,
          headerType,
          metaStatus: "draft",
        },
      });

      // Handle properties that might need media update (simplified for now)
      if (headerFile) {
        await uploadTemplateMediaToS3(template.id, langCode, headerFile, headerType);
      }
    }

    // Update Buttons (Delete all and recreate)
    await prisma.templateButton.deleteMany({ where: { templateId: id } });

    // Re-create buttons
    // Note: In a real app we might want to be smarter, but this works for drafts
    if (buttons && Array.isArray(buttons)) { // Make sure buttons is array
      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        await prisma.templateButton.create({
          data: {
            templateId: id,
            type: btn.type,
            text: btn.text,
            position: i,
            value: (btn.type === "URL" || btn.type === "PHONE_NUMBER") ? btn.value : null,
          },
        });
      }
    } else if (req.body.buttons) {
      // If buttons came as object/map from FormData (e.g. buttons[0][type])
      // The middleware or body parser might handle it differently. 
      // But since we use array notation in frontend FormData, and multer/express typically handles it...
      // We will assume the frontend sends it correct structure or we parse it.
      // For simplicity in this edit, assuming the previous loop works if buttons is parsed correctly.
    }

    res.json({ success: true, message: "Template updated" });
  })
);

/**
 * ===============================
 * SUBMIT TEMPLATE TO META
 * ===============================
 */
router.post(
  "/:id/submit",
  authenticate,
  requireRoles(["vendor_owner", "vendor_admin", "sales"]),
  asyncHandler(async (req, res) => {

    // 🚨 HARD BLOCK ANY BODY OR MULTIPART - Removed strict check to avoid false positives with empty JSON objects
    // if (req.body && Object.keys(req.body).length > 0) ...

    const template = await prisma.template.findUnique({
      where: { id: req.params.id },
      include: {
        vendor: true,
        languages: true,
        buttons: true,
      },
    });

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    const language = template.languages[0];
    const headerType = (language.headerType || "TEXT").toUpperCase();
    const accessToken = decrypt(template.vendor.whatsappAccessToken);

    const components = [];
    console.log("SUBMIT BODY KEYS:", Object.keys(req.body || {}));

    /// ===============================
    // HEADER (IMAGE / VIDEO / DOCUMENT)
    // ===============================
    let headerHandle = null;

    if (headerType !== "TEXT") {
      const media = await prisma.templateMedia.findFirst({
        where: {
          templateId: template.id,
          language: language.language,
        },
      });

      if (!media) {
        throw new Error("Header media missing");
      }

      // Upload to Meta using Resumable Upload API (required for templates)
      // Always re-upload since handles may expire
      console.log("📥 Downloading media from S3:", media.s3Url);

      const s3Response = await fetch(media.s3Url);
      if (!s3Response.ok) {
        throw new Error("Failed to download media from S3");
      }

      const buffer = Buffer.from(await s3Response.arrayBuffer());
      const fileName = media.s3Url.split("/").pop() || "header-media";

      // Use Meta's Resumable Upload API (requires App ID from env)
      const appId = process.env.META_APP_ID;
      if (!appId) {
        throw new Error("META_APP_ID environment variable is required for template media upload");
      }

      headerHandle = await uploadTemplateMediaToMeta({
        accessToken,
        appId,
        buffer,
        mimeType: media.mimeType,
        fileName,
      });

      // Store the handle (note: handles can expire, so we may need to re-upload)
      await prisma.templateMedia.update({
        where: { id: media.id },
        data: {
          whatsappMediaId: headerHandle,
          uploadStatus: "uploaded",
          uploadedAt: new Date(),
        },
      });

      components.push({
        type: "HEADER",
        format: headerType,
        example: {
          header_handle: [headerHandle],
        },
      });
    }


    /**
     * ===============================
     * BODY (REQUIRED BY META)
     * ===============================
     */
    // Extract variables like {{1}}, {{2}} from body text
    const bodyVariables = language.body.match(/{{\d+}}/g) || [];
    const bodyComponent = {
      type: "BODY",
      text: language.body,
    };

    // If there are variables, add example values
    if (bodyVariables.length > 0) {
      bodyComponent.example = {
        body_text: [bodyVariables.map((_, i) => `Sample${i + 1}`)],
      };
    }

    components.push(bodyComponent);

    /**
     * ===============================
     * FOOTER
     * ===============================
     */
    if (language.footerText) {
      components.push({
        type: "FOOTER",
        text: language.footerText,
      });
    }

    /**
     * ===============================
     * BUTTONS
     * ===============================
     */
    if (template.buttons.length) {
      components.push({
        type: "BUTTONS",
        buttons: template.buttons.map((b) => {
          if (b.type === "URL") {
            return {
              type: "URL",
              text: b.text,
              url: b.value,
              example: ["TRACK123"],
            };
          }
          if (b.type === "PHONE_NUMBER") {
            return {
              type: "PHONE_NUMBER",
              text: b.text,
              phone_number: b.value,
            };
          }
          return {
            type: "QUICK_REPLY",
            text: b.text,
          };
        }),
      });
    }

    /**
     * ===============================
     * SUBMIT TO META
     * ===============================
     */
    const payload = {
      name: template.metaTemplateName,
      category: template.category,
      language: language.language,
      components,
    };

    console.log("Meta API Request Body:", JSON.stringify(payload, null, 2));

    const metaResp = await fetch(
      `https://graph.facebook.com/v24.0/${template.vendor.whatsappBusinessId}/message_templates`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const metaData = await metaResp.json();

    if (!metaResp.ok) {
      console.error("❌ Meta Submit Failed:", JSON.stringify(metaData, null, 2));

      await prisma.template.update({
        where: { id: template.id },
        data: { status: "rejected" },
      });

      const errorMessage = metaData?.error?.message || metaData?.error?.user_msg || "Unknown Meta API Error";
      return res.status(400).json({
        message: errorMessage,
        details: metaData.error || metaData
      });
    }

    // Update template status and save Meta ID
    await prisma.template.update({
      where: { id: template.id },
      data: { status: "pending" },
    });

    // Save Meta template ID to templateLanguage for status sync
    await prisma.templateLanguage.update({
      where: { id: language.id },
      data: {
        metaId: metaData.id,
        metaStatus: "pending",
      },
    });

    console.log("✅ Template submitted successfully. Meta ID:", metaData.id);

    res.json({
      success: true,
      metaTemplateId: metaData.id,
    });
  })
);

/**
 * ===============================
 * DELETE TEMPLATE
 * ===============================
 */
router.delete(
  "/:id",
  authenticate,
  requireRoles(["vendor_owner", "vendor_admin", "sales"]),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const template = await prisma.template.findUnique({
      where: { id },
      include: { vendor: true },
    });

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    // if template is not draft, try deleting from Meta
    if (template.status !== "draft") {
      try {
        const accessToken = decrypt(template.vendor.whatsappAccessToken);
        const url = `https://graph.facebook.com/v24.0/${template.vendor.whatsappBusinessId}/message_templates?name=${template.metaTemplateName}`;

        console.log(`🗑️ Deleting from Meta: ${template.metaTemplateName}`);

        const metaResp = await fetch(url, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!metaResp.ok) {
          const errData = await metaResp.json();
          const errorMessage = errData?.error?.message || errData?.error?.user_msg || "Unknown Meta API Error";
          console.error("❌ Meta Deletion Failed (proceeding with local delete):", errorMessage);

          // Proceed to delete locally, but maybe return a warning field?
          // We won't block the user from cleaning their dashboard.
        } else {
          console.log("✅ Deleted from Meta successfully");
        }
      } catch (error) {
        console.error("Error asking Meta to delete:", error);
        // Proceed with local delete anyway
      }
    }

    // Delete from local DB
    await prisma.template.delete({
      where: { id },
    });

    res.json({ success: true, message: "Template deleted successfully" });
  })
);

/**
 * ===============================
 * SYNC TEMPLATE STATUS FROM META
 * ===============================
 * Manually sync status for a specific template
 */
router.post(
  "/:id/sync-status",
  authenticate,
  requireRoles(["vendor_owner", "vendor_admin", "sales"]),
  asyncHandler(async (req, res) => {
    const template = await prisma.template.findUnique({
      where: { id: req.params.id },
      include: {
        vendor: true,
        languages: true,
      },
    });

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    const accessToken = decrypt(template.vendor.whatsappAccessToken);

    // Fetch all templates from Meta
    const metaResp = await fetch(
      `https://graph.facebook.com/v24.0/${template.vendor.whatsappBusinessId}/message_templates?name=${template.metaTemplateName}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!metaResp.ok) {
      const error = await metaResp.json();
      return res.status(400).json({ message: "Failed to fetch from Meta", error });
    }

    const metaData = await metaResp.json();
    const metaTemplate = metaData.data?.[0];

    if (!metaTemplate) {
      return res.status(404).json({ message: "Template not found on Meta" });
    }

    console.log("📥 Meta Template Status:", metaTemplate.status);

    // Update local database
    const newStatus = metaTemplate.status.toLowerCase();

    await prisma.template.update({
      where: { id: template.id },
      data: { status: newStatus },
    });

    // Update templateLanguage if exists
    if (template.languages.length > 0) {
      await prisma.templateLanguage.update({
        where: { id: template.languages[0].id },
        data: {
          metaId: metaTemplate.id,
          metaStatus: newStatus,
          metaReason: metaTemplate.rejected_reason || null,
        },
      });
    }

    res.json({
      success: true,
      templateId: template.id,
      metaId: metaTemplate.id,
      status: newStatus,
      message: `Template status updated to "${newStatus}"`,
    });
  })
);

export default router;
