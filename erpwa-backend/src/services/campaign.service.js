import prisma from "../prisma.js";
import { logActivity } from "./activityLog.service.js";

class CampaignService {
  static async createTemplateCampaign(user, payload) {
    const vendorId = user.vendorId;
    const {
      name,
      templateId,
      language,
      conversationIds,
      scheduledAt,
      recipients,
      bodyVariables,
      variableModes,
    } = payload;

    if (!templateId || (!conversationIds?.length && !recipients?.length)) {
      throw new Error(
        "Template and either conversations or recipients are required",
      );
    }

    // 1️⃣ Validate template
    const template = await prisma.template.findFirst({
      where: { id: templateId, vendorId, status: "approved" },
    });

    if (!template) {
      throw new Error("Approved template not found");
    }

    // 2️⃣ Process Recipients (Find/Create Conversations)
    const validConversations = [];

    // Prioritize passed conversationIds if any (for session-based targeting)
    if (conversationIds?.length) {
      const existing = await prisma.conversation.findMany({
        where: {
          id: { in: conversationIds },
          vendorId,
          lead: { blockedAt: null }, // Removed strict opt-in check to allow re-engagement if needed, or keep it strict? Sticking to strict for safety.
        },
        include: { lead: true },
      });
      validConversations.push(...existing);
    }

    // Process raw phone numbers (for marketing outreach)
    if (recipients?.length) {
      for (const phone of recipients) {
        if (!phone) continue;
        const cleanPhone = String(phone).replace(/\D/g, "");

        // Upsert Lead
        // Note: We don't have name/email here, just phone.
        const lead = await prisma.lead.upsert({
          where: {
            vendorId_phoneNumber: {
              vendorId,
              phoneNumber: cleanPhone,
            },
          },
          update: {},
          create: {
            vendorId,
            phoneNumber: cleanPhone,
            whatsappOptIn: true,
            optInSource: "outbound_campaign",
            status: "new",
          },
        });

        if (lead.blockedAt) continue;

        // Upsert Conversation
        const conv = await prisma.conversation.upsert({
          where: {
            vendorId_leadId: {
              vendorId,
              leadId: lead.id,
            },
          },
          update: {},
          create: {
            vendorId,
            leadId: lead.id,
            channel: "whatsapp",
            isOpen: true,
          },
          include: { lead: true },
        });

        // Avoid duplicates if also passed in conversationIds
        if (!validConversations.find((c) => c.id === conv.id)) {
          validConversations.push(conv);
        }
      }
    }

    if (!validConversations.length) {
      throw new Error("No valid recipients or conversations found");
    }

    // 3️⃣ Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        vendorId,
        type: "TEMPLATE",
        templateId,
        name,
        status: scheduledAt ? "scheduled" : "draft",
        scheduledAt,
        createdBy: user.id, // 🔒 Track who created this campaign
      },
    });

    // 4️⃣ Queue messages
    const messages = [];

    for (const conv of validConversations) {
      // Compute per-recipient body variables
      let recipientBodyVariables = bodyVariables;

      // If variableModes is provided, substitute company names where needed
      if (variableModes && variableModes.length > 0) {
        recipientBodyVariables = bodyVariables.map((val, idx) => {
          if (variableModes[idx] === "company") {
            // Use company name, fallback to phone number if not available
            return conv.lead.companyName || conv.lead.phoneNumber || "Customer";
          }
          return val;
        });
      }

      messages.push(
        prisma.message.create({
          data: {
            vendorId,
            conversationId: conv.id,
            campaignId: campaign.id,
            direction: "outbound",
            channel: "whatsapp",
            messageType: "template",
            status: "queued",
            outboundPayload: {
              templateId,
              language,
              bodyVariables: recipientBodyVariables,
            },
          },
        }),
      );
    }

    await Promise.all(messages);

    // ✅ Update campaign stats
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        totalMessages: messages.length,
        status: scheduledAt ? "scheduled" : "active", // Auto-activate if not scheduled
      },
    });

    // 📝 Log campaign creation
    await logActivity({
      vendorId,
      status: "success",
      event: "Campaign Created",
      type: "Template Campaign",
      payload: {
        campaignId: campaign.id,
        campaignName: name,
        type: "TEMPLATE",
        recipientCount: validConversations.length,
        scheduledAt: scheduledAt
      }
    });

    return {
      success: true,
      campaignId: campaign.id,
      queuedMessages: messages.length,
    };
  }
  static async createImageCampaign(user, payload) {
    const vendorId = user.vendorId;
    const {
      name,
      categoryId,
      subCategoryId,
      imageLimit = 100,
      captionMode,
      conversationIds,
      imageIds, // ✅ Extract imageIds
    } = payload;

    if (!conversationIds?.length) {
      throw new Error("Conversations required");
    }

    if (!categoryId && !subCategoryId) {
      throw new Error("Category or subcategory required");
    }

    // 1️⃣ Fetch images
    const MAX_IMAGES_PER_CONVERSATION = 30;
    const finalLimit = Math.min(imageIds?.length || imageLimit, MAX_IMAGES_PER_CONVERSATION);

    const where = {
      vendorId,
    };

    // If specific images selected, use them. Otherwise fallback to category
    if (imageIds && imageIds.length > 0) {
      where.id = { in: imageIds };
    } else {
      if (subCategoryId) where.subCategoryId = subCategoryId;
      else where.categoryId = categoryId;
    }

    // Fetch images
    const images = await prisma.galleryImage.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // 🚨 HARD SAFETY CAP
    const safeImages = images.slice(0, finalLimit);

    if (!safeImages.length) {
      throw new Error("No images found");
    }

    // 2️⃣ Fetch conversations (session active only)
    const now = new Date();

    const conversations = await prisma.conversation.findMany({
      where: {
        id: { in: conversationIds },
        vendorId,
        sessionExpiresAt: { gt: now },
        lead: {
          whatsappOptIn: true,
          blockedAt: null,
        },
      },
      include: { lead: true },
    });

    if (!conversations.length) {
      throw new Error("No session-active conversations");
    }

    // 3️⃣ Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        vendorId,
        type: "IMAGE",
        categoryId,
        subCategoryId,
        imageLimit,
        captionMode,
        name,
        status: "draft",
        createdBy: user.id, // 🔒 Track who created this campaign
      },
    });

    let totalQueued = 0;

    // 4️⃣ Queue messages + media + delivery
    for (const conv of conversations) {
      for (const image of safeImages) {
        let caption = null;

        if (captionMode === "TITLE") {
          caption = image.title;
        } else if (captionMode === "DESCRIPTION") {
          caption = image.description;
        } else if (captionMode === "FULL") {
          // Build a comprehensive caption with all available information
          const parts = [];

          if (image.title) {
            parts.push(`*${image.title}*`);
          }

          if (image.description) {
            parts.push(image.description);
          }

          if (image.price) {
            const currency = image.priceCurrency || "USD";
            const priceSymbol =
              currency === "INR" ? "₹" : currency === "USD" ? "$" : currency;
            parts.push(`\n💰 Price: ${priceSymbol}${image.price}`);
          }

          caption = parts.length > 0 ? parts.join("\n\n") : null;
        }

        const message = await prisma.message.create({
          data: {
            vendorId,
            conversationId: conv.id,
            campaignId: campaign.id,
            direction: "outbound",
            channel: "whatsapp",
            messageType: "image",
            status: "queued",
          },
        });

        const media = await prisma.messageMedia.create({
          data: {
            messageId: message.id,
            mediaType: "image",
            mimeType: "image/jpeg",
            mediaUrl: image.s3Url,
            caption,
          },
        });

        await prisma.messageDelivery.create({
          data: {
            messageId: message.id,
            messageMediaId: media.id,
            conversationId: conv.id,
            status: "queued",
          },
        });

        totalQueued++;
      }
    }

    // ✅ Update campaign stats
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        totalMessages: totalQueued,
        status: "active", // Auto-activate
      },
    });

    // 📝 Log campaign creation
    await logActivity({
      vendorId,
      status: "success",
      event: "Campaign Created",
      type: "Image Campaign",
      payload: {
        campaignId: campaign.id,
        campaignName: name,
        type: "IMAGE",
        recipientCount: conversations.length,
        imageCount: safeImages.length
      }
    });

    return {
      success: true,
      campaignId: campaign.id,
      conversations: conversations.length,
      imagesPerConversation: images.length,
      totalMessagesQueued: totalQueued,
    };
  }

  static async listCampaigns(user) {
    const vendorId = user.vendorId;
    const where = { vendorId };

    // 🔒 ROLE-BASED FILTERING: Sales users only see their own campaigns
    if (user.role === "sales") {
      where.createdBy = user.id;
    }

    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { template: true },
    });

    // Enrich with actual message stats from Message table
    const enriched = await Promise.all(
      campaigns.map(async (c) => {
        // Count distinct conversations (recipients)
        const recipients = await prisma.message.groupBy({
          by: ["conversationId"],
          where: { campaignId: c.id },
        });

        // Count messages by status (compute actual sent/failed counts)
        const messageStats = await prisma.message.groupBy({
          by: ["status"],
          where: { campaignId: c.id },
          _count: { id: true },
        });

        // Calculate totals from actual database
        const totalMessages = messageStats.reduce(
          (sum, stat) => sum + stat._count.id,
          0,
        );
        const sentMessages = messageStats
          .filter(
            (stat) =>
              stat.status === "sent" ||
              stat.status === "delivered" ||
              stat.status === "read",
          )
          .reduce((sum, stat) => sum + stat._count.id, 0);
        const failedMessages = messageStats
          .filter((stat) => stat.status === "failed")
          .reduce((sum, stat) => sum + stat._count.id, 0);

        // Determine actual status based on real message completion
        let actualStatus = c.status;

        if (totalMessages > 0) {
          // If all messages are sent/failed, mark as completed
          if (sentMessages + failedMessages >= totalMessages) {
            actualStatus = "completed";
          }
          // If NO messages sent yet, mark as pending (in queue, worker not started)
          else if (sentMessages === 0 && failedMessages === 0) {
            actualStatus = "pending";
          }
          // If some messages sent, mark as active (worker is processing)
          else if (sentMessages > 0) {
            actualStatus = "active";
          }
          // If scheduled for future
          else if (c.scheduledAt && new Date(c.scheduledAt) > new Date()) {
            actualStatus = "scheduled";
          }
        }

        return {
          ...c,
          recipientCount: recipients.length,
          totalMessages, // Use computed value
          sentMessages, // Use computed value
          failedMessages, // Use computed value
          status: actualStatus,
        };
      }),
    );

    // Sort by status priority: Active > Pending > Draft > Completed
    const statusPriority = {
      active: 1,
      scheduled: 2,
      pending: 2,
      draft: 3,
      completed: 4,
      failed: 5,
    };

    return enriched.sort((a, b) => {
      const pA = statusPriority[a.status] || 99;
      const pB = statusPriority[b.status] || 99;
      if (pA !== pB) return pA - pB;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }
}

export default CampaignService;
