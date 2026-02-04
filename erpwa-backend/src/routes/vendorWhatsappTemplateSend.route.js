import express from "express";
import fetch from "node-fetch";
import prisma from "../prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/requireRole.middleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { decrypt } from "../utils/encryption.js";
import { getIO } from "../socket.js";

const router = express.Router();

router.post(
  "/send-template",
  authenticate,
  requireRoles(["vendor_owner", "vendor_admin", "sales"]),
  asyncHandler(async (req, res) => {
    const {
      recipients = [],
      templateId,
      bodyVariables = [],
      buttonVariables = [],
      customMessages = [],
    } = req.body;

    if ((!recipients.length && !customMessages.length) || !templateId) {
      return res.status(400).json({ message: "Invalid request" });
    }

    /** 1️⃣ Vendor */
    const vendor = await prisma.vendor.findUnique({
      where: { id: req.user.vendorId },
    });

    if (!vendor?.whatsappPhoneNumberId || !vendor?.whatsappAccessToken) {
      return res.status(400).json({ message: "WhatsApp not configured" });
    }

    const accessToken = decrypt(vendor.whatsappAccessToken);

    /** 2️⃣ Template */
    const templateRaw = await prisma.template.findUnique({
      where: { id: templateId },
      include: {
        languages: true,
        buttons: true,
        carouselCards: {
          orderBy: { position: 'asc' }
        }
      },
    });

    if (!templateRaw) {
      return res.status(404).json({ message: "Template not found" });
    }

    if (templateRaw.status !== "approved") {
      return res.status(400).json({ message: `Template is not approved (Status: ${templateRaw.status})` });
    }

    const approvedLanguage = templateRaw.languages.find(l => l.metaStatus === "approved");

    if (!approvedLanguage) {
      return res.status(400).json({ message: "No approved language version found for this template" });
    }

    // Use the raw template but with the filtered language for compatibility with existing code
    const template = {
      ...templateRaw,
      languages: [approvedLanguage]
    };

    const language = approvedLanguage;

    /** 3️⃣ Load header media (if any) */
    let media = null;

    if (language.headerType && language.headerType !== "TEXT" && template.templateType !== 'carousel' && template.templateType !== 'catalog') {
      media = await prisma.templateMedia.findFirst({
        where: {
          templateId: template.id,
          language: language.language,
        },
      });

      if (!media?.s3Url) {
        console.warn(`⚠️ Header media record or S3 URL missing for template ${template.displayName} (${language.headerType}). Proceeding without header component.`);
      }
    }

    /** 4️⃣ Prepare messages */
    let messagesToSend = [];

    // Check if we have custom messages (per-recipient variables)
    if (customMessages && Array.isArray(customMessages) && customMessages.length > 0) {
      messagesToSend = customMessages;
    } else {
      // Default: same variables for all recipients
      messagesToSend = recipients.map((to) => ({
        to,
        bodyVariables,
        buttonVariables,
      }));
    }

    const results = [];

    /** 5️⃣ Send to recipients */
    for (const msg of messagesToSend) {
      const { to: rawTo, bodyVariables: msgBodyVars, buttonVariables: msgButtonVars } = msg;

      // Use message specific variables or fall back to global ones
      const currentBodyVars = msgBodyVars || bodyVariables;
      const currentButtonVars = msgButtonVars || buttonVariables;

      const to = String(rawTo).replace(/\D/g, ""); // Remove non-digits

      /** 🛡️ ROLE-BASED CHECK */
      if (req.user.role === "sales") {
        const existingLead = await prisma.lead.findFirst({
          where: { vendorId: vendor.id, phoneNumber: to },
        });

        if (
          existingLead &&
          existingLead.salesPersonName &&
          existingLead.salesPersonName !== req.user.name
        ) {
          results.push({
            to,
            success: false,
            error: "Lead is assigned to another sales person",
          });
          continue;
        }
      }

      try {
        const components = [];

        /** 🔹 HEADER (MEDIA ONLY) */
        if (media?.s3Url) {
          components.push({
            type: "header",
            parameters: [
              {
                type: media.mediaType,
                [media.mediaType]: {
                  link: media.s3Url,
                },
              },
            ],
          });
        }

        /** 🔹 BODY */
        if (currentBodyVars && currentBodyVars.length) {
          components.push({
            type: "body",
            parameters: currentBodyVars.map((v) => ({
              type: "text",
              text: String(v),
            })),
          });
        }

        /** 🔹 CAROUSEL */
        if (template.templateType === 'carousel' && template.carouselCards?.length > 0) {
          const carouselCardsPayload = template.carouselCards.map((card, index) => {
            const mediaType = (card.mimeType && card.mimeType.startsWith('video')) ? "VIDEO" : "IMAGE";
            return {
              card_index: index,
              components: [
                {
                  type: "HEADER",
                  parameters: [
                    {
                      type: mediaType.toLowerCase(),
                      [mediaType.toLowerCase()]: {
                        link: card.s3Url
                      }
                    }
                  ]
                }
              ]
            }
          });

          components.push({
            type: "CAROUSEL",
            cards: carouselCardsPayload
          });
        }

        /** 🔹 BUTTONS */
        if (template.templateType !== 'carousel') {
          // Check if we have FLOW buttons
          const flowButton = template.buttons?.find(btn => btn.type === "FLOW");

          if (flowButton && flowButton.flowId) {
            // Get the Flow details
            const flow = await prisma.whatsAppFlow.findUnique({
              where: { id: flowButton.flowId },
              select: { metaFlowId: true, status: true }
            });

            if (flow) {
              components.push({
                type: "button",
                sub_type: "flow",
                index: String(flowButton.position),
                parameters: [
                  {
                    type: "action",
                    action: {
                      // Embed Flow ID for tracking response linking
                      flow_token: `${flowButton.flowId}_${to}_${Date.now()}`,
                      flow_action_data: {},
                    },
                  },
                ],
              });
            }
          } else if (currentButtonVars && currentButtonVars.length) {
            // Handle URL buttons (existing logic)
            currentButtonVars.forEach((v, index) => {
              components.push({
                type: "button",
                sub_type: "url",
                index: String(index),
                parameters: [{ type: "text", text: String(v) }],
              });
            });
          }
        }


        /** 🔹 SEND TO WHATSAPP */
        const metaResp = await fetch(
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
              type: "template",
              template: {
                name: template.metaTemplateName,
                language: { code: language.language },
                components,
              },
            }),
          }
        );

        const metaData = await metaResp.json();

        if (!metaResp.ok) throw metaData;

        const whatsappMessageId = metaData.messages?.[0]?.id;

        // 📝 RECONSTRUCT MESSAGE CONTENT (for inbox display)
        let content = language.body;
        if (currentBodyVars && currentBodyVars.length) {
          currentBodyVars.forEach((v, i) => {
            content = content.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, "g"), String(v));
          });
        }

        // 👤 SYNC LEAD (Ensure lead exists for inbox)
        const lead = await prisma.lead.upsert({
          where: {
            vendorId_phoneNumber: {
              vendorId: vendor.id,
              phoneNumber: to,
            },
          },
          update: {
            lastContactedAt: new Date(),
            ...(req.user.role === "sales" && {
              salesPersonName: req.user.name,
              salesPersonId: req.user.id,
            }), // Auto-assign if sending
          },
          create: {
            vendorId: vendor.id,
            phoneNumber: to,
            whatsappOptIn: true,
            optInSource: "outbound_template",
            optInAt: new Date(),
            ...(req.user.role === "sales" && {
              salesPersonName: req.user.name,
              salesPersonId: req.user.id,
            }),
          },
        });

        // 💬 SYNC CONVERSATION
        const conversation = await prisma.conversation.upsert({
          where: {
            vendorId_leadId: {
              vendorId: vendor.id,
              leadId: lead.id,
            },
          },
          update: { lastMessageAt: new Date(), isOpen: true },
          create: {
            vendorId: vendor.id,
            leadId: lead.id,
            channel: "whatsapp",
            isOpen: true,
            lastMessageAt: new Date(),
          },
        });

        // 💾 PERSIST MESSAGE
        const message = await prisma.message.create({
          data: {
            vendorId: vendor.id,
            conversationId: conversation.id,
            senderId: req.user.id,
            direction: "outbound",
            channel: "whatsapp",
            messageType: media ? media.mediaType : "template",
            content,
            whatsappMessageId,
            status: "sent",
            outboundPayload: {
              ...metaData,
              template: {
                name: template.displayName,
                footer: language.footerText,
                name: template.displayName,
                footer: language.footerText,
                buttons: template.buttons || [],
                carouselCards: template.carouselCards || [] // ✅ Persist carousel cards
              },
              templateId: template.id, // ✅ CRITICAL: Save templateId for enrichment
              templateType: template.templateType // ✅ Save type
            },
          },
        });

        // 🖼 IF MEDIA EXISTS, SAVE MessageMedia
        if (media) {
          await prisma.messageMedia.create({
            data: {
              messageId: message.id,
              mediaType: media.mediaType === "IMAGE" ? "image" : media.mediaType === "VIDEO" ? "video" : media.mediaType === "DOCUMENT" ? "document" : "image",
              mimeType: media.mimeType || "image/jpeg",
              mediaUrl: media.s3Url,
            },
          });
        }

        // 🔥 EMIT SOCKET REALTIME
        try {
          const io = getIO();
          io.to(`conversation:${conversation.id}`).emit("message:new", {
            id: message.id,
            whatsappMessageId,
            text: content,
            sender: "executive",
            timestamp: message.createdAt.toISOString(),
            status: "sent",
            // Include media info if exists
            ...(media && {
              mediaUrl: media.s3Url,
              mimeType: media.mimeType || "image/jpeg",
            }),
            // Template specific metadata
            template: {
              footer: language.footerText,
              footer: language.footerText,
              buttons: template.buttons || [],
              carouselCards: template.carouselCards || [] // ✅ Socket: Send cards
            },
            templateType: template.templateType || "standard", // ✅ Socket: Send type
            carouselCards: template.carouselCards || [] // ✅ Socket: Send cards (top level for compatibility)
          });

          io.to(`vendor:${vendor.id}`).emit("inbox:update", {
            conversationId: conversation.id,
          });
        } catch (err) {
          console.error("Socket emission failed for template send:", err);
        }

        results.push({ to, success: true });
      } catch (err) {
        results.push({
          to,
          success: false,
          error: err?.error?.message || err,
        });
        console.error(`Failed to send template to ${to}:`, err);
      }
    }

    res.json({ success: true, results });
  })
);

export default router;
