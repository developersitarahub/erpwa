import prisma from "../prisma.js";
import { getIO } from "../socket.js";

/**
 * Log a system or WhatsApp activity
 */
export async function logActivity({
    vendorId,
    whatsappBusinessId,   // New
    whatsappPhoneNumberId, // New
    conversationId,
    messageId,
    phoneNumber,
    type,
    status,
    event,
    category,
    error,
    payload,
    direction,
    responseCode,
    processingMs,
}) {
    try {
        // 1. Resolve IDs if missing but vendorId is present
        let dbVendorId = vendorId;
        let dbWabaId = whatsappBusinessId;
        let dbPhoneId = whatsappPhoneNumberId;

        if (vendorId && (!dbWabaId || !dbPhoneId)) {
            const vendor = await prisma.vendor.findUnique({
                where: { id: vendorId },
                select: { whatsappBusinessId: true, whatsappPhoneNumberId: true }
            });
            if (vendor) {
                if (!dbWabaId) dbWabaId = vendor.whatsappBusinessId;
                if (!dbPhoneId) dbPhoneId = vendor.whatsappPhoneNumberId;
            }
        }

        // 2. Determine Message Type & Conversation Context
        let messageType = type;
        let dbConversationId = conversationId;
        let dbPhoneNumber = phoneNumber;

        // Check if we already have a log for this WAMID to inherit data
        // (Only relevant for recurring webhook events on same message)
        let existingLog = null;
        if (messageId) {
            // Wait slightly if status is not initial creation to allow race condition handling
            if (!["sent", "received", "created", "started"].includes(status)) {
                await new Promise((resolve) => setTimeout(resolve, 500));
            }

            existingLog = await prisma.activityLog.findFirst({
                where: { messageId: messageId },
            });

            if (existingLog) {
                // Inherit connection details
                if (!category) category = existingLog.category;
                if (!dbVendorId) dbVendorId = existingLog.vendorId;
                if (!dbConversationId) dbConversationId = existingLog.conversationId;
                if (!dbPhoneNumber) dbPhoneNumber = existingLog.phoneNumber;
                if (!messageType) messageType = existingLog.type;

                // Inherit WABA/Phone IDs if missing
                if (!dbWabaId) dbWabaId = existingLog.whatsappBusinessId;
                if (!dbPhoneId) dbPhoneId = existingLog.whatsappPhoneNumberId;
            }
        }

        // 2.5 Resolve details from Message table if missing or generic
        if (!messageType || !dbConversationId || !dbVendorId || messageType === "system_event") {
            try {
                // Determine if this is a WAMID (usually distinct from internal UUIDs, but safety first)
                if (messageId) {
                    const message = await prisma.message.findFirst({
                        where: { whatsappMessageId: messageId },
                        include: {
                            campaign: true,
                            conversation: {
                                include: {
                                    lead: { select: { leadCategory: true, categoryId: true, companyName: true, phoneNumber: true } }
                                }
                            }
                        }
                    });

                    if (message) {
                        // Inherit IDs
                        if (!dbConversationId) dbConversationId = message.conversationId;
                        if (!dbVendorId) dbVendorId = message.vendorId;
                        if (!dbPhoneNumber) dbPhoneNumber = message.conversation?.lead?.phoneNumber;

                        // Inherit Category
                        if (!category && message.conversation?.lead?.leadCategory?.name) {
                            category = message.conversation.lead.leadCategory.name;
                        }

                        // Determine Type
                        if (message.campaign) {
                            // It's a Campaign Message
                            if (message.campaign.type === "IMAGE") messageType = "Image Campaign";
                            else if (message.campaign.type === "TEMPLATE") messageType = "Template Campaign";
                            else messageType = "Campaign";
                        } else {
                            // It's a Regular Message
                            const rawType = message.messageType || "text";
                            // Capitalize first letter (e.g. "image" -> "Image Message")
                            const typeName = rawType.charAt(0).toUpperCase() + rawType.slice(1);
                            messageType = `${typeName} Message`;
                        }
                    }
                }
            } catch (err) {
                console.error("Error resolving message details for log:", err.message);
            }
        }

        // Fallback type
        if (!messageType) {
            messageType = "system_event";
        }

        // 3. Determine Final Status
        let finalStatus = status;
        if (error && !["read", "delivered", "sent", "received", "created", "started", "completed"].includes(status)) {
            finalStatus = "failed";
        }

        // 4. Construct Payload
        const dataPayload = {
            status: finalStatus,
            event: event || existingLog?.event || "operation",
            error: error || null,
            payload: payload,

            vendorId: dbVendorId,
            whatsappBusinessId: dbWabaId,
            whatsappPhoneNumberId: dbPhoneId,

            conversationId: dbConversationId,
            phoneNumber: dbPhoneNumber,
            type: messageType,
            category: category,
            direction: direction || existingLog?.direction,
            responseCode: responseCode || existingLog?.responseCode,
            processingMs: (existingLog?.processingMs || 0) + (processingMs || 0),
        };

        let activityLog;
        if (messageId && existingLog) {
            // ✅ UPDATE existing log
            activityLog = await prisma.activityLog.update({
                where: { id: existingLog.id },
                data: dataPayload,
            });
        } else {
            // ✅ CREATE new log
            activityLog = await prisma.activityLog.create({
                data: {
                    ...dataPayload,
                    messageId, // Ensure messageId is set
                },
            });
        }

        // 🔥 Emit real-time update
        try {
            const io = getIO();
            // Emit strictly to vendor room if ID exists
            if (dbVendorId) {
                io.to(`vendor:${dbVendorId}`).emit("activity-log:new", {
                    ...activityLog,
                    createdAt: activityLog.createdAt.toISOString(),
                });
            }
        } catch { }

        return activityLog;
    } catch (err) {
        console.error("❌ Failed to log activity:", err.message);
    }
}
