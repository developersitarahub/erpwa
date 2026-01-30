"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
    WifiOff,
    Settings,
    Link,
    Link2Off,
    Image as ImageIcon,
    FileText,
    MessageSquare,
    Music,
    Video,
    File,
    Sticker,
    Megaphone,
    UserPlus,
    UserCheck,
} from "lucide-react";

type ActivityLog = {
    id: string;
    vendorId: string;
    conversationId: string | null;
    messageId: string | null;
    phoneNumber: string | null;
    type: string; // Message type from database (text, image, video, etc.)
    status: string; // read, delivered, sent, failed, template_approved, approved, received
    event: string | null; // Operation name (receive, delivery_update, template_approval, etc.)
    category: string | null; // Category from payload
    error: string | null; // Only populated if there's an actual error
    payload: Record<string, unknown> | null;
    createdAt: string;
};

type Stats = {
    read: number;
    delivered: number;
    sent: number;
    failed: number;
    template_approved: number;
    approved: number;
    received: number;
};

type Pagination = {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
};

export default function ActivityLogsPage() {
    const { user, loading: authLoading } = useAuth();

    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [stats, setStats] = useState<Stats>({ read: 0, delivered: 0, sent: 0, failed: 0, template_approved: 0, approved: 0, received: 0 });
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
    });

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLive, setIsLive] = useState(false);

    // WhatsApp setup status
    type WhatsAppStatus = {
        whatsappBusinessId: string | null;
        whatsappPhoneNumberId: string | null;
        whatsappStatus: string | null;
        whatsappVerifiedAt: string | null;
        whatsappLastError: string | null;
    };
    const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus | null>(null);
    const [whatsappStatusLoading, setWhatsappStatusLoading] = useState(true);

    // Filters
    const [statusFilter, setStatusFilter] = useState("all");
    const [eventFilter, setEventFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // Refs to hold current filter values for fetchLogs (avoids dependency issues)
    const filtersRef = useRef({
        statusFilter: "all",
        eventFilter: "all",
        typeFilter: "all",
        searchQuery: "",
        startDate: "",
        endDate: "",
    });

    // Update refs when filters change
    useEffect(() => {
        filtersRef.current = { statusFilter, eventFilter, typeFilter, searchQuery, startDate, endDate };
    }, [statusFilter, eventFilter, typeFilter, searchQuery, startDate, endDate]);

    const fetchLogs = useCallback(async (page = 1, showRefresh = false) => {
        if (showRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: pagination.limit.toString(),
            });

            const { statusFilter: sf, eventFilter: ef, typeFilter: tf, searchQuery: sq, startDate: sd, endDate: ed } = filtersRef.current;

            if (sf !== "all") params.append("status", sf);
            if (ef !== "all") params.append("event", ef);
            if (tf !== "all") params.append("type", tf);
            if (sq) params.append("search", sq);
            if (sd) params.append("startDate", sd);
            if (ed) params.append("endDate", ed);

            console.log("📋 Fetching activity logs with params:", params.toString());
            const res = await api.get(`/activity-logs?${params.toString()}`);
            console.log("📋 Response:", res.data);

            setLogs(res.data.logs || []);
            setStats(res.data.stats || { read: 0, delivered: 0, sent: 0, failed: 0, template_approved: 0, approved: 0, received: 0 });
            setPagination(res.data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
        } catch (err: unknown) {
            console.error("❌ Failed to fetch activity logs:", err);
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            const axiosError = err as { response?: { data?: { message?: string; error?: string } } };
            setError(axiosError.response?.data?.message || axiosError.response?.data?.error || errorMessage);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [pagination.limit]); // Only depend on limit, not on filter values

    // Fetch WhatsApp setup status
    const fetchWhatsappStatus = useCallback(async () => {
        setWhatsappStatusLoading(true);
        try {
            const res = await api.get("/vendor/whatsapp");
            setWhatsappStatus(res.data);
        } catch (err) {
            console.error("Failed to fetch WhatsApp status:", err);
            setWhatsappStatus(null);
        } finally {
            setWhatsappStatusLoading(false);
        }
    }, []);

    // Initial fetch and refetch when vendor changes
    const hasFetchedRef = useRef(false);
    const previousVendorIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (user && (user.role === "vendor_owner" || user.role === "vendor_admin")) {
            // Check if vendor has changed
            const vendorChanged = previousVendorIdRef.current !== null && previousVendorIdRef.current !== user.vendorId;

            if (!hasFetchedRef.current || vendorChanged) {
                console.log("🔄 Fetching logs - Vendor:", user.vendorId, "Changed:", vendorChanged);
                hasFetchedRef.current = true;
                previousVendorIdRef.current = user.vendorId;

                // Reset and refetch logs for new vendor
                setLogs([]);
                fetchLogs();
                fetchWhatsappStatus();
            }
        }
    }, [user, user?.vendorId, fetchLogs, fetchWhatsappStatus]);

    // 🔥 Real-time socket listener for new webhook logs
    useEffect(() => {
        if (!user || !["vendor_owner", "vendor_admin"].includes(user.role)) return;

        connectSocket();
        const socket = getSocket();

        const handleNewLog = (newLog: ActivityLog) => {
            console.log("🔥 Activity log received:", newLog);

            // 🔒 Filter: Only process logs for the current vendor
            if (user.role !== "owner" && newLog.vendorId !== user.vendorId) {
                console.log("⏭️ Skipping log from different vendor:", newLog.vendorId);
                return;
            }

            setIsLive(true);

            // Check if this log already exists (update case)
            setLogs(prev => {
                const existingIndex = prev.findIndex(log => log.id === newLog.id);

                if (existingIndex !== -1) {
                    // Update existing log in place
                    const updated = [...prev];
                    updated[existingIndex] = newLog;
                    console.log("📝 Updated existing log at index:", existingIndex);
                    return updated;
                } else {
                    // Add new log to top
                    console.log("➕ Added new log to top");
                    return [newLog, ...prev.slice(0, 49)]; // Keep max 50
                }
            });

            // Update stats only for truly new logs (check by comparing total)
            setStats(prev => ({
                ...prev,
                [newLog.status]: (prev[newLog.status as keyof Stats] || 0) + 1,
            }));

            // Flash effect - reset after 2 seconds
            setTimeout(() => setIsLive(false), 2000);
        };

        socket.on("activity-log:new", handleNewLog);

        return () => {
            socket.off("activity-log:new", handleNewLog);
        };
    }, [user]);

    const [clearing, setClearing] = useState(false);

    const handleClearOldLogs = async () => {
        if (!confirm("Are you sure you want to delete logs older than 30 days? This action cannot be undone.")) return;

        setClearing(true);
        try {
            const res = await api.delete("/activity-logs/clear?olderThanDays=30");
            const data = res.data;
            alert(`Successfully deleted ${data.deletedCount || 0} old logs`);
            fetchLogs(1, true);
        } catch (err: unknown) {
            console.error("Failed to clear logs:", err);
            const axiosError = err as { response?: { data?: { message?: string; error?: string } } };
            const errorMsg = axiosError.response?.data?.message || axiosError.response?.data?.error || "Failed to clear logs";
            alert(`Error: ${errorMsg}`);
        } finally {
            setClearing(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "read":
            case "delivered":
            case "sent":
            case "received":
            case "template_approved":
            case "approved":
                return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
            case "failed":
                return "bg-red-500/10 text-red-500 border-red-500/20";
            default:
                return "bg-muted text-muted-foreground border-border";
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "read":
            case "delivered":
            case "sent":
            case "received":
            case "template_approved":
            case "approved":
                return <CheckCircle2 className="w-4 h-4" />;
            case "failed":
                return <XCircle className="w-4 h-4" />;
            default:
                return <Activity className="w-4 h-4" />;
        }
    };

    // Helper to get event label
    const getEventLabel = (event: string | null) => {
        // Backend now sends pre-formatted events like "Sent", "Received", "Template Approved"
        if (!event) return "-";
        return event;
    };

    const getMessageTypeLabel = (type: string) => {
        // Normalize input
        const lowerType = type?.toLowerCase() || "";

        if (lowerType.includes("image")) {
            return (
                <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-purple-500" />
                    {type}
                </span>
            );
        }
        if (lowerType.includes("template")) {
            return (
                <span className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-orange-500" />
                    {type}
                </span>
            );
        }
        if (lowerType.includes("campaign")) {
            return (
                <span className="flex items-center gap-1.5">
                    <Megaphone className="w-4 h-4 text-blue-500" />
                    {type}
                </span>
            );
        }
        if (lowerType.includes("text")) {
            return (
                <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-gray-500" />
                    {type}
                </span>
            );
        }
        if (lowerType.includes("user")) {
            return (
                <span className="flex items-center gap-1.5">
                    {lowerType.includes("activated") ? <UserCheck className="w-4 h-4 text-green-500" /> : <UserPlus className="w-4 h-4 text-blue-500" />}
                    {type}
                </span>
            );
        }

        // Exact matches for other types
        switch (lowerType) {
            case "video":
                return (
                    <span className="flex items-center gap-1.5">
                        <Video className="w-4 h-4 text-pink-500" />
                        Video
                    </span>
                );
            case "audio":
                return (
                    <span className="flex items-center gap-1.5">
                        <Music className="w-4 h-4 text-indigo-500" />
                        Audio
                    </span>
                );
            case "document":
                return (
                    <span className="flex items-center gap-1.5">
                        <File className="w-4 h-4 text-yellow-500" />
                        Document
                    </span>
                );
            case "sticker":
                return (
                    <span className="flex items-center gap-1.5">
                        <Sticker className="w-4 h-4 text-emerald-500" />
                        Sticker
                    </span>
                );
            case "system":
            case "system_event":
            case "webhook":
                return (
                    <span className="flex items-center gap-1.5">
                        <Settings className="w-4 h-4 text-slate-500" />
                        System
                    </span>
                );
            default:
                return type || "-";
        }
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
                        Activity Logs
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
                        Monitor message activities and operations • Real-time updates enabled
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
                            disabled={clearing}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Trash2 className={`w-4 h-4 ${clearing ? "animate-pulse" : ""}`} />
                            {clearing ? "Clearing..." : "Clear Old"}
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

            {/* WhatsApp Setup Status Card */}
            {!whatsappStatusLoading && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl p-4 border ${whatsappStatus?.whatsappStatus === "connected"
                        ? "bg-emerald-500/10 border-emerald-500/20"
                        : whatsappStatus?.whatsappLastError
                            ? "bg-destructive/10 border-destructive/20"
                            : "bg-amber-500/10 border-amber-500/20"
                        }`}
                >
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                            {whatsappStatus?.whatsappStatus === "connected" ? (
                                <div className="p-2 rounded-full bg-emerald-500/20">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                </div>
                            ) : whatsappStatus?.whatsappLastError ? (
                                <div className="p-2 rounded-full bg-destructive/20">
                                    <XCircle className="w-5 h-5 text-destructive" />
                                </div>
                            ) : (
                                <div className="p-2 rounded-full bg-amber-500/20">
                                    <AlertCircle className="w-5 h-5 text-amber-500" />
                                </div>
                            )}
                            <div>
                                <p className={`font-medium ${whatsappStatus?.whatsappStatus === "connected"
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : whatsappStatus?.whatsappLastError
                                        ? "text-destructive"
                                        : "text-amber-600 dark:text-amber-400"
                                    }`}>
                                    {whatsappStatus?.whatsappStatus === "connected"
                                        ? "✓ WhatsApp API Connected & Configured"
                                        : whatsappStatus?.whatsappLastError
                                            ? "✗ WhatsApp Connection Error"
                                            : "⚠ WhatsApp Not Configured"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {whatsappStatus?.whatsappStatus === "connected" ? (
                                        <>
                                            Webhook receiving events
                                            {whatsappStatus?.whatsappVerifiedAt && (
                                                <> • Connected since {new Date(whatsappStatus.whatsappVerifiedAt).toLocaleDateString()}</>
                                            )}
                                        </>
                                    ) : whatsappStatus?.whatsappLastError ? (
                                        <span className="text-destructive">{whatsappStatus.whatsappLastError}</span>
                                    ) : (
                                        "Go to Settings → Setup to connect your WhatsApp Business API"
                                    )}
                                </p>
                            </div>
                        </div>

                    </div>
                </motion.div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border rounded-xl p-5"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Delivered</p>
                            <p className="text-2xl font-bold text-emerald-500">{(stats.delivered + stats.read + stats.sent + stats.received + stats.template_approved + stats.approved).toLocaleString()}</p>
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
                            <p className="text-sm text-muted-foreground">Failed</p>
                            <p className="text-2xl font-bold text-red-500">{stats.failed.toLocaleString()}</p>
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
                            <p className="text-sm text-muted-foreground">Template Approved</p>
                            <p className="text-2xl font-bold text-blue-500">{stats.template_approved.toLocaleString()}</p>
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
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 bg-input border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        >
                            <option value="all">All Status</option>
                            <option value="read">Read</option>
                            <option value="delivered">Delivered</option>
                            <option value="sent">Sent</option>
                            <option value="received">Received</option>
                            <option value="failed">Failed</option>
                            <option value="template_approved">Template Approved</option>
                            <option value="approved">Approved</option>
                        </select>
                    </div>

                    {/* Event Type Filter */}
                    <select
                        value={eventFilter}
                        onChange={(e) => setEventFilter(e.target.value)}
                        className="px-3 py-2 bg-input border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    >
                        <option value="all">All Operations</option>
                        <option value="receive">Receive</option>
                        <option value="delivery_update">Delivery Update</option>
                        <option value="template_approval">Template Approval</option>
                        <option value="template_rejection">Template Rejection</option>
                        <option value="send">Send</option>
                    </select>

                    {/* Type Filter */}
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="px-3 py-2 bg-input border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    >
                        <option value="all">All Types</option>
                        <option value="text">Text</option>
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                        <option value="audio">Audio</option>
                        <option value="document">Document</option>
                        <option value="button">Button</option>
                        <option value="template">Template</option>
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

                    <div className="flex gap-2">
                        <button
                            onClick={() => fetchLogs(1)}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                        >
                            Apply
                        </button>
                        <button
                            onClick={() => {
                                setSearchQuery("");
                                setStatusFilter("all");
                                setEventFilter("all");
                                setTypeFilter("all");
                                setStartDate("");
                                setEndDate("");
                                // Update refs immediately and fetch
                                filtersRef.current = { statusFilter: "all", eventFilter: "all", typeFilter: "all", searchQuery: "", startDate: "", endDate: "" };
                                fetchLogs(1);
                            }}
                            className="px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors border border-border"
                        >
                            Clear
                        </button>
                    </div>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Time</th>
                                <th className="text-left px-3 py-3 font-medium">Event</th>
                                <th className="text-left px-3 py-3 font-medium">Type</th>
                                <th className="text-left px-3 py-3 font-medium">Phone</th>
                                <th className="text-left px-3 py-3 font-medium">Reply Context ID</th>
                                <th className="text-left px-3 py-3 font-medium">Category</th>
                                <th className="text-left px-3 py-3 font-medium">Status</th>
                                <th className="text-left px-3 py-3 font-medium max-w-[150px]">Error</th>
                                <th className="text-center px-3 py-3 font-medium">View</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-12 text-muted-foreground">
                                        No activity logs found
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

                                        {/* Operation (Event) */}
                                        <td className="px-3 py-2">
                                            <span className="font-medium text-xs">{log.event}</span>
                                        </td>

                                        {/* Message Type */}
                                        <td className="px-3 py-2 text-xs">
                                            {getMessageTypeLabel(log.type)}
                                        </td>

                                        {/* Phone */}
                                        <td className="px-3 py-2 font-mono text-xs">
                                            {formatPhone(log.phoneNumber, null)}
                                        </td>

                                        {/* Reply Context */}
                                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                                            {(log.payload as any)?.context?.id ? (
                                                <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] truncate max-w-[100px] block" title={(log.payload as any).context.id}>
                                                    {(log.payload as any).context.id.slice(0, 10)}...
                                                </span>
                                            ) : (
                                                "-"
                                            )}
                                        </td>

                                        {/* Category */}
                                        <td className="px-3 py-2 text-xs text-muted-foreground">
                                            {log.category ? (
                                                <span className="bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.5 rounded uppercase text-[10px] font-medium tracking-wide">
                                                    {log.category}
                                                </span>
                                            ) : (
                                                "-"
                                            )}
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

                                        {/* Error */}
                                        <td className="px-3 py-2 max-w-[150px]">
                                            {log.error ? (
                                                <span className="text-xs text-destructive truncate block" title={log.error}>
                                                    {log.error.length > 30
                                                        ? log.error.substring(0, 30) + "..."
                                                        : log.error}
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
                {pagination.totalPages >= 1 && (
                    <div className="flex flex-wrap items-center justify-between px-4 py-4 border-t border-border gap-4">
                        <p className="text-sm text-muted-foreground">
                            Showing {logs.length > 0 ? ((pagination.page - 1) * pagination.limit + 1) : 0} to{" "}
                            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                            {pagination.total} logs
                        </p>

                        <div className="flex items-center gap-4">
                            {/* Page Size Selector */}
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Rows:</span>
                                <select
                                    value={pagination.limit}
                                    onChange={(e) => {
                                        const newLimit = Number(e.target.value);
                                        setPagination(prev => ({ ...prev, limit: newLimit }));
                                        // Update ref and fetch
                                        setTimeout(() => fetchLogs(1), 0);
                                    }}
                                    className="px-2 py-1 bg-input border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                >
                                    <option value="20">20</option>
                                    <option value="50">50</option>
                                    <option value="100">100</option>
                                </select>
                            </div>

                            {/* Page Navigation */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => fetchLogs(pagination.page - 1)}
                                    disabled={pagination.page === 1}
                                    className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                                >
                                    ← Previous
                                </button>

                                {/* Page Numbers */}
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                                        .filter((page) => {
                                            if (pagination.totalPages <= 7) return true;
                                            if (page === 1 || page === pagination.totalPages) return true;
                                            if (page >= pagination.page - 1 && page <= pagination.page + 1) return true;
                                            return false;
                                        })
                                        .map((page, idx, arr) => {
                                            const showDots = idx > 0 && arr[idx - 1] + 1 < page;
                                            return (
                                                <span key={page}>
                                                    {showDots && <span className="px-2 text-muted-foreground">...</span>}
                                                    <button
                                                        onClick={() => fetchLogs(page)}
                                                        className={`min-w-[32px] px-2 py-1 rounded-lg text-sm font-medium transition-colors ${page === pagination.page
                                                            ? "bg-primary text-primary-foreground"
                                                            : "hover:bg-muted border border-border"
                                                            }`}
                                                    >
                                                        {page}
                                                    </button>
                                                </span>
                                            );
                                        })}
                                </div>

                                <button
                                    onClick={() => fetchLogs(pagination.page + 1)}
                                    disabled={pagination.page === pagination.totalPages}
                                    className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                                >
                                    Next →
                                </button>
                            </div>
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
                                        <p className="text-xs text-muted-foreground mb-1">Operation</p>
                                        <p className="font-medium">{getEventLabel(selectedLog.event)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Type</p>
                                        <p className="font-medium">{getMessageTypeLabel(selectedLog.type)}</p>
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
                                        <p className="text-xs text-muted-foreground mb-1">Category</p>
                                        <p className="font-medium">{selectedLog.category || "-"}</p>
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
                                {selectedLog.error && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Error Message</p>
                                        <p className="text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm">
                                            {selectedLog.error}
                                        </p>
                                    </div>
                                )}

                                {/* Payload */}
                                {selectedLog.payload && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Payload</p>
                                        <pre className="bg-muted/50 border border-border rounded-lg p-4 text-xs overflow-x-auto max-h-[300px]">
                                            {JSON.stringify(selectedLog.payload, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
