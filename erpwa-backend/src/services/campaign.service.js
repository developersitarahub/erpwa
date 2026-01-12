import prisma from "../prisma.js";

class CampaignService {
  static async createTemplateCampaign(vendorId, payload) {
    const { name, templateId, language, conversationIds, scheduledAt } =
      payload;

    if (!templateId || !conversationIds?.length) {
      throw new Error("Template and conversations are required");
    }

    // 1️⃣ Validate template
    const template = await prisma.template.findFirst({
      where: { id: templateId, vendorId, status: "approved" },
    });

    if (!template) {
      throw new Error("Approved template not found");
    }

    // 2️⃣ Validate conversations + leads
    const conversations = await prisma.conversation.findMany({
      where: {
        id: { in: conversationIds },
        vendorId,
        lead: {
          whatsappOptIn: true,
          blockedAt: null,
        },
      },
      include: { lead: true },
    });

    if (!conversations.length) {
      throw new Error("No valid conversations found");
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

    for (const conv of conversations) {
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
            },
          },
        })
      );
    }

    await Promise.all(messages);

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
      imageLimit = 100,
      captionMode,
      conversationIds,
    } = payload;

    if (!conversationIds?.length) {
      throw new Error("Conversations required");
    }

    if (!categoryId && !subCategoryId) {
      throw new Error("Category or subcategory required");
    }

    // 1️⃣ Fetch images
    const MAX_IMAGES_PER_CONVERSATION = 30;

    // Fetch all images (no take here)
    const images = await prisma.galleryImage.findMany({
      where: {
        vendorId,
        ...(subCategoryId ? { subCategoryId } : { categoryId }),
      },
      orderBy: { createdAt: "desc" },
    });

    // 🚨 HARD SAFETY CAP
    const safeImages = images.slice(0, MAX_IMAGES_PER_CONVERSATION);

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
      for (const image of images) {
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

    return {
      success: true,
      campaignId: campaign.id,
      conversations: conversations.length,
      imagesPerConversation: images.length,
      totalMessagesQueued: totalQueued,
    };
  }
}

export default CampaignService;
