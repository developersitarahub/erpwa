import express from "express";
// Force restart
import fetch from "node-fetch";
import prisma from "../prisma.js";
import { decrypt } from "../utils/encryption.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/requireRole.middleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { uploadTemplateMediaToS3 } from "../services/templateMedia.service.js";
import { upload } from "../middleware/upload.middleware.js";
import { uploadTemplateMediaToMeta } from "../utils/uploadTemplateMediaToMeta.js";
import { logActivity } from "../services/activityLog.service.js";



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

    const where = { vendorId: req.user.vendorId };

    // 🔒 ROLE-BASED FILTERING: Sales users only see their own templates
    // 🔒 ROLE-BASED FILTERING: Sales users only see their own templates
    // if (req.user.role === "sales") {
    //   where.createdBy = req.user.id;
    // }

    const templates = await prisma.template.findMany({
      where,
      include: {
        languages: true,
        media: true,
        buttons: true,
        catalogProducts: true, // Include catalog products
        carouselCards: { orderBy: { position: 'asc' } }, // Include carousel cards ordered by position
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch creator names
    const creatorIds = [...new Set(templates.map((t) => t.createdBy).filter(Boolean))];
    const creators = await prisma.user.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, name: true },
    });
    const creatorMap = Object.fromEntries(creators.map((u) => [u.id, u.name]));

    const enrichedTemplates = templates.map((t) => {
      const name = t.createdBy ? (creatorMap[t.createdBy] || "Unknown") : "System";
      return { ...t, createdByName: name };
    });

    console.log(`✅ [${req.user.role}] Fetched ${enrichedTemplates.length} templates. Enriching with ${Object.keys(creatorMap).length} creator names.`);

    if (templates.length === 0) {
      const totalTemplates = await prisma.template.count();
      console.log(`⚠️ Total templates in DB: ${totalTemplates}. Possible Vendor ID mismatch.`);
    }

    res.json(enrichedTemplates);
  })
);

/**
 * ===============================
 * GET TEMPLATES FROM META (LIBRARY)
 * ===============================
 */
router.get(
  "/meta",
  authenticate,
  requireRoles(["vendor_owner", "vendor_admin", "sales"]),
  asyncHandler(async (req, res) => {
    console.log(`🔍 Fetching Meta templates for Vendor ID: ${req.user.vendorId}`);

    const vendor = await prisma.vendor.findUnique({
      where: { id: req.user.vendorId },
    });

    if (!vendor || !vendor.whatsappAccessToken || !vendor.whatsappBusinessId) {
      return res.status(400).json({ message: "Vendor WhatsApp credentials missing" });
    }

    const accessToken = decrypt(vendor.whatsappAccessToken);

    try {
      // Fetch templates from Meta API
      const metaResp = await fetch(
        `https://graph.facebook.com/v24.0/${vendor.whatsappBusinessId}/message_templates?limit=100`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!metaResp.ok) {
        const error = await metaResp.json();
        console.error("Meta API Error:", error);
        return res.status(mapMetaStatus(metaResp.status)).json({
          message: "Failed to fetch from Meta",
          details: error
        });
      }

      const metaData = await metaResp.json();
      const templates = metaData.data || [];

      console.log(`✅ Fetched ${templates.length} templates from Meta.`);
      res.json(templates);
    } catch (error) {
      console.error("Fetch Meta Templates Error:", error);
      res.status(500).json({ message: "Internal Server Error fetching from Meta" });
    }
  })
);

/**
 * ===============================
 * IMPORT TEMPLATE FROM META
 * ===============================
 */
