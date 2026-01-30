import prisma from "../prisma.js";
import {
  sendWhatsAppImage,
  sendWhatsAppTemplate,
} from "../services/whatsappCampaign.service.js"; // Import both
import { decrypt } from "../utils/encryption.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_RETRIES = 2;
const SEND_DELAY = 1000;

function log(level, message, meta = {}) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level,
      message,
      ...meta,
    })
  );
}

export async function processWhatsappQueue() {
  log("info", "WhatsApp Worker (Image & Template) started");

  while (true) {
    // 1️⃣ Pick next queued message (either image or template)
    const message = await prisma.message.findFirst({
      where: {
        status: "queued",
        messageType: { in: ["image", "template"] },
        retryCount: { lt: MAX_RETRIES },
      },
      orderBy: { createdAt: "asc" },
      include: {
        vendor: true,
        conversation: { include: { lead: true } },
        media: true, // For image messages
      },
    });

    if (!message) {
      await sleep(2000);
      continue;
    }

    // 2️⃣ Lock message (prevent double sending)
    const locked = await prisma.message.updateMany({
      where: { id: message.id, status: "queued" },
      data: { status: "processing" },
    });

    if (locked.count === 0) continue;

    try {
      const { vendor, conversation } = message;

      // 3️⃣ Common Validation
      if (!vendor.whatsappPhoneNumberId || !vendor.whatsappAccessToken) {
        throw new Error("WhatsApp not configured for vendor");
      }

      const accessToken = decrypt(vendor.whatsappAccessToken);
      const raw = conversation.lead.phoneNumber.replace(/\D/g, "");
      const to = raw.startsWith("91") ? raw : `91${raw}`;

      let whatsappMsgId;

      // 4️⃣ Dispatch based on message type
      if (message.messageType === "image") {
        whatsappMsgId = await processImageMessage(message, accessToken, to, vendor);
      } else if (message.messageType === "template") {
        whatsappMsgId = await processTemplateMessage(message, accessToken, to, vendor);
      } else {
        throw new Error(`Unsupported message type: ${message.messageType}`);
      }

      // 5️⃣ FINAL COMMIT (Success)
      await prisma.$transaction(async (tx) => {
        // ✅ Update message
        await tx.message.update({
          where: { id: message.id },
          data: {
            status: "sent",
            whatsappMessageId: whatsappMsgId,
            updatedAt: new Date(),
          },
        });

        // ✅ Update ALL deliveries
        await tx.messageDelivery.updateMany({
          where: { messageId: message.id },
          data: {
            status: "sent",
            whatsappMsgId,
          },
        });

        // ✅ Update conversation ordering
        await tx.conversation.update({
          where: { id: message.conversationId },
          data: {
            lastMessageAt: new Date(),
          },
        });

        // ✅ Update Campaign Stats (Increment sent count) - Unified for both
        if (message.campaignId) {
          await tx.campaign.update({
            where: { id: message.campaignId },
            data: {
              sentMessages: { increment: 1 },
            },
          });
        }
      });

      log("success", `WhatsApp ${message.messageType} sent successfully`, {
        messageId: message.id,
        whatsappMsgId,
      });

      await sleep(SEND_DELAY);
    } catch (err) {
      const retries = message.retryCount + 1;
      const metaError = err.response?.data?.error;

      log("error", "WhatsApp send failed", {
        messageId: message.id,
        type: message.messageType,
        attempt: retries,
        httpStatus: err.response?.status,
        metaCode: metaError?.code,
        metaMessage: metaError?.message || err.message,
      });

      // 🔴 Disable vendor if token invalid
      if (metaError?.code === 190) {
        await prisma.vendor.update({
          where: { id: message.vendorId },
          data: {
            whatsappStatus: "error",
            whatsappLastError: metaError.message,
          },
        });
      }

      // 6️⃣ Retry or fail message
      await prisma.$transaction([
        prisma.message.update({
          where: { id: message.id },
          data: {
            retryCount: retries,
            status: retries >= MAX_RETRIES ? "failed" : "queued",
            errorCode: metaError?.code?.toString() || err.message,
          },
        }),
        prisma.messageDelivery.updateMany({
          where: { messageId: message.id },
          data: {
            status: retries >= MAX_RETRIES ? "failed" : "queued",
            error: metaError?.message || err.message,
          },
        }),
        // Increment failed count on campaign if final failure
        ...(retries >= MAX_RETRIES && message.campaignId
          ? [
            prisma.campaign.update({
              where: { id: message.campaignId },
              data: { failedMessages: { increment: 1 } },
            }),
          ]
          : []),
      ]);

      await sleep(3000);
    }
  }
}

