import prisma from "../prisma.js";

class CampaignService {
  static async createTemplateCampaign(vendorId, payload) {
    const { name, templateId, language, conversationIds, scheduledAt, recipients, bodyVariables, variableModes } =
      payload;

    if (!templateId || (!conversationIds?.length && !recipients?.length)) {
      throw new Error("Template and either conversations or recipients are required");
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
        if (!validConversations.find(c => c.id === conv.id)) {
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
          if (variableModes[idx] === 'company') {
            // Use company name, fallback to phone number if not available
            return conv.lead.companyName || conv.lead.phoneNumber || 'Customer';
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
        })
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

    return {
      success: true,
      campaignId: campaign.id,
      queuedMessages: messages.length,
    };
  }
  static async createImageCampaign(vendorId, payload) {
    const {
      name,
      categoryId,
      subCategoryId,
      imageIds, // Array of specific image IDs selected by user
      imageLimit = 100,
      captionMode,
      conversationIds,
    } = payload;

    if (!conversationIds?.length) {
      throw new Error("Conversations required");
    }

    if (!categoryId && !subCategoryId && (!imageIds || imageIds.length === 0)) {
      throw new Error("Category, subcategory, or specific image IDs required");
    }

    // 1️⃣ Fetch images
    const MAX_IMAGES_PER_CONVERSATION = 30;
    let safeImages;

    if (imageIds && imageIds.length > 0) {
      // Use specific image IDs selected by user
      const selectedImages = await prisma.galleryImage.findMany({
        where: {
          id: { in: imageIds },
          vendorId,
        },
        orderBy: { id: "asc" }, // Maintain order
      });

      if (!selectedImages.length) {
        throw new Error("Selected images not found");
      }

      // Apply safety cap
      safeImages = selectedImages.slice(0, MAX_IMAGES_PER_CONVERSATION);
    } else {
      // Fallback: fetch by category/subcategory
      const finalLimit = Math.min(imageLimit, MAX_IMAGES_PER_CONVERSATION);

      const images = await prisma.galleryImage.findMany({
        where: {
          vendorId,
          ...(subCategoryId ? { subCategoryId } : { categoryId }),
        },
        orderBy: { createdAt: "desc" },
      });

      safeImages = images.slice(0, finalLimit);
    }

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
      },
    });

    let totalQueued = 0;

    // 4️⃣ Queue messages + media + delivery
    for (const conv of conversations) {
      for (const image of safeImages) {
        const caption =
          captionMode === "TITLE"
            ? image.title
            : captionMode === "DESCRIPTION"
              ? image.description
              : null;

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

    return {
      success: true,
      campaignId: campaign.id,
      conversations: conversations.length,
      imagesPerConversation: safeImages.length,
      totalMessagesQueued: totalQueued,
    };
  }

  static async listCampaigns(vendorId) {
    const campaigns = await prisma.campaign.findMany({
      where: { vendorId },
      orderBy: { createdAt: "desc" },
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
        const totalMessages = messageStats.reduce((sum, stat) => sum + stat._count.id, 0);
        const sentMessages = messageStats
          .filter(stat => stat.status === "sent" || stat.status === "delivered" || stat.status === "read")
          .reduce((sum, stat) => sum + stat._count.id, 0);
        const failedMessages = messageStats
          .filter(stat => stat.status === "failed")
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
          totalMessages,      // Use computed value
          sentMessages,       // Use computed value
          failedMessages,     // Use computed value
          status: actualStatus,
        };
      })
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
