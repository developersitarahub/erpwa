"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    Download,
    Eye,
    FileText,
    Search,
    Calendar,
    Filter,
    X,
    ChevronLeft,
    ChevronRight,
    Trash2
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";

export default function FlowResponsesPage() {
    const params = useParams();
    const router = useRouter();
    const flowId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [responses, setResponses] = useState<any[]>([]);
    const [flow, setFlow] = useState<any>(null);
    const [selectedResponse, setSelectedResponse] = useState<any>(null);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
    });

    // Filters
    const [statusFilter, setStatusFilter] = useState("all");

    useEffect(() => {
        if (flowId) {
            fetchFlowDetails();
            fetchResponses(1);
        }
    }, [flowId]);

    useEffect(() => {
        fetchResponses(1);
    }, [statusFilter]);

    const fetchFlowDetails = async () => {
        try {
            const response = await api.get(`/whatsapp/flows/${flowId}`);
            if (response.data.success) {
                setFlow(response.data.flow);
            }
        } catch (error) {
            console.error("Error fetching flow details:", error);
            toast.error("Failed to load flow details");
        }
    };

    const fetchResponses = async (page: number) => {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: pagination.limit.toString(),
                ...(statusFilter !== "all" && { status: statusFilter })
            });

            const response = await api.get(
                `/whatsapp/flows/${flowId}/responses?${queryParams.toString()}`
            );

            setResponses(response.data.responses || []);
            setPagination(prev => ({
                ...prev,
                page,
                total: response.data.pagination?.total || 0,
                totalPages: response.data.pagination?.totalPages || 0
            }));
        } catch (error) {
            console.error("Error fetching responses:", error);
            toast.error("Failed to load responses");
        } finally {
            setLoading(false);
        }
    };

    const exportResponses = async () => {
        try {
            const response = await api.get(
                `/whatsapp/flows/${flowId}/responses?limit=10000` // Export all (or reasonable max)
            );
            const data = response.data.responses || [];

            // Convert to CSV
            const csv = convertToCSV(data);

            // Download
            const blob = new Blob([csv], { type: "text/csv" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `flow-responses-${flow?.name || flowId}-${new Date().toISOString().split("T")[0]}.csv`;
            a.click();

            toast.success("Responses exported!");
        } catch (error) {
            toast.error("Failed to export responses");
        }
    };

    const handleDeleteResponse = async (responseId: string) => {
        if (!confirm("Are you sure you want to delete this response? This action cannot be undone.")) return;

        try {
            const response = await api.delete(`/whatsapp/flows/${flowId}/responses/${responseId}`);
            if (response.data.success) {
                toast.success("Response deleted successfully");
                fetchResponses(pagination.page); // Refresh
            }
        } catch (error) {
            console.error("Error deleting response:", error);
            toast.error("Failed to delete response");
        }
    };

    const convertToCSV = (data: any[]) => {
        if (data.length === 0) return "";

        // 1. Extract all unique keys from responseData
        const dynamicKeys = new Set<string>();
        data.forEach(item => {
            const responseData = item.responseData || {};
            if (typeof responseData === 'object') {
                Object.keys(responseData).forEach(key => {
                    // Exclude internal/technical keys if preferred, 
                    // but usually users want everything form-related.
                    // We definitely exclude 'flow_token' as it's technical.
                    if (key !== 'flow_token') {
                        dynamicKeys.add(key);
                    }
                });
            }
        });

        const sortedKeys = Array.from(dynamicKeys).sort();

        // 2. Build Headers
        const headers = [
            "Date",
            "Phone",
            "Email",
            "Company",
            "Status",
            ...sortedKeys
        ];

        // Helper to escape CSV properly
        const escapeCsv = (str: string) => {
            if (str == null) return "";
            // Handle objects/arrays in fields by stringifying
            if (typeof str === 'object') return `"${String(JSON.stringify(str)).replace(/"/g, '""')}"`;
            return `"${String(str).replace(/"/g, '""')}"`;
        };

        const rows = data.map((item: any) => {
            const responseData = item.responseData || {};

            const row = [
                new Date(item.createdAt).toLocaleString(),
                item.conversation?.lead?.phoneNumber || "",
                item.conversation?.lead?.email || "",
                item.conversation?.lead?.companyName || "",
                item.status,
            ];

            // Add dynamic field values
            sortedKeys.forEach(key => {
                row.push(responseData[key] !== undefined ? responseData[key] : "");
            });

            return row;
        });

        return [
            headers.join(","),
            ...rows.map((row) => row.map(escapeCsv).join(",")),
        ].join("\n");
    };

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-muted rounded-full transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                                <FileText className="w-6 h-6 text-primary" />
                                Flow Responses
                            </h1>
                            {flow && (
                                <p className="text-muted-foreground">
                                    {flow.name} <span className="text-muted-foreground/50 mx-2">•</span> {pagination.total} Total Responses
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-card border rounded-lg px-3 py-1.5 shadow-sm">
                            <Filter className="w-4 h-4 text-muted-foreground mr-2" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-transparent text-sm border-none focus:ring-0 cursor-pointer"
                            >
                                <option value="all">All Status</option>
                                <option value="completed">Completed</option>
                                <option value="dropped">Dropped</option>
                                {/* 'dropped' or 'abandoned' depends on backend logic, keeping vague or standard */}
                            </select>
                        </div>

                        <button
                            onClick={exportResponses}
                            disabled={responses.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors disabled:opacity-50 shadow-sm"
                        >
                            <Download className="w-4 h-4" />
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* Content Table */}
                <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                    {loading && pagination.total === 0 ? (
                        <div className="text-center py-20">
                            <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-muted-foreground mt-4">Loading responses...</p>
                        </div>
                    ) : responses.length === 0 ? (
                        <div className="text-center py-20 bg-muted/5">
                            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                            <h3 className="text-lg font-medium text-foreground">No responses yet</h3>
                            <p className="text-muted-foreground mt-1">When users complete this flow, their data will appear here.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                                    <tr>
                                        <th className="px-6 py-4">Date & Time</th>
                                        <th className="px-6 py-4">Lead / Contact</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Preview</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {responses.map((item) => (
                                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-6 py-4 text-foreground whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{new Date(item.createdAt).toLocaleDateString()}</span>
                                                    <span className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleTimeString()}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-foreground">
                                                        {item.conversation?.lead?.phoneNumber || "Unknown Number"}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {item.conversation?.lead?.email || item.conversation?.lead?.companyName || "No extra info"}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                            ${item.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'}
                         `}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 max-w-xs truncate text-muted-foreground">
                                                {JSON.stringify(item.responseData)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => setSelectedResponse(item)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-md text-xs font-medium transition-colors"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    Details
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteResponse(item.id);
                                                    }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-md text-xs font-medium transition-colors ml-2"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {!loading && responses.length > 0 && (
                        <div className="flex items-center justify-between p-4 border-t border-border bg-muted/20">
                            <p className="text-sm text-muted-foreground">
                                Page {pagination.page} of {pagination.totalPages}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => fetchResponses(pagination.page - 1)}
                                    disabled={pagination.page <= 1}
                                    className="p-2 border rounded-md hover:bg-background disabled:opacity-50 disabled:hover:bg-transparent"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => fetchResponses(pagination.page + 1)}
                                    disabled={pagination.page >= pagination.totalPages}
                                    className="p-2 border rounded-md hover:bg-background disabled:opacity-50 disabled:hover:bg-transparent"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Detail Modal */}
            <AnimatePresence>
                {selectedResponse && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setSelectedResponse(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-card w-full max-w-2xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col border border-border"
                        >
                            <div className="flex items-center justify-between p-5 border-b border-border">
                                <div>
                                    <h3 className="text-lg font-bold text-foreground">Response Details</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Submitted on {new Date(selectedResponse.createdAt).toLocaleString()}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedResponse(null)}
                                    className="p-2 hover:bg-muted rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-0">
                                <div className="p-5 bg-muted/10 border-b border-border">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Lead Information</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-muted-foreground">Phone</label>
                                            <p className="font-medium">{selectedResponse.conversation?.lead?.phoneNumber}</p>
                                        </div>
                                        {selectedResponse.conversation?.lead?.email && (
                                            <div>
                                                <label className="text-xs text-muted-foreground">Email</label>
                                                <p className="font-medium">{selectedResponse.conversation?.lead?.email}</p>
                                            </div>
                                        )}
                                        {selectedResponse.conversation?.lead?.companyName && (
                                            <div>
                                                <label className="text-xs text-muted-foreground">Company</label>
                                                <p className="font-medium">{selectedResponse.conversation?.lead?.companyName}</p>
                                            </div>
                                        )}
                                        <div>
                                            <label className="text-xs text-muted-foreground">Flow ID</label>
                                            <p className="font-mono text-xs">{flowId}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-5">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Form Data</h4>
                                    <div className="border border-border rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/50 border-b border-border">
                                                <tr>
                                                    <th className="px-4 py-2 text-left font-medium text-muted-foreground w-1/3">Field</th>
                                                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Value</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {Object.entries(selectedResponse.responseData || {}).map(([key, value]: [string, any]) => (
                                                    <tr key={key} className="hover:bg-muted/10">
                                                        <td className="px-4 py-3 font-medium text-foreground">{key.replace(/_/g, ' ')}</td>
                                                        <td className="px-4 py-3 text-muted-foreground break-all">
                                                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {Object.keys(selectedResponse.responseData || {}).length === 0 && (
                                                    <tr>
                                                        <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground bg-muted/5">
                                                            No data fields captured.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border-t border-border bg-muted/20 flex justify-end">
                                <button
                                    onClick={() => setSelectedResponse(null)}
                                    className="px-4 py-2 bg-background border border-input rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