router.post(
  "/import",
  authenticate,
  requireRoles(["vendor_owner", "vendor_admin", "sales"]),
  asyncHandler(async (req, res) => {
    const {
      metaTemplateName,
      displayName,
      category,
      language,
      body,
      headerType = "TEXT",
      headerText,
      footerText,
      buttons = [],
      metaId,
      status = "approved",
      headerMediaUrl = null // Header image URL from Meta
    } = req.body;

    // Helper to process media
    const processMedia = async (url, type, tId, lang) => {
      try {
        console.log(`⬇️ Downloading media from Meta: ${url}`);
        const mediaResp = await fetch(url);
        if (!mediaResp.ok) throw new Error("Failed to fetch media");

        const buffer = await mediaResp.arrayBuffer(); // use arrayBuffer for node-fetch
        const mimeType = mediaResp.headers.get("content-type") ||
          (type === "IMAGE" ? "image/jpeg" : type === "VIDEO" ? "video/mp4" : "application/pdf");
        const ext = mimeType.split("/")[1] || "bin";

        const uploadResult = await uploadTemplateMediaToS3({
          buffer: Buffer.from(buffer),
          mimeType,
          vendorId: req.user.vendorId,
          templateId: tId,
          language: lang,
          extension: ext
        });

        console.log(`✅ Re-uploaded media to S3: ${uploadResult.url}`);
        return {
          url: uploadResult.url,
          mimeType
        };
      } catch (e) {
        console.error("Failed to process Meta media:", e);
        return null; // Fallback to original URL or fail?
      }
    };

    // Check if exists
    const existing = await prisma.template.findFirst({
      where: {
        vendorId: req.user.vendorId,
        metaTemplateName: metaTemplateName
      },
      include: { languages: true, buttons: true, media: true }
    });

    if (existing) {
      // Logic for existing templates...
      // If header type matches and URL is provided
      if (headerMediaUrl && headerType !== "TEXT") {
        const needsUpload = !existing.media.length || existing.media[0].s3Url.includes("whatsapp.net") || existing.media[0].s3Url.includes("fbcdn");

        if (needsUpload) {
          console.log(`📸 Updating media for existing template ${metaTemplateName}`);

          const processed = await processMedia(headerMediaUrl, headerType, existing.id, language);

          if (processed) {
            // Upsert media
            const mediaData = {
              templateId: existing.id,
              language: language,
              mediaType: headerType.toLowerCase(),
              s3Url: processed.url,
              uploadStatus: "uploaded",
              mimeType: processed.mimeType
            };

            if (existing.media.length > 0) {
              await prisma.templateMedia.update({
                where: { id: existing.media[0].id },
                data: mediaData
              });
            } else {
              await prisma.templateMedia.create({ data: mediaData });
            }
          }
        }
      }

      // Return refreshed template
      const updated = await prisma.template.findUnique({
        where: { id: existing.id },
        include: { languages: true, buttons: true, media: true }
      });
      return res.json(updated);
    }

    // Create template
    const template = await prisma.template.create({
      data: {
        vendorId: req.user.vendorId,
        metaTemplateName,
        displayName,
        category,
        status: status, // Trusted from Meta
        createdBy: req.user.id,
      },
    });

    await prisma.templateLanguage.create({
      data: {
        templateId: template.id,
        language,
        body,
        headerType,
        headerText,
        footerText,
        metaStatus: status,
        metaId: metaId
      },
    });

    // Create TemplateMedia record if there's a header media URL (from Meta)
    if (headerMediaUrl && headerType !== "TEXT") {
      let finalUrl = headerMediaUrl;
      let finalMime = headerType === "IMAGE" ? "image/jpeg" : headerType === "VIDEO" ? "video/mp4" : "application/pdf";

      // Download and upload to S3
      const processed = await processMedia(headerMediaUrl, headerType, template.id, language);
      if (processed) {
        finalUrl = processed.url;
        finalMime = processed.mimeType;
      }

      await prisma.templateMedia.create({
        data: {
          templateId: template.id,
          language: language,
          mediaType: headerType.toLowerCase(),
          s3Url: finalUrl,
          uploadStatus: "uploaded",
          mimeType: finalMime
        }
      });
    }

    // Create buttons
    if (buttons.length > 0) {
      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        await prisma.templateButton.create({
          data: {
            templateId: template.id,
            type: btn.type,
            text: btn.text,
            position: i,
            value: (btn.type === "URL" || btn.type === "PHONE_NUMBER") ? btn.value : null,
          }
        });
      }
    }

    const fullTemplate = await prisma.template.findUnique({
      where: { id: template.id },
      include: { languages: true, buttons: true, media: true }
    });

    res.json(fullTemplate);
  })
);

