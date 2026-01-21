import express from "express";
import prisma from "../prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

/* ===============================
   GET WEBHOOK LOGS (Admin/Owner only)
=============================== */
router.get("/", authenticate, async (req, res) => {
    try {
        const { role, vendorId } = req.user;

        console.log("📋 Fetching webhook logs for user:", {
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
            limit = 50, // Increased default limit
            status,
            eventType,
            search,
            startDate,
            endDate,
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        // Build filter conditions
        // For 'owner' and 'vendor_owner' roles, show ALL logs (for debugging)
        // For 'vendor_admin', show only their vendor's logs
        let where = {};

        if (role === "owner" || role === "vendor_owner") {
            // Owner and vendor_owner see everything (useful for debugging)
            console.log("📋 Showing ALL logs for role:", role);
            where = {};
        } else {
            // Vendor admin sees their vendor's logs + system logs (null vendorId)
            where = {
                OR: [
                    { vendorId: vendorId },
                    { vendorId: null }, // Include system-level logs like verification
                ],
            };
        }

        if (status && status !== "all") {
            where.AND = where.AND || [];
            where.AND.push({ status: status });
        }

        if (eventType && eventType !== "all") {
            where.AND = where.AND || [];
            where.AND.push({ eventType: eventType });
        }

        if (search) {
            where.AND = where.AND || [];
            where.AND.push({
                OR: [
                    { phoneNumber: { contains: search, mode: "insensitive" } },
                    { messageId: { contains: search, mode: "insensitive" } },
                    { errorMessage: { contains: search, mode: "insensitive" } },
                ],
            });
        }

        if (startDate || endDate) {
            where.AND = where.AND || [];
            const dateFilter = {};
            if (startDate) {
                dateFilter.gte = new Date(startDate);
            }
            if (endDate) {
                dateFilter.lte = new Date(endDate);
            }
            where.AND.push({ createdAt: dateFilter });
        }

        console.log("📋 Query where clause:", JSON.stringify(where, null, 2));

        // Fetch logs with pagination
        const [logs, total] = await Promise.all([
            prisma.webhookLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take,
            }),
            prisma.webhookLog.count({ where }),
        ]);

        console.log("📋 Found", total, "logs, returning", logs.length);

        // Get statistics using the SAME filter as the logs query
        const stats = await prisma.webhookLog.groupBy({
            by: ["status"],
            where: where, // Use same where clause as logs
            _count: { id: true },
        });

        const statsMap = {
            success: 0,
            error: 0,
            ignored: 0,
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
        console.error("Error fetching webhook logs:", err);
        res.status(500).json({ message: "Failed to fetch webhook logs", error: err.message });
    }
});

/* ===============================
   GET SINGLE WEBHOOK LOG DETAIL
=============================== */
router.get("/:id", authenticate, async (req, res) => {
    try {
        const { role, vendorId } = req.user;

        if (!["vendor_owner", "vendor_admin", "owner"].includes(role)) {
            return res.status(403).json({ message: "Access denied" });
        }

        const log = await prisma.webhookLog.findFirst({
            where: {
                id: req.params.id,
                vendorId: vendorId,
            },
        });

        if (!log) {
            return res.status(404).json({ message: "Log not found" });
        }

        res.json(log);
    } catch (err) {
        console.error("Error fetching webhook log:", err);
        res.status(500).json({ message: "Failed to fetch webhook log" });
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

        const result = await prisma.webhookLog.deleteMany({
            where: {
                vendorId,
                createdAt: { lt: cutoffDate },
            },
        });

        res.json({
            message: `Deleted ${result.count} logs older than ${olderThanDays} days`,
            deletedCount: result.count,
        });
    } catch (err) {
        console.error("Error clearing webhook logs:", err);
        res.status(500).json({ message: "Failed to clear logs" });
    }
});

export default router;