async function processImageMessage(message, accessToken, to, vendor) {
  const media = message.media?.[0];
  if (!media) throw new Error("Media not found");

  log("info", "Sending WhatsApp image", {
    messageId: message.id,
    to,
    mediaUrl: media.mediaUrl,
  });

  const result = await sendWhatsAppImage({
    phoneNumberId: vendor.whatsappPhoneNumberId,
    accessToken,
    to,
    imageUrl: media.mediaUrl,
    caption: media.caption,
  });

  return result.messages?.[0]?.id;
}

async function processTemplateMessage(message, accessToken, to, vendor) {
  const { outboundPayload } = message;
  
  if (!outboundPayload || !outboundPayload.templateId) {
    throw new Error("Missing template payload");
  }

  const { templateId, language } = outboundPayload;

  // Fetch full template details for media/buttons
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: {
      languages: { where: { language: language } },
      buttons: true,
      media: { where: { language: language } },
      catalogProducts: { orderBy: { position: "asc" } },
      carouselCards: { orderBy: { position: "asc" } },
    },
  });

  if (!template) throw new Error("Template not found");
  const templateLang = template.languages[0];
  if (!templateLang) throw new Error("Template language not found");

  // Construct WhatsApp Components
  const components = [];

  // 1. CATALOG TEMPLATE (MPM)
  // Check explicit type OR presence of products
  const isCatalog = template.templateType === "catalog" || template.catalogProducts.length > 0;

  if (isCatalog && template.catalogProducts.length > 0) {
    // For Catalog templates, we must specify the thumbnail product
    components.push({
      type: "button",
      sub_type: "CATALOG",
      index: 0,
      parameters: [
        {
          type: "action",
          action: {
            thumbnail_product_retailer_id: template.catalogProducts[0].productId,
          },
        },
      ],
    });
  }

  // 2. CAROUSEL TEMPLATE (Marketing)
  // Check explicit type OR presence of cards
  const isCarousel = template.templateType === "carousel" || template.carouselCards.length > 0;

  if (isCarousel && template.carouselCards.length > 0) {
    // Construct the Carousel Component
    // We assume the card headers are dynamic variables (Handles/URLs) in the template definition
    const cards = template.carouselCards.map((card, index) => {
      // Each card must have components if it has variables
      // We assume strict matching requires the Header Image for each card
      const cardComponents = [];

      // Add Header Image (if exists)
      if (card.s3Url) {
        cardComponents.push({
          type: "header",
          parameters: [
            {
              type: "image",
              image: {
                link: card.s3Url,
              },
            },
          ],
        });
      }

      return {
        card_index: index,
        components: cardComponents,
      };
    });

    components.push({
      type: "carousel",
      cards: cards,
    });
  }

  // 3. STANDARD HEADER (Image/Video/Doc)
  // CRITICAL: Skip if Carousel or Catalog to avoid 132012 format error
  // Carousels do not accept standard header components in the same way.
  if (!isCarousel && !isCatalog) {
    if (
      templateLang.headerType &&
      templateLang.headerType !== "TEXT"
    ) {
      const media = template.media[0];
      if (media?.s3Url) {
        components.push({
          type: "header",
          parameters: [
            {
              type: media.mediaType.toLowerCase(), // IMAGE, VIDEO, DOCUMENT
              [media.mediaType.toLowerCase()]: {
                link: media.s3Url,
              },
            },
          ],
        });
      }
    }
  }

  // Debug Log
  log("info", "Constructed Template Components", {
    messageId: message.id,
    templateName: template.metaTemplateName,
    templateType: template.templateType,
    isCarousel,
    isCatalog,
    components,
  });

  // B. Body
  if (outboundPayload.bodyVariables && outboundPayload.bodyVariables.length > 0) {
    components.push({
      type: "body",
      parameters: outboundPayload.bodyVariables.map((v) => ({
        type: "text",
        text: String(v),
      })),
    });
  }

  log("info", "Sending WhatsApp template", {
    messageId: message.id,
    to,
    templateName: template.metaTemplateName,
  });

  const result = await sendWhatsAppTemplate({
    phoneNumberId: vendor.whatsappPhoneNumberId,
    accessToken,
    to,
    templateName: template.metaTemplateName,
    languageCode: language,
    components,
  });

  return result.messages?.[0]?.id;
}
