'use client';

import { useState, useEffect } from 'react';
import { X, Download, Eye, TrendingUp, Users, CheckCircle2, XCircle } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface FlowMetricsModalProps {
    isOpen: boolean;
    onClose: () => void;
    flowId: string;
    flowName: string;
}

export default function FlowMetricsModal({ isOpen, onClose, flowId, flowName }: FlowMetricsModalProps) {
    const [metrics, setMetrics] = useState<any>(null);
    const [responses, setResponses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedResponse, setSelectedResponse] = useState<any>(null);

    useEffect(() => {
        if (isOpen && flowId) {
            fetchMetrics();
            fetchResponses();
        }
    }, [isOpen, flowId]);

    const fetchMetrics = async () => {
        try {
            const response = await api.get(`/whatsapp/flows/${flowId}/metrics`);
            setMetrics(response.data.metrics);
        } catch (error) {
            console.error('Error fetching metrics:', error);
            toast.error('Failed to load metrics');
        } finally {
            setLoading(false);
        }
    };

    const fetchResponses = async () => {
        try {
            const response = await api.get(`/whatsapp/flows/${flowId}/responses?limit=10`);
            setResponses(response.data.responses || []);
        } catch (error) {
            console.error('Error fetching responses:', error);
        }
    };

    const exportResponses = async () => {
        try {
            const response = await api.get(`/whatsapp/flows/${flowId}/responses?limit=1000`);
            const data = response.data.responses || [];

            // Convert to CSV
            const csv = convertToCSV(data);

            // Download
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `flow-responses-${flowName}-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();

            toast.success('Responses exported!');
        } catch (error) {
            toast.error('Failed to export responses');
        }
    };

    const convertToCSV = (data: any[]) => {
        if (data.length === 0) return '';

        const headers = ['Date', 'Phone', 'Email', 'Company', 'Status', 'Response Data'];
        const rows = data.map((item: any) => [
            new Date(item.createdAt).toLocaleDateString(),
            item.conversation?.lead?.phoneNumber || '',
            item.conversation?.lead?.email || '',
            item.conversation?.lead?.companyName || '',
            item.status,
            JSON.stringify(item.responseData)
        ]);

        return [
            headers.join(','),
            ...rows.map(row => row.map((cell: any) => `"${cell}"`).join(','))
        ].join('\n');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            <TrendingUp className="w-6 h-6 text-primary" />
                            Flow Metrics
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">{flowName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-muted-foreground mt-2">Loading metrics...</p>
                        </div>
                    ) : metrics ? (
                        <div className="space-y-6">
                            {/* Key Metrics */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-1">
                                        <Users className="w-4 h-4" />
                                        <span className="text-xs font-semibold">Total Responses</span>
                                    </div>
                                    <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                                        {metrics.totalResponses}
                                    </p>
                                </div>

                                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-1">
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span className="text-xs font-semibold">Completed</span>
                                    </div>
                                    <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                                        {metrics.completedResponses}
                                    </p>
                                </div>

                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-red-700 dark:text-red-300 mb-1">
                                        <XCircle className="w-4 h-4" />
                                        <span className="text-xs font-semibold">Abandoned</span>
                                    </div>
                                    <p className="text-3xl font-bold text-red-900 dark:text-red-100">
                                        {metrics.abandonedResponses}
                                    </p>
                                </div>

                                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 mb-1">
                                        <TrendingUp className="w-4 h-4" />
                                        <span className="text-xs font-semibold">Completion Rate</span>
                                    </div>
                                    <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                                        {metrics.completionRate.toFixed(1)}%
                                    </p>
                                </div>
                            </div>

                            {/* Recent Responses */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-foreground">
                                        Recent Responses
                                    </h3>
                                    <button
                                        onClick={exportResponses}
                                        className="flex items-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-medium transition-colors"
                                    >
                                        <Download className="w-4 h-4" />
                                        Export CSV
                                    </button>
                                </div>

                                {responses.length === 0 ? (
                                    <div className="text-center py-8 bg-muted/50 rounded-lg">
                                        <p className="text-muted-foreground">No responses yet</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {responses.map((response) => (
                                            <div
                                                key={response.id}
                                                className="bg-muted/50 border border-border rounded-lg p-4 hover:bg-muted transition-colors"
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-semibold text-foreground">
                                                                {response.conversation?.lead?.phoneNumber}
                                                            </span>
                                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${response.status === 'completed'
                                                                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                                                : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                                                                }`}>
                                                                {response.status}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            {response.conversation?.lead?.email || response.conversation?.lead?.companyName}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {new Date(response.createdAt).toLocaleString()}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => setSelectedResponse(response)}
                                                        className="flex items-center gap-1 px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-medium transition-colors"
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                        View Data
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">No metrics available</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Response Detail Modal */}
            {selectedResponse && (
                <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="font-semibold text-foreground">Response Data</h3>
                            <button
                                onClick={() => setSelectedResponse(null)}
                                className="p-2 hover:bg-muted rounded-lg transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                                {JSON.stringify(selectedResponse.responseData, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
