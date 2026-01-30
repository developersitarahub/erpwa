import express from "express";
import prisma from "../prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

/* ===============================
   GET ACTIVITY LOGS (Admin/Owner only)
=============================== */
router.get("/", authenticate, async (req, res) => {
    try {
        const { role, vendorId } = req.user;

        console.log("📋 Fetching activity logs for user:", {
            vendorId,
            role,
            userId: req.user.id,
        });

        // 🔐 Only allow admin and owner roles
        if (!["vendor_owner", "vendor_admin", "owner"].includes(role)) {
            return res.status(403).json({ message: "Access denied" });
        }

        const {
            page = 1,
            limit = 50,
            status,
            event,
            type,
            search,
            startDate,
            endDate,
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        // Build filter conditions based on role
        let where = {};

        if (role === "owner") {
            // Global owner sees ALL logs from ALL vendors
            where = {};
        } else if ((role === "vendor_owner" || role === "vendor_admin") && vendorId) {
            // Vendor owner/admin sees logs for their vendor
            where = { vendorId: vendorId };

            // 🔒 STRICT FILTER: Only show logs for the CURRENTLY connected WhatsApp account
            try {
                const currentVendor = await prisma.vendor.findUnique({
                    where: { id: vendorId },
                    select: { whatsappBusinessId: true, whatsappPhoneNumberId: true }
                });

                if (currentVendor) {
                    if (currentVendor.whatsappBusinessId || currentVendor.whatsappPhoneNumberId) {
                        const orConditions = [];

                        // 1. Match by WABA ID if available
                        if (currentVendor.whatsappBusinessId) {
                            orConditions.push({ whatsappBusinessId: currentVendor.whatsappBusinessId });
                        }

                        // 2. Match by Phone Number ID if available
                        if (currentVendor.whatsappPhoneNumberId) {
                            orConditions.push({ whatsappPhoneNumberId: currentVendor.whatsappPhoneNumberId });
                        }

                        // 3. Match legacy/system logs for this vendor that have NO WABA/Phone set
                        // But EXCLUDE old WhatsApp traffic logs (which would have null IDs but we want to hide them)
                        // This ensures we still see "User Created" etc., but not old messages/webhooks.
                        orConditions.push({
                            AND: [
                                { vendorId: vendorId },
                                { whatsappBusinessId: null },
                                { whatsappPhoneNumberId: null },
                                {
                                    NOT: {
                                        type: {
                                            in: [
                                                "text", "image", "video", "audio", "document",
                                                "sticker", "location", "contacts", "template",
                                                "reaction", "unknown", "webhook", "message",
                                                "status", "template_status"
                                            ]
                                        }
                                    }
                                }
                            ]
                        });

                        where = {
                            OR: orConditions
                        };
                    }
                }
            } catch (err) {
                console.error("Error fetching vendor details for log filtering:", err);
            }
        } else {
            // Fallback: no logs visible if no vendorId
            where = { id: "impossible-match" };
        }

        if (status && status !== "all") {
            where.AND = where.AND || [];
            where.AND.push({ status: status });
        }

        if (event && event !== "all") {
            where.AND = where.AND || [];
            where.AND.push({ event: event });
        }

        if (type && type !== "all") {
            where.AND = where.AND || [];
            where.AND.push({ type: type });
        }

        if (search) {
            where.AND = where.AND || [];
            where.AND.push({
                OR: [
                    { phoneNumber: { contains: search, mode: "insensitive" } },
                    { messageId: { contains: search, mode: "insensitive" } },
                    { error: { contains: search, mode: "insensitive" } },
                    { event: { contains: search, mode: "insensitive" } },
                ],
            });
        }

        if (startDate || endDate) {
            where.AND = where.AND || [];
            const dateFilter = {};
            if (startDate) {
                const start = new Date(startDate);
                if (!isNaN(start.getTime())) {
                    dateFilter.gte = start;
                }
            }
            if (endDate) {
                const end = new Date(endDate);
                if (!isNaN(end.getTime())) {
                    dateFilter.lte = end;
                }
            }
            if (Object.keys(dateFilter).length > 0) {
                where.AND.push({ createdAt: dateFilter });
            }
        }

        console.log("📋 Query where clause:", JSON.stringify(where, null, 2));

        // Safety check for Prisma model
        if (!prisma.activityLog) {
            throw new Error("prisma.activityLog is undefined. Please run 'npx prisma generate' and restart the server.");
        }

        // Fetch logs with pagination
        const [logs, total] = await Promise.all([
            prisma.activityLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take,
            }),
            prisma.activityLog.count({ where }),
        ]);

        console.log("📋 Found", total, "logs, returning", logs.length);

        // Get statistics - map statuses properly
        const stats = await prisma.activityLog.groupBy({
            by: ["status"],
            where: where,
            _count: { id: true },
        });

        const statsMap = {
            read: 0,
            delivered: 0,
            sent: 0,
            failed: 0,
            template_approved: 0,
            approved: 0,
            received: 0,
            success: 0,
            error: 0,
            ignored: 0
        };

        stats.forEach((s) => {
            if (statsMap.hasOwnProperty(s.status)) {
                statsMap[s.status] = s._count.id;
            }
        });

        res.json({
            logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / take),
            },
            stats: statsMap,
        });
    } catch (err) {
        console.error("Error fetching activity logs:", err);
        console.error(err.stack); // Log stack trace
        res.status(500).json({ message: "Failed to fetch activity logs", error: err.message });
    }
});

/* ===============================
   GET SINGLE ACTIVITY LOG DETAIL
=============================== */
router.get("/:id", authenticate, async (req, res) => {
    try {
        const { role, vendorId } = req.user;

        if (!["vendor_owner", "vendor_admin", "owner"].includes(role)) {
            return res.status(403).json({ message: "Access denied" });
        }

        const log = await prisma.activityLog.findFirst({
            where: {
                id: req.params.id,
                ...(role !== "owner" && role !== "vendor_owner" ? { vendorId: vendorId } : {}),
            },
        });

        if (!log) {
            return res.status(404).json({ message: "Log not found" });
        }

        res.json(log);
    } catch (err) {
        console.error("Error fetching activity log:", err);
        res.status(500).json({ message: "Failed to fetch activity log" });
    }
});

/* ===============================
   CLEAR OLD LOGS (Admin/Owner only)
=============================== */
router.delete("/clear", authenticate, async (req, res) => {
    try {
        const { role, vendorId } = req.user;

        if (!["vendor_owner", "owner"].includes(role)) {
            return res.status(403).json({ message: "Access denied" });
        }

        const { olderThanDays = 30 } = req.query;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(olderThanDays));

        // Build where clause
        let where = {
            createdAt: { lt: cutoffDate },
        };

        // Owner and vendor_owner can clear ALL logs
        // Otherwise only clear their vendor's logs
        if (role !== "owner" && role !== "vendor_owner") {
            where.vendorId = vendorId;
        }

        console.log("🗑️ Clearing logs with where:", JSON.stringify(where, null, 2));

        const result = await prisma.activityLog.deleteMany({
            where,
        });

        console.log("🗑️ Deleted", result.count, "logs");

        res.json({
            message: `Deleted ${result.count} logs older than ${olderThanDays} days`,
            deletedCount: result.count,
        });
    } catch (err) {
        console.error("Error clearing activity logs:", err);
        res.status(500).json({ message: "Failed to clear logs", error: err.message });
    }
});

export default router;