/**
 * ===============================
 * DELETE TEMPLATE FROM META (Direct)
 * ===============================
 */
router.delete(
  "/meta",
  authenticate,
  requireRoles(["vendor_owner", "vendor_admin", "sales"]),
  asyncHandler(async (req, res) => {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({ message: "Template name is required" });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: req.user.vendorId },
    });

    if (!vendor || !vendor.whatsappAccessToken || !vendor.whatsappBusinessId) {
      return res.status(400).json({ message: "Vendor WhatsApp credentials missing" });
    }

    const accessToken = decrypt(vendor.whatsappAccessToken);

    try {
      const url = `https://graph.facebook.com/v24.0/${vendor.whatsappBusinessId}/message_templates?name=${name}`;
      console.log(`🗑️ Deleting Meta-only template: ${name}`);

      const metaResp = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!metaResp.ok) {
        const error = await metaResp.json();
        console.error("Meta Delete Error:", error);
        return res.status(400).json({ message: "Failed to delete from Meta", details: error });
      }

      res.json({ success: true, message: "Deleted from Meta" });
    } catch (error) {
      console.error("Delete Meta Template Error:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  })
);

function mapMetaStatus(status) {
  if (status === 401 || status === 403) return 400; // Bad request (auth invalid)
  return status;
}

/**
 * ===============================
 * CREATE TEMPLATE (DRAFT)
 * ===============================
 */
router.post(
  "/",
  authenticate,
  requireRoles(["vendor_owner", "vendor_admin", "sales"]),
  upload.any(), // Use any() to support dynamic indexed fields for carousel images
  asyncHandler(async (req, res) => {
    console.log("🚀 [TEMPLATE CREATE] Request received");
    console.log("📦 Request Body Keys:", Object.keys(req.body));
    console.log("📂 Request Files count:", req.files ? req.files.length : 0);

    const {
      metaTemplateName,
      displayName,
      category,
      language,
      body,
      footerText,
      buttons = [],
      templateType = 'standard', // 'standard', 'catalog', 'carousel'
    } = req.body;

    console.log("📝 Parsing buttons & catalog products...");

    // Parse buttons if it's a string (FormData)
    let parsedButtons = [];
    try {
      if (typeof req.body.buttons === 'string') {
        parsedButtons = JSON.parse(req.body.buttons);
      } else if (Array.isArray(req.body.buttons)) {
        parsedButtons = req.body.buttons;
      }
    } catch (e) {
      console.error("❌ Error parsing buttons:", e);
      parsedButtons = [];
    }

    // Parse catalogProducts if it's a string
    let parsedCatalogProducts = [];
    try {
      if (typeof req.body.catalogProducts === 'string') {
        parsedCatalogProducts = JSON.parse(req.body.catalogProducts);
      } else if (Array.isArray(req.body.catalogProducts)) {
        parsedCatalogProducts = req.body.catalogProducts;
      }
    } catch (e) {
      console.error("❌ Error parsing catalogProducts:", e);
      parsedCatalogProducts = [];
    }

    // Parse Carousel Cards (if any)
    let carouselCardsData = [];
    if (templateType === 'carousel') {
      try {
        console.log("🎠 Parsing carousel cards...");
        carouselCardsData = JSON.parse(req.body.carouselCards || '[]');
        if (carouselCardsData.length === 0) {
          return res.status(400).json({ message: "At least one card is required for carousel templates" });
        }
      } catch (e) {
        console.error("❌ Error parsing carousel cards:", e);
        return res.status(400).json({ message: "Invalid carousel cards data" });
      }
    }

    if (!metaTemplateName || !category || !language || !body) {
      console.error("❌ Missing required fields:", { metaTemplateName, category, language, body: !!body });
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate catalog template
    if (templateType === 'catalog') {
      if (!Array.isArray(parsedCatalogProducts) || parsedCatalogProducts.length === 0) {
        return res.status(400).json({ message: "At least one product is required for catalog templates" });
      }
      if (parsedCatalogProducts.length > 30) {
        return res.status(400).json({ message: "Maximum 30 products allowed per catalog template" });
      }
    }


    const headerType = req.body["header.type"] || "TEXT";
    // Find header file by fieldname
    const headerFile = req.files?.find(f => f.fieldname === "header.file");

    console.log(`HEADER TYPE: ${headerType}, FILE PRESENT: ${!!headerFile}`);

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
      console.warn("⚠️ Template with this name already exists");
      return res
        .status(409)
        .json({ message: "Template with this name already exists for this vendor." });
    }

    console.log("💾 Creating template in DB...");

    /** TEMPLATE */
    const template = await prisma.template.create({
      data: {
        vendorId: req.user.vendorId,
        metaTemplateName,
        displayName,
        category,
        status: "draft",
        templateType, // Add template type
        createdBy: req.user.id, // 🔒 Track who created this template
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

    /** CAROUSEL CARDS */
    if (templateType === 'carousel' && carouselCardsData.length > 0) {
      for (let i = 0; i < carouselCardsData.length; i++) {
        const card = carouselCardsData[i];
        // Find file by dynamic fieldname
        const imageFile = req.files?.find(f => f.fieldname === `carouselImages_${i}`);

        let s3Url = card.s3Url || null; // Use existing URL if provided
        let mimeType = null;

        if (imageFile) {
          const uploadResult = await uploadTemplateMediaToS3({
            buffer: imageFile.buffer,
            mimeType: imageFile.mimetype,
            vendorId: req.user.vendorId,
            templateId: template.id,
            language,
            extension: imageFile.originalname.split(".").pop(),
            prefix: 'carousel'
          });
          s3Url = uploadResult.url;
          mimeType = imageFile.mimetype;
        }

        await prisma.templateCarouselCard.create({
          data: {
            templateId: template.id,
            title: card.title,
            subtitle: card.subtitle,
            buttonText: card.button?.text,
            buttonValue: card.button?.url,
            buttonType: "URL",
            position: i,
            s3Url: s3Url,
            mimeType: mimeType,
          }
        });
      }
    }


    /** BUTTONS */
    for (let i = 0; i < parsedButtons.length; i++) {
      const btn = parsedButtons[i];

      await prisma.templateButton.create({
        data: {
          templateId: template.id,
          type: btn.type,
          text: btn.text,
          position: i,
          value:
            btn.type === "URL" || btn.type === "PHONE_NUMBER"
              ? btn.value
              : btn.type === "FLOW"
                ? (btn.navigateScreen || btn.value) // Store screen ID for Flow buttons
                : null,
          // Flow button support
          flowId: btn.type === "FLOW" ? btn.flowId : null,
          flowAction: btn.type === "FLOW" ? (btn.flowAction || "navigate") : null,
        },
      });
    }

    /** CATALOG PRODUCTS (for catalog templates) */
    if (templateType === 'catalog' && Array.isArray(parsedCatalogProducts)) {
      for (let i = 0; i < parsedCatalogProducts.length; i++) {
        await prisma.templateCatalogProduct.create({
          data: {
            templateId: template.id,
            productId: parsedCatalogProducts[i],
            position: i,
          },
        });
      }
    }

    await logActivity({
      vendorId: req.user.vendorId,
      status: "created",
      event: "Template Created",
      category: category,
      type: "Template",
      messageId: null,
      whatsappBusinessId: null, // Will be fetched via vendorId inside service
      whatsappPhoneNumberId: null,
      payload: { templateId: template.id, name: metaTemplateName, type: templateType },
    });

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
  upload.any(), // Use any() to support dynamic fields
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      displayName,
      category,
      language: langCode,
      body,
      footerText,
      buttons,
      templateType = 'standard',
    } = req.body;

    // Parse buttons if it's a string (FormData)
    let parsedButtons = [];
    try {
      if (typeof buttons === 'string') {
        parsedButtons = JSON.parse(buttons);
      } else if (Array.isArray(buttons)) {
        parsedButtons = buttons;
      }
    } catch (e) {
      console.error("Error parsing buttons update:", e);
      parsedButtons = [];
    }

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

    // Parse Carousel Cards
    let carouselCardsData = [];
    if (template.templateType === 'carousel' || templateType === 'carousel') {
      try {
        carouselCardsData = JSON.parse(req.body.carouselCards || '[]');
      } catch (e) {
        return res.status(400).json({ message: "Invalid carousel cards data" });
      }
    }

    // Handle Header File
    const headerType = req.body["header.type"] || "TEXT";
    const headerFile = req.files?.find(f => f.fieldname === "header.file");


    // Update Template
    await prisma.template.update({
      where: { id },
      data: {
        displayName,
        category,
        // Update type if changed (rare but possible)
        templateType: template.templateType === 'standard' ? templateType : template.templateType,
        status: "draft",
      },
    });

    // Update Language
    const langId = template.languages.find((l) => l.language === langCode)?.id
      || template.languages[0]?.id;

    if (langId) {
      await prisma.templateLanguage.update({
        where: { id: langId },
        data: {
          language: langCode,
          body,
          footerText,
          headerType,
          headerText: headerType === "TEXT" ? (req.body["header.text"] || req.body.headerText) : null,
          metaStatus: "draft",
        },
      });

      // Handle properties that might need media update
      if (["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType)) {
        if (headerFile) {
          const uploadResult = await uploadTemplateMediaToS3({
            buffer: headerFile.buffer,
            mimeType: headerFile.mimetype,
            vendorId: req.user.vendorId,
            templateId: template.id,
            language: langCode,
            extension: headerFile.originalname.split(".").pop(),
          });

          // Upsert Media
          const existingMedia = await prisma.templateMedia.findFirst({
            where: { templateId: template.id, language: langCode }
          });

          if (existingMedia) {
            await prisma.templateMedia.update({
              where: { id: existingMedia.id },
              data: { s3Url: uploadResult.url, mimeType: headerFile.mimetype, uploadStatus: "pending" }
            });
          } else {
            await prisma.templateMedia.create({
              data: {
                templateId: template.id,
                language: langCode,
                mediaType: headerType.toLowerCase(),
                s3Url: uploadResult.url,
                uploadStatus: "pending",
                mimeType: headerFile.mimetype,
              }
            });
          }
        }
      }
    }

    // Update Carousel Cards (Recreate)
    if ((template.templateType === 'carousel' || templateType === 'carousel') && carouselCardsData.length > 0) {
      await prisma.templateCarouselCard.deleteMany({ where: { templateId: id } });

      for (let i = 0; i < carouselCardsData.length; i++) {
        const card = carouselCardsData[i];
        // Find file by dynamic fieldname
        const imageFile = req.files?.find(f => f.fieldname === `carouselImages_${i}`);

        let s3Url = card.s3Url || null;
        let mimeType = null;

        if (imageFile) {
          const uploadResult = await uploadTemplateMediaToS3({
            buffer: imageFile.buffer,
            mimeType: imageFile.mimetype,
            vendorId: req.user.vendorId,
            templateId: template.id,
            language: langCode,
            extension: imageFile.originalname.split(".").pop(),
            prefix: 'carousel'
          });
          s3Url = uploadResult.url;
          mimeType = imageFile.mimetype;
        }

        await prisma.templateCarouselCard.create({
          data: {
            templateId: template.id,
            title: card.title,
            subtitle: card.subtitle,
            buttonText: card.button?.text,
            buttonValue: card.button?.url,
            buttonType: "URL",
            position: i,
            s3Url: s3Url,
            mimeType: mimeType,
          }
        });
      }
    }

    // Update Buttons (Delete all and recreate)
    await prisma.templateButton.deleteMany({ where: { templateId: id } });

    // Re-create buttons
    // Re-create buttons
    if (parsedButtons && Array.isArray(parsedButtons)) {
      for (let i = 0; i < parsedButtons.length; i++) {
        const btn = parsedButtons[i];
        await prisma.templateButton.create({
          data: {
            templateId: id,
            type: btn.type,
            text: btn.text,
            position: i,
            value: (btn.type === "URL" || btn.type === "PHONE_NUMBER")
              ? btn.value
              : btn.type === "FLOW"
                ? (btn.navigateScreen || btn.value)
                : null,
            // Flow button support
            flowId: btn.type === "FLOW" ? btn.flowId : null,
            flowAction: btn.type === "FLOW" ? (btn.flowAction || "navigate") : null,
          },
        });
      }
    } else if (req.body.buttons) {
      // Handle case where buttons come as separate fields if necessary
    }

    await logActivity({
      vendorId: req.user.vendorId,
      status: "success",
      event: "Template Updated",
      category: category,
      type: "Template",
      messageId: null,
      payload: { templateId: id, name: displayName, type: templateType },
    });

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

    const template = await prisma.template.findUnique({
      where: { id: req.params.id },
      include: {
        vendor: true,
        languages: true,
        buttons: true,
        carouselCards: true, // Fetch carousel cards
      },
    });

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    const language = template.languages[0];
    const headerType = (language.headerType || "TEXT").toUpperCase();
    const accessToken = decrypt(template.vendor.whatsappAccessToken);
    const appId = process.env.META_APP_ID;

    if (!appId) {
      throw new Error("META_APP_ID environment variable is required for template media upload");
    }

    const components = [];

    // PRE-FETCH FLOW IDS IF NEEDED
    const flowButtons = template.buttons.filter(b => b.type === "FLOW" && b.flowId);
    let flowMap = {};
    if (flowButtons.length > 0) {
      const flowIds = flowButtons.map(b => b.flowId);
      const flows = await prisma.whatsAppFlow.findMany({
        where: { id: { in: flowIds } },
        select: { id: true, metaFlowId: true }
      });
      flowMap = Object.fromEntries(flows.map(f => [f.id, f.metaFlowId]));
    }

    console.log("SUBMIT BODY KEYS:", Object.keys(req.body || {}));

    // ===============================
    // 1. CAROUSEL TEMPLATE LOGIC
    // ===============================
    if (template.templateType === 'carousel') {
      // BODY
      const bodyVariables = language.body.match(/{{\d+}}/g) || [];
      const bodyComponent = {
        type: "BODY",
        text: language.body,
      };
      if (bodyVariables.length > 0) {
        bodyComponent.example = { body_text: [bodyVariables.map((_, i) => `Sample${i + 1}`)] };
      }
      components.push(bodyComponent);

      // CAROUSEL COMPONENT
      const cards = [];
      for (const card of template.carouselCards) {
        let headerHandle = null;

        if (card.s3Url) {
          console.log("📥 Downloading carousel card media from S3:", card.s3Url);
          const s3Response = await fetch(card.s3Url);
          if (!s3Response.ok) throw new Error("Failed to download media from S3");

          const buffer = Buffer.from(await s3Response.arrayBuffer());
          const fileName = card.s3Url.split("/").pop() || "card-media";

          headerHandle = await uploadTemplateMediaToMeta({
            accessToken,
            appId,
            buffer,
            mimeType: card.mimeType || 'image/jpeg',
            fileName,
          });

          // Update card with handle
          await prisma.templateCarouselCard.update({
            where: { id: card.id },
            data: { mediaHandle: headerHandle }
          });
        }

        const cardBodyText = [card.title, card.subtitle].filter(Boolean).join("\n");

        const buttonObj = {
          type: "URL",
          text: card.buttonText || "View",
          url: card.buttonValue || "https://example.com"
        };

        // Only add example if the URL has a variable like {{1}}
        if (buttonObj.url && buttonObj.url.includes("{{1}}")) {
          buttonObj.example = ["TRACK123"];
        }

        const format = (card.mimeType && card.mimeType.startsWith('video')) ? "VIDEO" : "IMAGE";

        const cardComponents = [
          {
            type: "HEADER",
            format: format,
            example: { header_handle: [headerHandle] }
          },
          {
            type: "BODY",
            text: cardBodyText || "Card Details",
          },
          {
            type: "BUTTONS",
            buttons: [buttonObj]
          }
        ];
        cards.push({ components: cardComponents });
      }

      components.push({
        type: "CAROUSEL",
        cards: cards
      });

    } else {
      // ===============================
      // 2. STANDARD TEMPLATE LOGIC
      // ===============================

      // HEADER
      let headerHandle = null;
      if (headerType !== "TEXT") {
        const media = await prisma.templateMedia.findFirst({
          where: { templateId: template.id, language: language.language },
        });

        if (!media) throw new Error("Header media missing");

        console.log("📥 Downloading media from S3:", media.s3Url);
        const s3Response = await fetch(media.s3Url);
        if (!s3Response.ok) throw new Error("Failed to download media from S3");

        const buffer = Buffer.from(await s3Response.arrayBuffer());
        const fileName = media.s3Url.split("/").pop() || "header-media";

        headerHandle = await uploadTemplateMediaToMeta({
          accessToken,
          appId,
          buffer,
          mimeType: media.mimeType,
          fileName,
        });

        await prisma.templateMedia.update({
          where: { id: media.id },
          data: { whatsappMediaId: headerHandle, uploadStatus: "uploaded", uploadedAt: new Date() },
        });

        components.push({
          type: "HEADER",
          format: headerType,
          example: { header_handle: [headerHandle] },
        });
      }

      // BODY
      const bodyVariables = language.body.match(/{{\d+}}/g) || [];
      const bodyComponent = {
        type: "BODY",
        text: language.body,
      };
      if (bodyVariables.length > 0) {
        bodyComponent.example = { body_text: [bodyVariables.map((_, i) => `Sample${i + 1}`)] };
      }
      components.push(bodyComponent);

      // FOOTER
      if (language.footerText) {
        components.push({ type: "FOOTER", text: language.footerText });
      }

      // BUTTONS
      if (template.buttons.length) {
        components.push({
          type: "BUTTONS",
          buttons: template.buttons.map((b) => {
            if (b.type === "URL") {
              return { type: "URL", text: b.text, url: b.value, example: ["TRACK123"] };
            }
            if (b.type === "PHONE_NUMBER") {
              return { type: "PHONE_NUMBER", text: b.text, phone_number: b.value };
            }
            if (b.type === "FLOW") {
              const metaFlowId = flowMap[b.flowId];
              // Extract screen ID from navigateScreen (new) or value (old)
              const screenId = b.navigateScreen || b.value;

              console.log(`Processing FLOW button. UUID: ${b.flowId}, MetaID: ${metaFlowId}, Action: ${b.flowAction}, Screen: ${screenId}`);

              if (!metaFlowId) {
                throw new Error(`Validation Failed: The selected Flow (${b.flowId}) has no Meta ID. Ensure the Flow is created and synced correctly.`);
              }

              if (!screenId) {
                throw new Error(`Validation Failed: Navigate screen is required for Flow button. Please specify a valid screen ID.`);
              }

              return {
                type: "FLOW",
                text: b.text,
                flow_id: metaFlowId,
                flow_action: b.flowAction || "navigate",
                navigate_screen: screenId
              };
            }
            return { type: "QUICK_REPLY", text: b.text };
          }),
        });
      }
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

    await logActivity({
      vendorId: template.vendorId,
      status: "success",
      event: "Template Submitted",
      category: template.category,
      type: "Template",
      messageId: null,
      whatsappBusinessId: template.vendor.whatsappBusinessId,
      whatsappPhoneNumberId: template.vendor.whatsappPhoneNumberId,
      payload: { templateId: template.id, metaId: metaData.id },
    });

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
