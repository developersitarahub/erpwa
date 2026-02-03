"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Edit,
  Trash2,
  Send,
  Archive,
  BarChart3,
  Search,
  Filter,
  Layers,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  TrendingUp,
  FileText,
} from "lucide-react";
import api from "@/lib/api";
import FlowEditorModal from "@/components/flows/FlowEditorModal";
import FlowMetricsModal from "@/components/flows/FlowMetricsModal";
import { toast } from "react-toastify";

const ConfirmationToast = ({
  closeToast,
  message,
  description,
  onConfirm,
  confirmLabel = "Confirm",
}: any) => (
  <div className="flex flex-col gap-2">
    <p className="font-semibold text-sm text-foreground">{message}</p>
    <p className="text-xs text-muted-foreground">{description}</p>
    <div className="flex gap-2 mt-2 justify-end">
      <button
        onClick={closeToast}
        className="px-3 py-1.5 text-xs font-medium bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={() => {
          onConfirm();
          if (closeToast) closeToast();
        }}
        className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
      >
        {confirmLabel}
      </button>
    </div>
  </div>
);

interface Flow {
  id: string;
  name: string;
  category: string;
  status: "DRAFT" | "PUBLISHED" | "DEPRECATED";
  _count?: {
    responses: number;
    templates: number;
  };
}

