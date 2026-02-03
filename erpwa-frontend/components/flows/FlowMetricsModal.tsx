"use client";

import { useState, useEffect } from "react";
import {
  X,
  Download,
  Eye,
  TrendingUp,
  Users,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "react-toastify";

interface FlowMetricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  flowId: string;
  flowName: string;

}

export default function FlowMetricsModal({
  isOpen,
  onClose,
  flowId,
  flowName,

}: FlowMetricsModalProps) {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && flowId) {
      fetchMetrics();
    }
  }, [isOpen, flowId]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/whatsapp/flows/${flowId}/metrics`);
      setMetrics(response.data.metrics);
    } catch (error) {
      console.error("Error fetching metrics:", error);
      toast.error("Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };


  // ... exports ...
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            {/* Tabs Removed - Metrics Only */}
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-primary" />
              Flow Metrics
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{flowName}</p>
          </div>
          <div className="flex gap-2">
            {/* Optional: Add Refresh Action or other interactions here if needed */}
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
              <p className="text-muted-foreground mt-2">Loading...</p>
            </div>
          ) : (
            // Metrics View
            metrics ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 p-2">
                  {/* Total Responses */}
                  <div className="bg-card border border-border p-5 rounded-xl shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 group-hover:bg-blue-600 transition-colors"></div>
                    <div className="flex justify-between items-start mb-2 pl-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Total Responses
                      </span>
                      <Users className="w-5 h-5 text-blue-500/80" />
                    </div>
                    <div className="text-3xl font-bold text-foreground pl-2">
                      {metrics.totalResponses}
                    </div>
                  </div>

                  {/* Completed */}
                  <div className="bg-card border border-border p-5 rounded-xl shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-green-500 group-hover:bg-green-600 transition-colors"></div>
                    <div className="flex justify-between items-start mb-2 pl-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Completed
                      </span>
                      <CheckCircle2 className="w-5 h-5 text-green-500/80" />
                    </div>
                    <div className="text-3xl font-bold text-foreground pl-2">
                      {metrics.completedResponses}
                    </div>
                  </div>

                  {/* Abandoned */}
                  <div className="bg-card border border-border p-5 rounded-xl shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500 group-hover:bg-red-600 transition-colors"></div>
                    <div className="flex justify-between items-start mb-2 pl-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Abandoned
                      </span>
                      <XCircle className="w-5 h-5 text-red-500/80" />
                    </div>
                    <div className="text-3xl font-bold text-foreground pl-2">
                      {metrics.abandonedResponses}
                    </div>
                  </div>

                  {/* Completion Rate */}
                  <div className="bg-card border border-border p-5 rounded-xl shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-500 group-hover:bg-purple-600 transition-colors"></div>
                    <div className="flex justify-between items-start mb-2 pl-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Completion Rate
                      </span>
                      <TrendingUp className="w-5 h-5 text-purple-500/80" />
                    </div>
                    <div className="text-3xl font-bold text-foreground pl-2">
                      {metrics.completionRate.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No metrics available</p>
              </div>
            )
          )}
        </div>
      </div>


    </>
  );
}
