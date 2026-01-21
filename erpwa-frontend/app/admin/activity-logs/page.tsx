"use client";

import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/authContext";
import { getSocket, connectSocket } from "@/lib/socket";
import { motion, AnimatePresence } from "framer-motion";
import {
    Activity,
    CheckCircle2,
    XCircle,
    AlertCircle,
    RefreshCw,
    Search,
    ChevronLeft,
    ChevronRight,
    Eye,
    X,
    Trash2,
    Calendar,
    Filter,
    AlertTriangle,
    Wifi,
} from "lucide-react";

type WebhookLog = {
    id: string;
    vendorId: string | null;
    eventType: string;
    direction: string | null;
    phoneNumber: string | null;
    messageId: string | null;
    status: string;
    requestPayload: Record<string, unknown>;
    responseCode: number | null;
    errorMessage: string | null;
    processingMs: number | null;
    createdAt: string;
};

type Stats = {
    success: number;
    error: number;
    ignored: number;
};

type Pagination = {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
};

export default function WebhookLogsPage() {
    const { user, loading: authLoading } = useAuth();

    const [logs, setLogs] = useState<WebhookLog[]>([]);
    const [stats, setStats] = useState<Stats>({ success: 0, error: 0, ignored: 0 });
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
    });

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLive, setIsLive] = useState(false);

    // Filters
    const [statusFilter, setStatusFilter] = useState("all");
    const [eventTypeFilter, setEventTypeFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const fetchLogs = useCallback(async (page = 1, showRefresh = false) => {
        if (showRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: pagination.limit.toString(),
            });

            if (statusFilter !== "all") params.append("status", statusFilter);
            if (eventTypeFilter !== "all") params.append("eventType", eventTypeFilter);
            if (searchQuery) params.append("search", searchQuery);
            if (startDate) params.append("startDate", startDate);
            if (endDate) params.append("endDate", endDate);

            console.log("📋 Fetching webhook logs with params:", params.toString());
            const res = await api.get(`/webhook-logs?${params.toString()}`);
            console.log("📋 Response:", res.data);

            setLogs(res.data.logs || []);
            setStats(res.data.stats || { success: 0, error: 0, ignored: 0 });
            setPagination(res.data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
        } catch (err: unknown) {
            console.error("❌ Failed to fetch webhook logs:", err);
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            const axiosError = err as { response?: { data?: { message?: string; error?: string } } };
            setError(axiosError.response?.data?.message || axiosError.response?.data?.error || errorMessage);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [pagination.limit, statusFilter, eventTypeFilter, searchQuery, startDate, endDate]);

    // Initial fetch
    useEffect(() => {
        if (user && (user.role === "vendor_owner" || user.role === "vendor_admin")) {
            fetchLogs();
        }
    }, [user, fetchLogs]);

    // 🔥 Real-time socket listener for new webhook logs
    useEffect(() => {
        if (!user || !["vendor_owner", "vendor_admin"].includes(user.role)) return;

        connectSocket();
        const socket = getSocket();

        const handleNewLog = (newLog: WebhookLog) => {
            console.log("🔥 New webhook log received:", newLog);
            setIsLive(true);

            // Add to top of list
            setLogs(prev => [newLog, ...prev.slice(0, 49)]); // Keep max 50

            // Update stats
            setStats(prev => ({
                ...prev,
                [newLog.status]: (prev[newLog.status as keyof Stats] || 0) + 1,
            }));

            // Update total count
            setPagination(prev => ({
                ...prev,
                total: prev.total + 1,
            }));

            // Flash effect - reset after 2 seconds
            setTimeout(() => setIsLive(false), 2000);
        };

        socket.on("webhook-log:new", handleNewLog);

        return () => {
            socket.off("webhook-log:new", handleNewLog);
        };
    }, [user]);

    const handleClearOldLogs = async () => {
        if (!confirm("Are you sure you want to delete logs older than 30 days?")) return;

        try {
            await api.delete("/webhook-logs/clear?olderThanDays=30");
            fetchLogs(1, true);
        } catch (err) {
            console.error("Failed to clear logs:", err);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "success":
                return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
            case "error":
                return "bg-red-500/10 text-red-500 border-red-500/20";
            case "ignored":
                return "bg-amber-500/10 text-amber-500 border-amber-500/20";
            default:
                return "bg-muted text-muted-foreground border-border";
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "success":
                return <CheckCircle2 className="w-4 h-4" />;
            case "error":
                return <XCircle className="w-4 h-4" />;
            case "ignored":
                return <AlertCircle className="w-4 h-4" />;
            default:
                return <Activity className="w-4 h-4" />;
        }
    };

    const getEventTypeLabel = (eventType: string) => {
        switch (eventType) {
            case "message":
                return "📨 Message";
            case "status":
                return "📊 Status";
            case "verification":
                return "✅ Verification";
            case "empty":
                return "📭 Empty";
            default:
                return "❓ Unknown";
        }
    };

    // Helper to get message type from payload
    const getMessageType = (log: WebhookLog): string => {
        const payload = log.requestPayload as Record<string, unknown>;
        if (log.eventType === "message") {
            const msgType = (payload as { type?: string })?.type;
            if (msgType === "text") return "💬 Text";
            if (msgType === "button") return "🔘 Button Reply";
            if (msgType === "image") return "🖼️ Image";
            if (msgType === "video") return "🎥 Video";
            if (msgType === "audio") return "🎵 Audio";
            if (msgType === "document") return "📎 Document";
            if (msgType === "sticker") return "😀 Sticker";
            return msgType || "-";
        }
        if (log.eventType === "status") {
            const status = (payload as { status?: string })?.status;
            return status ? `📤 ${status}` : "-";
        }
        return "-";
    };

    // Helper to get context/reply ID (shortened)
    const getContextId = (log: WebhookLog): string => {
        const payload = log.requestPayload as Record<string, unknown>;
        const context = (payload as { context?: { id?: string } })?.context;
        if (context?.id) {
            // Shorten the wamid
            const id = context.id;
            if (id.length > 20) {
                return id.substring(0, 8) + "..." + id.substring(id.length - 8);
            }
            return id;
        }
        return "-";
    };

    // Helper to get direction badge
    const getDirectionBadge = (direction: string | null) => {
        if (direction === "inbound") {
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">↓ IN</span>;
        }
        if (direction === "outbound_status") {
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-500 border border-purple-500/20">↑ OUT</span>;
        }
        return <span className="text-muted-foreground">-</span>;
    };

    // Helper to format phone number
    const formatPhone = (phone: string | null, direction: string | null): string => {
        if (!phone) return "-";
        // Add + prefix if not present
        if (!phone.startsWith("+") && phone.length > 10) {
            return "+" + phone;
        }
        return phone;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "medium",
        });
    };

    /* ================= GUARDS ================= */

    if (authLoading || loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            </div>
        );
    }

    if (!user || !["vendor_owner", "vendor_admin"].includes(user.role)) {
        return (
            <div className="p-6 text-destructive">
                You do not have permission to access this page.
            </div>
        );
    }

    /* ================= UI ================= */

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold flex items-center gap-2">
                        <Activity className="w-6 h-6 text-primary" />
                        Webhook Logs
                        {/* Live indicator */}
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-300 ${isLive
                                ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 animate-pulse"
                                : "bg-muted/50 text-muted-foreground border border-border"
                            }`}>
                            <Wifi className="w-3 h-3" />
                            {isLive ? "LIVE" : "Connected"}
                        </span>
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Monitor incoming webhook events and debug issues • Real-time updates enabled
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => fetchLogs(pagination.page, true)}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border hover:bg-muted transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                        Refresh
                    </button>

                    {user.role === "vendor_owner" && (
                        <button
                            onClick={handleClearOldLogs}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            Clear Old
                        </button>
                    )}
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
                    <div className="flex-1">
                        <p className="font-medium text-destructive">Failed to load webhook logs</p>
                        <p className="text-sm text-destructive/80">{error}</p>
                    </div>
                    <button
                        onClick={() => fetchLogs(1, true)}
                        className="px-3 py-1.5 bg-destructive/20 hover:bg-destructive/30 rounded-lg text-sm text-destructive transition-colors"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border rounded-xl p-5"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Successful</p>
                            <p className="text-2xl font-bold text-emerald-500">{stats.success.toLocaleString()}</p>
                        </div>
                        <div className="p-3 rounded-full bg-emerald-500/10">
                            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-card border border-border rounded-xl p-5"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Errors</p>
                            <p className="text-2xl font-bold text-red-500">{stats.error.toLocaleString()}</p>
                        </div>
                        <div className="p-3 rounded-full bg-red-500/10">
                            <XCircle className="w-6 h-6 text-red-500" />
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-card border border-border rounded-xl p-5"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Ignored</p>
                            <p className="text-2xl font-bold text-amber-500">{stats.ignored.toLocaleString()}</p>
                        </div>
                        <div className="p-3 rounded-full bg-amber-500/10">
                            <AlertCircle className="w-6 h-6 text-amber-500" />
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Filters */}
            <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by phone, message ID, or error..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && fetchLogs(1)}
                            className="w-full pl-10 pr-4 py-2 bg-input border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setTimeout(() => fetchLogs(1), 0);
                            }}
                            className="px-3 py-2 bg-input border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        >
                            <option value="all">All Status</option>
                            <option value="success">Success</option>
                            <option value="error">Error</option>
                            <option value="ignored">Ignored</option>
                        </select>
                    </div>

                    {/* Event Type Filter */}
                    <select
                        value={eventTypeFilter}
                        onChange={(e) => {
                            setEventTypeFilter(e.target.value);
                            setTimeout(() => fetchLogs(1), 0);
                        }}
                        className="px-3 py-2 bg-input border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    >
                        <option value="all">All Events</option>
                        <option value="message">Messages</option>
                        <option value="status">Status Updates</option>
                        <option value="verification">Verification</option>
                    </select>

                    {/* Date Range */}
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="px-3 py-2 bg-input border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                        <span className="text-muted-foreground">to</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="px-3 py-2 bg-input border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                    </div>

                    <button
                        onClick={() => fetchLogs(1)}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                        Apply
                    </button>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Time</th>
                                <th className="text-left px-3 py-3 font-medium">Dir</th>
                                <th className="text-left px-3 py-3 font-medium">Event</th>
                                <th className="text-left px-3 py-3 font-medium">Type</th>
                                <th className="text-left px-3 py-3 font-medium">Phone</th>
                                <th className="text-left px-3 py-3 font-medium">Context ID</th>
                                <th className="text-left px-3 py-3 font-medium">Status</th>
                                <th className="text-left px-3 py-3 font-medium">Time</th>
                                <th className="text-left px-3 py-3 font-medium max-w-[150px]">Error</th>
                                <th className="text-center px-3 py-3 font-medium">View</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="text-center py-12 text-muted-foreground">
                                        No webhook logs found
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <motion.tr
                                        key={log.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                                    >
                                        {/* Time */}
                                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                                            {new Date(log.createdAt).toLocaleTimeString("en-IN", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                                second: "2-digit",
                                            })}
                                            <br />
                                            <span className="text-[10px]">
                                                {new Date(log.createdAt).toLocaleDateString("en-IN", {
                                                    day: "2-digit",
                                                    month: "short",
                                                })}
                                            </span>
                                        </td>

                                        {/* Direction */}
                                        <td className="px-3 py-2">
                                            {getDirectionBadge(log.direction)}
                                        </td>

                                        {/* Event Type */}
                                        <td className="px-3 py-2">
                                            <span className="font-medium text-xs">{getEventTypeLabel(log.eventType)}</span>
                                        </td>

                                        {/* Message Type */}
                                        <td className="px-3 py-2 text-xs">
                                            {getMessageType(log)}
                                        </td>

                                        {/* Phone */}
                                        <td className="px-3 py-2 font-mono text-xs">
                                            {formatPhone(log.phoneNumber, log.direction)}
                                        </td>

                                        {/* Context/Reply ID */}
                                        <td className="px-3 py-2 text-xs font-mono text-muted-foreground" title={log.messageId || ""}>
                                            {getContextId(log)}
                                        </td>

                                        {/* Status */}
                                        <td className="px-3 py-2">
                                            <span
                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                                                    log.status
                                                )}`}
                                            >
                                                {getStatusIcon(log.status)}
                                                {log.status}
                                            </span>
                                        </td>

                                        {/* Processing Time */}
                                        <td className="px-3 py-2 text-xs text-muted-foreground">
                                            {log.processingMs !== null ? `${log.processingMs}ms` : "-"}
                                        </td>

                                        {/* Error */}
                                        <td className="px-3 py-2 max-w-[150px]">
                                            {log.errorMessage ? (
                                                <span className="text-xs text-destructive truncate block" title={log.errorMessage}>
                                                    {log.errorMessage.length > 30
                                                        ? log.errorMessage.substring(0, 30) + "..."
                                                        : log.errorMessage}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">-</span>
                                            )}
                                        </td>

                                        {/* Actions */}
                                        <td className="px-3 py-2 text-center">
                                            <button
                                                onClick={() => setSelectedLog(log)}
                                                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                                                title="View Full Details"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                        <p className="text-sm text-muted-foreground">
                            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                            {pagination.total} logs
                        </p>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => fetchLogs(pagination.page - 1)}
                                disabled={pagination.page === 1}
                                className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>

                            <span className="text-sm font-medium px-3">
                                {pagination.page} / {pagination.totalPages}
                            </span>

                            <button
                                onClick={() => fetchLogs(pagination.page + 1)}
                                disabled={pagination.page === pagination.totalPages}
                                className="p-2 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            <AnimatePresence>
                {selectedLog && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                        onClick={() => setSelectedLog(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                                <div>
                                    <h2 className="text-lg font-semibold">Webhook Event Details</h2>
                                    <p className="text-sm text-muted-foreground">
                                        {formatDate(selectedLog.createdAt)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedLog(null)}
                                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="p-6 overflow-y-auto space-y-6">
                                {/* Summary */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Event Type</p>
                                        <p className="font-medium">{getEventTypeLabel(selectedLog.eventType)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Direction</p>
                                        <p className="font-medium">{selectedLog.direction || "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Status</p>
                                        <span
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                                                selectedLog.status
                                            )}`}
                                        >
                                            {getStatusIcon(selectedLog.status)}
                                            {selectedLog.status}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Processing Time</p>
                                        <p className="font-medium">
                                            {selectedLog.processingMs !== null ? `${selectedLog.processingMs}ms` : "-"}
                                        </p>
                                    </div>
                                </div>

                                {/* Phone & Message ID */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Phone Number</p>
                                        <p className="font-mono text-sm">{selectedLog.phoneNumber || "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Message ID</p>
                                        <p className="font-mono text-xs break-all">{selectedLog.messageId || "-"}</p>
                                    </div>
                                </div>

                                {/* Error Message */}
                                {selectedLog.errorMessage && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Error Message</p>
                                        <p className="text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm">
                                            {selectedLog.errorMessage}
                                        </p>
                                    </div>
                                )}

                                {/* Request Payload */}
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Request Payload</p>
                                    <pre className="bg-muted/50 border border-border rounded-lg p-4 text-xs overflow-x-auto max-h-[300px]">
                                        {JSON.stringify(selectedLog.requestPayload, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