export default function FlowsPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [showMetricsModal, setShowMetricsModal] = useState(false);

  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [settingUpKey, setSettingUpKey] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchFlows();
  }, []);

  const fetchFlows = async () => {
    try {
      setLoading(true);
      const response = await api.get("/whatsapp/flows");
      setFlows(response.data.flows || []);
    } catch (error) {
      console.error("Error fetching flows:", error);
      toast.error("Failed to load Flows");
    } finally {
      setLoading(false);
    }
  };

  const handleSetupEncryption = () => {
    toast(
      <ConfirmationToast
        message="Generate new Encryption Keys?"
        description="This is required for publishing Flows. Existing keys will be overwritten."
        confirmLabel="Generate"
        onConfirm={async () => {
          try {
            setSettingUpKey(true);
            const response = await api.post("/whatsapp/flows/setup-key");
            toast.success(
              response.data.message || "Encryption keys set up successfully!",
            );
          } catch (error: any) {
            console.error("Error setting up keys:", error);
            toast.error(
              error.response?.data?.message ||
              "Failed to setup encryption keys",
            );
          } finally {
            setSettingUpKey(false);
          }
        }}
      />,
      { autoClose: false, closeOnClick: false },
    );
  };

  const handleCreateFlow = () => {
    setSelectedFlow(null);
    setShowEditorModal(true);
  };

  const handleEditFlow = (flow: Flow) => {
    setSelectedFlow(flow);
    setShowEditorModal(true);
  };

  const handlePublishFlow = (flowId: string) => {
    toast(
      <ConfirmationToast
        message="Publish this Flow?"
        description="It will be available for use in templates. This cannot be edited once published."
        confirmLabel="Publish"
        onConfirm={async () => {
          let loadingToast;
          try {
            loadingToast = toast.loading("Publishing Flow...");
            await api.post(`/whatsapp/flows/${flowId}/publish`);
            toast.dismiss(loadingToast);
            toast.success("Flow published successfully!");
            fetchFlows();
          } catch (error: any) {
            if (loadingToast) toast.dismiss(loadingToast);
            const message =
              error.response?.data?.message || "Failed to publish Flow";
            const validationErrors = error.response?.data?.validationErrors;

            if (validationErrors && validationErrors.length > 0) {
              const errorDetails = validationErrors
                .map((e: any) => e.error)
                .join("\n");
              toast.error(`Validation Failed:\n${errorDetails}`);
            } else {
              toast.error(message);
            }
          }
        }}
      />,
      { autoClose: false, closeOnClick: false },
    );
  };

  const handleDeprecateFlow = (flowId: string) => {
    toast(
      <ConfirmationToast
        message="Deprecate this Flow?"
        description="New templates cannot use it, but existing ones will continue to work."
        confirmLabel="Deprecate"
        onConfirm={async () => {
          try {
            await api.post(`/whatsapp/flows/${flowId}/deprecate`);
            toast.success("Flow deprecated");
            fetchFlows();
          } catch (error: any) {
            toast.error(
              error.response?.data?.message || "Failed to deprecate Flow",
            );
          }
        }}
      />,
      { autoClose: false, closeOnClick: false },
    );
  };

  const handleDeleteFlow = (flowId: string) => {
    toast(
      <ConfirmationToast
        message="Delete this Flow?"
        description="This action cannot be undone. Templates using this flow may break."
        confirmLabel="Delete"
        onConfirm={async () => {
          try {
            await api.delete(`/whatsapp/flows/${flowId}`);
            toast.success("Flow deleted");
            fetchFlows();
          } catch (error: any) {
            toast.error(
              error.response?.data?.message || "Failed to delete Flow",
            );
          }
        }}
      />,
      { autoClose: false, closeOnClick: false },
    );
  };

  const handleViewMetrics = (flow: Flow) => {
    setSelectedFlow(flow);
    setShowMetricsModal(true);
  };

  const filteredFlows = flows.filter((flow) => {
    const matchesSearch = flow.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      flow.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Flow["status"]) => {
    const statusConfig: Record<Flow["status"], { color: string; icon: any }> = {
      DRAFT: {
        color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
        icon: Clock,
      },
      PUBLISHED: {
        color:
          "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
        icon: CheckCircle2,
      },
      DEPRECATED: {
        color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
        icon: XCircle,
      },
    };

    const config = statusConfig[status] || statusConfig.DRAFT;
    const Icon = config.icon;

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
      >
        <Icon className="w-3 h-3" />
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Layers className="w-8 h-8 text-primary" />
              WhatsApp Flows
            </h1>
            <p className="text-muted-foreground mt-1">
              Create interactive forms and structured experiences
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSetupEncryption}
              disabled={settingUpKey}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              title="Generate and Upload Encryption Keys to Meta"
            >
              <ShieldCheck className="w-5 h-5" />
              {settingUpKey ? "Setting up..." : "Setup Security"}
            </button>
            <button
              onClick={handleCreateFlow}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Flow
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search flows..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="deprecated">Deprecated</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground mt-2">Loading flows...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredFlows.length === 0 && (
          <div className="text-center py-12 bg-card border border-border rounded-lg">
            <Layers className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {searchTerm || statusFilter !== "all"
                ? "No flows found"
                : "No flows yet"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Create your first Flow to get started"}
            </p>
            {!searchTerm && statusFilter === "all" && (
              <button
                onClick={handleCreateFlow}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium"
              >
                <Plus className="w-5 h-5" />
                Create First Flow
              </button>
            )}
          </div>
        )}

        {/* Flows Grid */}
        {!loading && filteredFlows.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredFlows.map((flow) => (
                <motion.div
                  key={flow.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-shadow"
                >
                  {/* Flow Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-1">
                        {flow.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {flow.category}
                      </p>
                    </div>
                    {getStatusBadge(flow.status)}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-4 py-4 border-t border-b border-border">
                    <div
                      className="cursor-pointer hover:bg-muted/50 p-1 rounded transition-colors"
                      onClick={() => handleViewMetrics(flow)}
                      title="View Responses"
                    >
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        Responses <TrendingUp className="w-3 h-3" />
                      </p>
                      <p className="text-2xl font-bold text-foreground">
                        {flow._count?.responses || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Templates</p>
                      <p className="text-2xl font-bold text-foreground">
                        {flow._count?.templates || 0}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-4 border-t border-border mt-auto">
                    {/* Primary Action */}
                    {flow.status === "DRAFT" ? (
                      <button
                        onClick={() => handlePublishFlow(flow.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                      >
                        <Send className="w-4 h-4" />
                        Publish
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEditFlow(flow)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors shadow-sm"
                      >
                        <Edit className="w-4 h-4" />
                        Edit Flow
                      </button>
                    )}

                    {/* Secondary Actions */}
                    <div className="flex items-center gap-1 border-l border-border pl-3">
                      <button
                        onClick={() => router.push(`/admin/flows/${flow.id}/responses`)}
                        className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors"
                        title="View Responses"
                      >
                        <FileText className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleViewMetrics(flow)}
                        className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors"
                        title="View Analytics"
                      >
                        <BarChart3 className="w-4 h-4" />
                      </button>

                      {flow.status === "PUBLISHED" && (
                        <button
                          onClick={() => handleDeprecateFlow(flow.id)}
                          className="p-2 hover:bg-orange-100 dark:hover:bg-orange-900/20 text-muted-foreground hover:text-orange-600 dark:hover:text-orange-400 rounded-md transition-colors"
                          title="Deprecate Flow"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteFlow(flow.id)}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 rounded-md transition-colors"
                        title="Delete Flow"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Modals */}
      {showEditorModal && (
        <FlowEditorModal
          isOpen={showEditorModal}
          onClose={() => {
            setShowEditorModal(false);
            setSelectedFlow(null);
          }}
          flow={selectedFlow}
          onSave={() => {
            fetchFlows();
            setShowEditorModal(false);
            setSelectedFlow(null);
          }}
        />
      )}

      {showMetricsModal && selectedFlow && (
        <FlowMetricsModal
          isOpen={showMetricsModal}
          onClose={() => {
            setShowMetricsModal(false);
            setSelectedFlow(null);
          }}
          flowId={selectedFlow.id}
          flowName={selectedFlow.name}
        />
      )}


    </div>
  );
}
