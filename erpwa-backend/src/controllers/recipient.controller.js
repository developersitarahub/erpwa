import prisma from "../prisma.js";

/**
 * ✅ 1. GET ALL RECIPIENTS (CONTACTS)
 * Used for: normal recipient listing
 */
export async function getAllRecipients(req, res) {
  try {
    const { categoryId, subcategoryId } = req.query;

    const contacts = await prisma.contact.findMany({
      where: {
        ...(categoryId && { category: Number(categoryId) }),
        ...(subcategoryId && { sub_category: Number(subcategoryId) }),
      },
      orderBy: { created_at: "desc" },
    });

    res.json({
      data: contacts,
    });
  } catch (err) {
    console.error("getAllRecipients error:", err);
    res.status(500).json({ error: "Failed to fetch recipients" });
  }
}

/**
 * ✅ 2. GET SESSION-ACTIVE RECIPIENTS (24H WHATSAPP WINDOW)
 * Used for: image / media campaigns
 */
export async function getSessionActiveRecipients(req, res) {
  try {
    const { categoryId, subcategoryId } = req.query;

    const conversations = await prisma.conversation.findMany({
      where: {
        channel: "whatsapp",
        sessionExpiresAt: {
          gt: new Date(),
        },
        ...(categoryId && {
          lead: {
            categoryId: Number(categoryId),
          },
        }),
        ...(subcategoryId && {
          lead: {
            subCategoryId: Number(subcategoryId),
          },
        }),
      },
      include: {
        lead: {
          include: {
            leadCategory: true,
            leadSubCategory: true,
          },
        },
      },
      orderBy: {
        sessionExpiresAt: "asc",
      },
    });

    res.json({
      data: conversations.map((c) => ({
        id: c.lead.id,
        company_name: c.lead.companyName,
        mobile_number: c.lead.phoneNumber,

        // ✅ NOW COMING FROM Category TABLE
        category_name: c.lead.leadCategory?.name ?? null,
        sub_category_name: c.lead.leadSubCategory?.name ?? null,

        conversationId: c.id,
        sessionExpiresAt: c.sessionExpiresAt,
        sessionActive: true,
      })),
    });
  } catch (err) {
    console.error("getSessionActiveRecipients error:", err);
    res.status(500).json({ error: "Failed to fetch session-active recipients" });
  }
}

