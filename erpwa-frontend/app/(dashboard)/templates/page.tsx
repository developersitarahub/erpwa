"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";
import { Button } from "@/components/button";
import { Checkbox } from "@/components/checkbox";
import { Badge } from "@/components/badge";
import { Input } from "@/components/input";
import { Select, SelectOption } from "@/components/select";

import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Search,
  X,
  Plus,
  Paperclip,
  Image as ImageIcon,
  Video,
  FileText,
  Loader2,
  Send,
  MoreVertical,
  Phone,
  Globe,
  Upload,
  AlertTriangle,
  Users,
  Eye,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "react-toastify";
import { cn } from "@/lib/utils";
import { leadsAPI } from "@/lib/leadsApi";
import { Lead } from "@/lib/types";

const formatError = (error: any, defaultMsg: string) => {
  const errorData = error.response?.data;
  let msg = errorData?.details?.error_user_msg || errorData?.details?.message || errorData?.message || defaultMsg;
  const title = errorData?.details?.error_user_title;

  // Shorten specific common Meta messages
  if (msg.includes("too many variables for its length")) {
    msg = "Too many variables for the text length.";
  } else if (msg.includes("more than two consecutive newline characters")) {
    msg = "Invalid body: Check newlines, parameters, or emojis.";
  }

  return title ? `${title}: ${msg}` : msg;
};

// Types
type Template = {
  id: string;
  metaTemplateName: string;
  displayName: string;
  category: string;
  status: string;
  createdAt: string;
  languages: {
    language: string;
    body: string;
    headerType: string;
    media?: any;
    metaReason?: string;
    footerText?: string;
    headerText?: string;
  }[];
  buttons: {
    type: string;
    text: string;
    value?: string;
  }[];
  media?: {
    id: string;
    mediaType: string;
    s3Url: string;
    language: string;
  }[];
  createdByName?: string;
};

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  // --- Delete Modal State ---
  const [deleteConf, setDeleteConf] = useState<{
    isOpen: boolean;
    id?: string;
    title?: string;
  }>({ isOpen: false });

  // --- Create/Edit Modal State ---
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    displayName: "",
    category: "MARKETING",
    language: "en_US",
    headerType: "TEXT",
    body: "",
    footerText: "",
    headerText: "",
  });

  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [headerPreview, setHeaderPreview] = useState<string | null>(null);
  const [buttons, setButtons] = useState<
    { type: string; text: string; value?: string }[]
  >([]);

  // --- Send Modal State ---
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );
  const [recipientInput, setRecipientInput] = useState("");
  const [recipientList, setRecipientList] = useState<string[]>([]);
  const [variables, setVariables] = useState<string[]>([]);
  // variableSources: maps index -> "custom" | "company_name" | "name"
  const [variableSources, setVariableSources] = useState<
    Record<number, string>
  >({});
  const [sending, setSending] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [showLeadsDropdown, setShowLeadsDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>("");

  useEffect(() => {
    if (showSendModal) {
      leadsAPI
        .list()
        .then((res) => {
          if (res.data && Array.isArray(res.data.leads)) {
            setLeads(res.data.leads);
          }
        })
        .catch((err) => console.error("Failed to fetch leads", err));
    }
  }, [showSendModal]);

  // Fetch Templates
  const fetchTemplates = async () => {
    try {
      const res = await api.get("/vendor/templates");
      setTemplates(res.data);
    } catch (error) {
      console.error("Failed to fetch templates", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // --- Create/Edit Handlers ---

  const resetForm = () => {
    setFormData({
      displayName: "",
      category: "MARKETING",
      language: "en_US",
      headerType: "TEXT",
      body: "",
      footerText: "",
      headerText: "",
    });
    setHeaderFile(null);
    setHeaderPreview(null);
    setButtons([]);
    setEditId(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (template: Template) => {
    const lang = template.languages?.[0];
    setFormData({
      displayName: template.displayName,
      category: template.category,
      language: lang?.language || "en_US",
      headerType: lang?.headerType || "TEXT",
      body: lang?.body || "",
      footerText: lang?.footerText || "",
      headerText: lang?.headerText || "",
    });

    if (template.buttons) {
      setButtons(
        template.buttons.map((b: any) => ({
          type: b.type,
          text: b.text,
          value: b.value || "",
        }))
      );
    } else {
      setButtons([]);
    }

    setHeaderFile(null);
    const media = template.media?.find((m) => m.language === lang?.language);
    setHeaderPreview(media?.s3Url || null);
    setEditId(template.id);
    setShowCreateModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setHeaderFile(file);

      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => setHeaderPreview(e.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setHeaderPreview(null);
      }
    }
  };

  const addVariable = () => {
    const varCount = (formData.body.match(/{{\d+}}/g) || []).length + 1;
    setFormData({ ...formData, body: formData.body + ` {{${varCount}}} ` });
  };

  const addButton = (type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER") => {
    if (buttons.length >= 3) return toast.info("Max 3 buttons allowed");
    setButtons([...buttons, { type, text: "", value: "" }]);
  };

  const removeButton = (index: number) => {
    const newButtons = [...buttons];
    newButtons.splice(index, 1);
    setButtons(newButtons);
  };

  const updateButton = (index: number, key: string, val: string) => {
    const newButtons = [...buttons];
    (newButtons[index] as any)[key] = val;
    setButtons(newButtons);
  };

  const handleCreateSubmit = async () => {
    if (!formData.displayName || !formData.body) {
      return toast.error("Please fill required fields");
    }

    if (formData.headerType !== "TEXT" && !headerFile && !editId) {
      return toast.error("Please upload a header file");
    }

    setIsCreating(true);

    const metaTemplateName = formData.displayName
      .toLowerCase()
      .replace(/[^a-z0-9\s_]/g, "")
      .trim()
      .replace(/\s+/g, "_");

    try {
      const data = new FormData();
      if (!editId) {
        data.append("metaTemplateName", metaTemplateName);
      }
      data.append("displayName", formData.displayName);
      data.append("category", formData.category);
      data.append("language", formData.language);
      data.append("body", formData.body);
      data.append("header.type", formData.headerType);

      if (formData.footerText) {
        data.append("footerText", formData.footerText);
      }

      if (formData.headerType === "TEXT" && formData.headerText) {
        data.append("header.text", formData.headerText);
      }

      if (formData.headerType !== "TEXT" && headerFile) {
        data.append("header.file", headerFile);
      }

      buttons.forEach((btn, index) => {
        data.append(`buttons[${index}][type]`, btn.type);
        data.append(`buttons[${index}][text]`, btn.text);
        if (btn.value) {
          data.append(`buttons[${index}][value]`, btn.value);
        }
      });

      if (editId) {
        await api.put(`/vendor/templates/${editId}`, data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Template updated successfully!");
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === editId
              ? {
                ...t,
                displayName: formData.displayName,
                category: formData.category,
              }
              : t
          )
        );
        fetchTemplates();
      } else {
        await api.post("/vendor/templates", data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Template created successfully!");
        fetchTemplates();
      }

      setShowCreateModal(false);
    } catch (error: any) {
      toast.error(formatError(error, "Failed to save template"));
    } finally {
      setIsCreating(false);
    }
  };

  // --- List Item Handlers ---

  const handleSubmitToMeta = async (
    template: Template,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (submitting) return;

    setSubmitting(template.id);
    try {
      await api.post(`/vendor/templates/${template.id}/submit`);
      toast.success("Template submitted to Meta successfully!");
      fetchTemplates();
    } catch (error: any) {
      toast.error(formatError(error, "Failed to submit template"));
    } finally {
      setSubmitting(null);
    }
  };

  const handleSyncStatus = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncing(id);
    try {
      const res = await api.post(`/vendor/templates/${id}/sync-status`);
      toast.success(res.data.message || "Status synced successfully");
      fetchTemplates();
    } catch (error: any) {
      toast.error(formatError(error, "Failed to sync status"));
    } finally {
      setSyncing(null);
    }
  };

  const handleDelete = (template: Template, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConf({
      isOpen: true,
      id: template.id,
      title: template.displayName,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConf.id) return;

    const id = deleteConf.id;
    setDeleting(id);
    try {
      await api.delete(`/vendor/templates/${id}`);
      toast.success("Template deleted successfully");
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (error: any) {
      toast.error(formatError(error, "Failed to delete template"));
    } finally {
      setDeleting(null);
      setDeleteConf({ isOpen: false });
    }
  };

  const handleCardClick = (template: Template) => {
    if (template.status === "approved") {
      openSendModal(template);
    } else if (template.status === "draft" || template.status === "rejected") {
      openEditModal(template);
    }
  };

  // --- Send Modal Handlers ---

  const openSendModal = (template: Template) => {
    setSelectedTemplate(template);
    setRecipientList([]);
    setRecipientInput("");

    const body = template.languages[0]?.body || "";
    const match = body.match(/{{\d+}}/g);
    const count = match ? new Set(match).size : 0;
    setVariables(new Array(count).fill(""));

    setShowSendModal(true);
  };

  const addRecipient = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && recipientInput.trim()) {
      e.preventDefault();
      if (!recipientList.includes(recipientInput.trim())) {
        setRecipientList([...recipientList, recipientInput.trim()]);
      }
      setRecipientInput("");
    }
  };

  const removeRecipient = (index: number) => {
    setRecipientList(recipientList.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!selectedTemplate) return;
    if (recipientList.length === 0)
      return toast.error("Please add at least one recipient");

    setSending(true);
    try {
      // Check if we need dynamic variables
      const hasDynamicVariables = Object.values(variableSources).some(
        (v) => v === "company_name"
      );
      let payload: any = {
        templateId: selectedTemplate.id,
      };

      if (hasDynamicVariables) {
        // Build per-recipient messages
        const customMessages = recipientList.map((mobile) => {
          // Find the lead info
          const lead = leads.find((l) => l.mobile_number === mobile);
          const companyName = lead?.company_name || "Valued Customer"; // Fallback

          // Map variables for this recipient
          const bodyVariables = variables.map((val, idx) => {
            if (variableSources[idx] === "company_name") {
              return companyName;
            }
            return val;
          });

          return {
            to: mobile,
            bodyVariables,
          };
        });
        payload.customMessages = customMessages;
      } else {
        // Standard bulk send
        payload.recipients = recipientList;
        payload.bodyVariables = variables;
      }

      const res = await api.post(
        "/vendor/whatsapp/template/send-template",
        payload
      );

      const results = res.data.results || [];
      const failed = results.filter((r: any) => !r.success);

      if (failed.length > 0) {
        // Show first error message
        const firstError =
          failed[0].error?.message ||
          JSON.stringify(failed[0].error) ||
          "Unknown error";
        if (failed.length === results.length) {
          toast.error(`Failed to send: ${firstError}`);
        } else {
          toast.warning(
            `${results.length - failed.length} sent, ${failed.length
            } failed. First error: ${firstError}`
          );
        }
      } else {
        toast.success("Messages sent successfully!");
        setShowSendModal(false);
      }
    } catch (error: any) {
      toast.error(formatError(error, "Failed to send"));
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-200/50 px-2 py-0.5 text-[10px] uppercase tracking-wider backdrop-blur-sm">
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-200/50 px-2 py-0.5 text-[10px] uppercase tracking-wider backdrop-blur-sm">
            Rejected
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border-yellow-200/50 px-2 py-0.5 text-[10px] uppercase tracking-wider backdrop-blur-sm">
            Pending
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="text-[10px] uppercase tracking-wider text-muted-foreground"
          >
            Draft
          </Badge>
        );
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return "12:00";
    }
  };

  return (
    <div className="flex-1 overflow-auto p-4 md:p-8 space-y-8 bg-gradient-to-br from-background via-background/95 to-muted/20 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              Message Templates
            </h1>
            <p className="text-sm text-muted-foreground/80 max-w-lg leading-relaxed">
              Create and manage your WhatsApp templates. Approved templates can
              be used for bulk marketing and utility messaging.
            </p>
          </div>
          <Button
            onClick={openCreateModal}
            className="shadow-lg shadow-green-500/20 bg-green-600 hover:bg-green-700 text-white transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4 mr-2" /> New Template
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-50">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-primary/50"></div>
              </div>
            </div>
            <p className="text-sm font-medium animate-pulse">
              Loading templates...
            </p>
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 border border-dashed border-border/60 rounded-2xl bg-muted/5 gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-2">
              <FileText className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold">No templates yet</h3>
            <p className="text-muted-foreground text-center max-w-sm text-sm">
              Get started by creating your first WhatsApp template approval.
            </p>
            <Button
              variant="link"
              onClick={openCreateModal}
              className="text-primary mt-2"
            >
              Create Template &rarr;
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="group h-full"
              >
                <Card
                  onClick={() => handleCardClick(t)}
                  className={cn(
                    "h-full flex flex-col cursor-pointer border-border/50 bg-card/50 backdrop-blur-sm shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 overflow-hidden group-hover:border-primary/20",
                    t.status === "approved" && "hover:border-green-500/30"
                  )}
                >
                  {/* Card Header area */}
                  <div className="p-5 flex flex-col gap-3 border-b border-border/40 bg-gradient-to-b from-muted/30 to-transparent">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <h3
                          className="font-semibold text-base text-foreground truncate"
                          title={t.displayName}
                        >
                          {t.displayName}
                        </h3>
                      </div>
                      <div className="shrink-0">{getStatusBadge(t.status)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] font-normal px-1.5 py-0 h-5 border-border/50 text-muted-foreground shrink-0"
                      >
                        {t.category}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground/60">
                        •
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {t.languages[0]?.language}
                      </span>
                    </div>
                  </div>

                  {/* Card Body - Message Preview style */}
                  <CardContent className="p-0 flex-1 flex flex-col relative bg-muted/5">
                    <div className="p-5 flex-1 relative overflow-hidden">
                      {/* Subtle background pattern for whatsapp feel */}
                      <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]"></div>

                      <div className="bg-white dark:bg-muted rounded-tr-xl rounded-bl-xl rounded-br-xl rounded-tl-none p-3 shadow-sm border border-border/20 text-xs text-foreground/80 leading-relaxed font-sans relative z-10 max-w-[90%] before:content-[''] before:absolute before:top-0 before:-left-1.5 before:w-3 before:h-3 before:bg-white dark:before:bg-muted before:[clip-path:polygon(100%_0,0_0,100%_100%)]">
                        {t.languages[0]?.headerType !== "TEXT" && (
                          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-dashed border-border/40 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                            {t.languages[0]?.headerType === "IMAGE" ? (
                              <ImageIcon className="w-3 h-3" />
                            ) : (
                              <Paperclip className="w-3 h-3" />
                            )}
                            {t.languages[0]?.headerType}
                          </div>
                        )}
                        <p className="line-clamp-4 whitespace-pre-wrap">
                          {t.languages[0]?.body || "No content"}
                        </p>
                        <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-dashed border-border/40">
                          {t.createdByName && (
                            <span className="text-[9px] text-muted-foreground font-medium">
                              By {t.createdByName}
                            </span>
                          )}
                          <span className="text-[9px] text-muted-foreground font-medium">
                            {formatTime(t.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Footer */}
                    <div className="p-3 bg-card border-t border-border/40 flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "flex-1 h-8 text-xs font-bold transition-all",
                          t.status === "draft"
                            ? "text-blue-600 bg-blue-500/5 hover:bg-blue-500/10"
                            : t.status === "approved"
                              ? "text-green-600 bg-green-500/5 hover:bg-green-500/10"
                              : "text-muted-foreground bg-muted/30 hover:bg-muted/50"
                        )}
                        onClick={(e) => {
                          if (t.status === "approved") {
                            e.stopPropagation();
                            openSendModal(t);
                          } else if (t.status === "draft") {
                            handleSubmitToMeta(t, e);
                          } else {
                            handleSyncStatus(t.id, e);
                          }
                        }}
                        disabled={!!syncing || !!submitting}
                      >
                        {syncing === t.id || submitting === t.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin mr-1.5" />
                        ) : t.status === "draft" ? (
                          <Upload className="w-3 h-3 mr-1.5" />
                        ) : t.status === "approved" ? (
                          <Send className="w-3 h-3 mr-1.5" />
                        ) : (
                          <RefreshCw className="w-3 h-3 mr-1.5" />
                        )}
                        {t.status === "draft"
                          ? "Submit"
                          : t.status === "approved"
                            ? "Send"
                            : "Sync"}
                      </Button>
                      <div className="w-px h-4 bg-border/60"></div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-8 text-xs font-bold text-red-500/80 bg-red-500/5 hover:text-red-600 hover:bg-red-500/10 transition-all font-bold"
                        onClick={(e) => handleDelete(t, e)}
                        disabled={!!deleting}
                      >
                        {deleting === t.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin mr-1.5" />
                        ) : (
                          <Trash2 className="w-3 h-3 mr-1.5" />
                        )}
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* SEND MODAL */}
      <AnimatePresence>
        {showSendModal && selectedTemplate && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setShowSendModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-background w-full max-w-2xl sm:rounded-2xl shadow-2xl border border-border/40 overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-border/50 flex justify-between items-center bg-muted/10">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Send className="w-4 h-4 text-green-600" />
                    Send Message
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedTemplate.displayName}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setShowSendModal(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-0">
                <div className="p-6 space-y-6">
                  {/* Preview Section */}
                  <div className="bg-muted/10 rounded-xl p-4 border border-border/50 space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Preview
                    </label>
                    <div className="bg-white dark:bg-card p-4 rounded-lg shadow-sm border border-border/20 text-sm whitespace-pre-wrap leading-relaxed">
                      {/* Media Header Preview */}
                      {selectedTemplate.languages[0]?.headerType !== "TEXT" && (() => {
                        const mediaItem = selectedTemplate.media?.find(m => m.language === selectedTemplate.languages[0]?.language);
                        if (mediaItem?.s3Url) {
                          if (selectedTemplate.languages[0].headerType === "IMAGE") {
                            return (
                              <div className="rounded-lg overflow-hidden bg-black/40 border border-border/10 mb-3 shadow-md flex items-center justify-center min-h-[140px]">
                                <img src={mediaItem.s3Url} alt="Header" className="w-full h-full object-contain" />
                              </div>
                            );
                          } else if (selectedTemplate.languages[0].headerType === "VIDEO") {
                            return (
                              <div className="rounded-lg overflow-hidden bg-black/40 border border-border/10 mb-3 relative shadow-md flex items-center justify-center min-h-[140px]">
                                <video src={mediaItem.s3Url} className="w-full h-full object-contain" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                  <div className="w-10 h-10 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center text-white">
                                    <Video className="w-5 h-5" />
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        }
                        return null;
                      })()}

                      {/* Header Text Preview */}
                      {selectedTemplate.languages[0]?.headerType === "TEXT" && selectedTemplate.languages[0]?.headerText && (
                        <p className="font-bold text-sm mb-2 text-foreground">
                          {selectedTemplate.languages[0].headerText}
                        </p>
                      )}

                      <div className="text-foreground/90">
                        {selectedTemplate.languages[0]?.body}
                      </div>

                      {selectedTemplate.languages[0]?.footerText && (
                        <p className="mt-3 text-[11px] text-muted-foreground border-t border-border/40 pt-2 italic">
                          {selectedTemplate.languages[0].footerText}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Variables Section */}
                  {variables.length > 0 && (
                    <div className="space-y-3">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-1 flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5" /> Variables
                      </label>
                      <div className="grid grid-cols-1 gap-4 bg-muted/5 p-4 rounded-xl border border-border/50">
                        {variables.map((val, idx) => (
                          <div key={idx} className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-medium text-muted-foreground uppercase">
                                Variable {`{{${idx + 1}}}`}
                              </span>

                              <div className="flex bg-muted rounded-md p-0.5">
                                <button
                                  onClick={() =>
                                    setVariableSources((prev) => ({
                                      ...prev,
                                      [idx]: "custom",
                                    }))
                                  }
                                  className={cn(
                                    "px-2 py-0.5 text-[10px] rounded-sm transition-all",
                                    !variableSources[idx] ||
                                      variableSources[idx] === "custom"
                                      ? "bg-background shadow-sm text-foreground font-medium"
                                      : "text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  Custom
                                </button>
                                <button
                                  onClick={() =>
                                    setVariableSources((prev) => ({
                                      ...prev,
                                      [idx]: "company_name",
                                    }))
                                  }
                                  className={cn(
                                    "px-2 py-0.5 text-[10px] rounded-sm transition-all",
                                    variableSources[idx] === "company_name"
                                      ? "bg-background shadow-sm text-foreground font-medium"
                                      : "text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  Company
                                </button>
                              </div>
                            </div>

                            {variableSources[idx] === "company_name" ? (
                              <div className="h-9 px-3 rounded-md border bg-muted/20 flex items-center text-sm text-muted-foreground italic">
                                Will use recipient's company name
                              </div>
                            ) : (
                              <Input
                                className="bg-background h-9"
                                placeholder={`Value for {{${idx + 1}}}`}
                                value={val}
                                onChange={(e) => {
                                  const n = [...variables];
                                  n[idx] = e.target.value;
                                  setVariables(n);
                                }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recipients Section */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-semibold text-foreground">
                        Select Recipients
                      </label>
                      <span className="text-xs text-muted-foreground">
                        {recipientList.length} selected
                      </span>
                    </div>

                    {/* Filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Select
                        value={selectedCategory}
                        onChange={(e) => {
                          setSelectedCategory(e.target.value);
                          setSelectedSubCategory("");
                        }}
                      >
                        <SelectOption value="">All Categories</SelectOption>
                        {Array.from(
                          new Set(
                            leads.map((l) => l.category_name).filter(Boolean)
                          )
                        ).map((c) => (
                          <SelectOption key={c} value={c as string}>
                            {c}
                          </SelectOption>
                        ))}
                      </Select>

                      <Select
                        value={selectedSubCategory}
                        onChange={(e) => setSelectedSubCategory(e.target.value)}
                      >
                        <SelectOption value="">All Sub-Categories</SelectOption>
                        {Array.from(
                          new Set(
                            leads
                              .filter(
                                (l) =>
                                  !selectedCategory ||
                                  l.category_name === selectedCategory
                              )
                              .map((l) => l.sub_category_name)
                              .filter(Boolean)
                          )
                        ).map((sc) => (
                          <SelectOption key={sc} value={sc as string}>
                            {sc}
                          </SelectOption>
                        ))}
                      </Select>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or phone..."
                        className="pl-9 bg-background/50 border-border/60"
                        value={recipientInput}
                        onChange={(e) => setRecipientInput(e.target.value)}
                      />
                    </div>

                    <div className="border border-border/60 rounded-xl overflow-hidden bg-card/30">
                      {/* Select All Row */}
                      {leads.length > 0 && (
                        <div className="p-3 border-b border-border/60 bg-muted/20 flex items-center gap-3">
                          <Checkbox
                            checked={
                              leads.filter(
                                (l) =>
                                  (!recipientInput ||
                                    l.company_name
                                      .toLowerCase()
                                      .includes(recipientInput.toLowerCase()) ||
                                    l.mobile_number.includes(recipientInput)) &&
                                  (!selectedCategory ||
                                    l.category_name === selectedCategory) &&
                                  (!selectedSubCategory ||
                                    l.sub_category_name === selectedSubCategory)
                              ).length > 0 &&
                              leads
                                .filter(
                                  (l) =>
                                    (!recipientInput ||
                                      l.company_name
                                        .toLowerCase()
                                        .includes(
                                          recipientInput.toLowerCase()
                                        ) ||
                                      l.mobile_number.includes(
                                        recipientInput
                                      )) &&
                                    (!selectedCategory ||
                                      l.category_name === selectedCategory) &&
                                    (!selectedSubCategory ||
                                      l.sub_category_name ===
                                      selectedSubCategory)
                                )
                                .every((l) =>
                                  recipientList.includes(l.mobile_number)
                                )
                            }
                            onChange={() => {
                              const filtered = leads.filter(
                                (l) =>
                                  (!recipientInput ||
                                    l.company_name
                                      .toLowerCase()
                                      .includes(recipientInput.toLowerCase()) ||
                                    l.mobile_number.includes(recipientInput)) &&
                                  (!selectedCategory ||
                                    l.category_name === selectedCategory) &&
                                  (!selectedSubCategory ||
                                    l.sub_category_name === selectedSubCategory)
                              );
                              const allSelected = filtered.every((l) =>
                                recipientList.includes(l.mobile_number)
                              );

                              if (allSelected) {
                                const visiblePhones = filtered.map(
                                  (l) => l.mobile_number
                                );
                                setRecipientList(
                                  recipientList.filter(
                                    (p) => !visiblePhones.includes(p)
                                  )
                                );
                              } else {
                                const visiblePhones = filtered.map(
                                  (l) => l.mobile_number
                                );
                                setRecipientList([
                                  ...new Set([
                                    ...recipientList,
                                    ...visiblePhones,
                                  ]),
                                ]);
                              }
                            }}
                          />
                          <span className="text-sm font-medium">
                            Select All (
                            {
                              leads.filter(
                                (l) =>
                                  (!recipientInput ||
                                    l.company_name
                                      .toLowerCase()
                                      .includes(recipientInput.toLowerCase()) ||
                                    l.mobile_number.includes(recipientInput)) &&
                                  (!selectedCategory ||
                                    l.category_name === selectedCategory) &&
                                  (!selectedSubCategory ||
                                    l.sub_category_name === selectedSubCategory)
                              ).length
                            }
                            )
                          </span>
                        </div>
                      )}

                      {/* List */}
                      <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-border divide-y divide-border/40">
                        {leads
                          .filter(
                            (l) =>
                              (!recipientInput ||
                                l.company_name
                                  .toLowerCase()
                                  .includes(recipientInput.toLowerCase()) ||
                                l.mobile_number.includes(recipientInput)) &&
                              (!selectedCategory ||
                                l.category_name === selectedCategory) &&
                              (!selectedSubCategory ||
                                l.sub_category_name === selectedSubCategory)
                          )
                          .map((lead) => (
                            <div
                              key={lead.id}
                              className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                              onClick={() => {
                                if (
                                  recipientList.includes(lead.mobile_number)
                                ) {
                                  setRecipientList(
                                    recipientList.filter(
                                      (p) => p !== lead.mobile_number
                                    )
                                  );
                                } else {
                                  setRecipientList([
                                    ...recipientList,
                                    lead.mobile_number,
                                  ]);
                                }
                              }}
                            >
                              <Checkbox
                                checked={recipientList.includes(
                                  lead.mobile_number
                                )}
                                onChange={() => { }} // handled by parent div click
                                className="pointer-events-none"
                              />
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-foreground">
                                  {lead.company_name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {lead.mobile_number}
                                </span>
                              </div>
                            </div>
                          ))}

                        {leads.length === 0 && (
                          <div className="p-8 flex flex-col items-center justify-center text-muted-foreground gap-2">
                            <Users className="w-8 h-8 opacity-20" />
                            <p className="text-sm">
                              No leads found in database.
                            </p>
                          </div>
                        )}

                        {leads.length > 0 &&
                          leads.filter(
                            (l) =>
                              (!recipientInput ||
                                l.company_name
                                  .toLowerCase()
                                  .includes(recipientInput.toLowerCase()) ||
                                l.mobile_number.includes(recipientInput)) &&
                              (!selectedCategory ||
                                l.category_name === selectedCategory) &&
                              (!selectedSubCategory ||
                                l.sub_category_name === selectedSubCategory)
                          ).length === 0 && (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                              No matching leads found
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-border bg-muted/10 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowSendModal(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white min-w-[150px] shadow-lg shadow-green-500/20"
                  onClick={handleSend}
                  disabled={sending}
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Send Message
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE / EDIT TEMPLATE MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-background w-full max-w-6xl sm:rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col h-full sm:h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-5 border-b border-border flex justify-between items-center shrink-0 bg-muted/10">
                <div>
                  <h2 className="text-lg font-bold">
                    {editId ? "Edit Template" : "New Template"}
                  </h2>
                  <p className="text-xs text-muted-foreground/80">
                    Design your WhatsApp message layout
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="lg:hidden h-8 text-xs gap-2"
                    onClick={() => setShowMobilePreview(!showMobilePreview)}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => setShowCreateModal(false)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 bg-muted/5 divide-y lg:divide-y-0 lg:divide-x divide-border/50">
                {/* LEFT: FORM */}
                <div className="lg:col-span-7 xl:col-span-8 p-4 sm:p-6 overflow-y-auto space-y-6 scrollbar-thin">
                  <div className="space-y-6 max-w-3xl">
                    {/* Basic Info Group */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                        <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                          1
                        </div>
                        Basic Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-8">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">
                            Template Name{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <Input
                            placeholder="e.g. welcome_discount"
                            value={formData.displayName}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                displayName: e.target.value,
                              })
                            }
                            className="bg-background"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">
                            Category
                          </label>
                          <div className="relative">
                            <select
                              className="w-full h-10 pl-3 pr-8 border rounded-md bg-background text-sm appearance-none focus:ring-2 focus:ring-primary/20 outline-none border-input"
                              value={formData.category}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  category: e.target.value,
                                })
                              }
                            >
                              <option value="MARKETING">Marketing</option>
                              <option value="UTILITY">Utility</option>
                              <option value="AUTHENTICATION">
                                Authentication
                              </option>
                            </select>
                            <div className="absolute right-3 top-3 pointer-events-none opacity-50">
                              <MoreVertical className="w-4 h-4" />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                          <label className="text-xs font-medium">
                            Language
                          </label>
                          <div className="flex gap-2">
                            {["en_US", "hi_IN"].map((lang) => (
                              <div
                                key={lang}
                                onClick={() =>
                                  setFormData({ ...formData, language: lang })
                                }
                                className={cn(
                                  "px-3 py-1.5 rounded-md border text-xs cursor-pointer transition-all",
                                  formData.language === lang
                                    ? "bg-primary/10 border-primary text-primary font-medium shadow-sm"
                                    : "bg-background border-border hover:bg-muted"
                                )}
                              >
                                {lang === "en_US"
                                  ? "English (US)"
                                  : "Hindi (India)"}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="w-full h-px bg-border/40"></div>

                    {/* Content Group */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                        <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                          2
                        </div>
                        Message Content
                      </h3>
                      <div className="pl-8 space-y-5">
                        {/* Header Selection */}
                        <div className="space-y-2">
                          <label className="text-xs font-medium">
                            Header Type
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {["TEXT", "IMAGE", "VIDEO", "DOCUMENT"].map(
                              (type) => (
                                <div
                                  key={type}
                                  className={cn(
                                    "px-3 py-1.5 rounded-md border text-xs cursor-pointer transition-all flex items-center gap-2",
                                    formData.headerType === type
                                      ? "bg-primary/10 border-primary text-primary font-medium shadow-sm"
                                      : "bg-background border-border hover:bg-muted scale-95 opacity-80 hover:opacity-100 hover:scale-100"
                                  )}
                                  onClick={() => {
                                    setFormData({
                                      ...formData,
                                      headerType: type,
                                    });
                                    setHeaderFile(null);
                                  }}
                                >
                                  {type === "IMAGE" && (
                                    <ImageIcon className="w-3 h-3" />
                                  )}
                                  {type === "VIDEO" && (
                                    <Video className="w-3 h-3" />
                                  )}
                                  {type === "DOCUMENT" && (
                                    <FileText className="w-3 h-3" />
                                  )}
                                  {type}
                                </div>
                              )
                            )}
                          </div>

                          {formData.headerType === "TEXT" && (
                            <div className="mt-2 space-y-1.5">
                              <label className="text-xs font-medium">
                                Header Text
                              </label>
                              <Input
                                placeholder="e.g. Special Offer"
                                className="bg-background"
                                value={formData.headerText}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    headerText: e.target.value,
                                  })
                                }
                              />
                              <p className="text-[10px] text-muted-foreground">
                                Text to appear in the header (optional, simpler
                                than body)
                              </p>
                            </div>
                          )}

                          {formData.headerType !== "TEXT" && (
                            <div
                              className="mt-2 border border-dashed border-primary/20 rounded-lg p-6 flex flex-col items-center justify-center bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer group"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <input
                                type="file"
                                className="hidden"
                                ref={fileInputRef}
                                accept={
                                  formData.headerType === "IMAGE"
                                    ? "image/*"
                                    : formData.headerType === "VIDEO"
                                      ? "video/*"
                                      : ".pdf"
                                }
                                onChange={handleFileChange}
                              />

                              {headerFile || headerPreview ? (
                                <div className="text-center space-y-2">
                                  {headerPreview && (
                                    <img
                                      src={headerPreview}
                                      alt="Preview"
                                      className="h-24 object-contain mx-auto rounded-md shadow-sm border border-border"
                                    />
                                  )}
                                  <div className="flex items-center gap-2 bg-background p-1.5 rounded border border-border/50 text-xs shadow-sm">
                                    <Paperclip className="w-3 h-3" />
                                    <span className="font-medium truncate max-w-[150px]">
                                      {headerFile ? headerFile.name : (formData.headerType + " Attached")}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="w-4 h-4 rounded-full ml-1 text-muted-foreground hover:text-red-500"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setHeaderFile(null);
                                        setHeaderPreview(null);
                                      }}
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center space-y-2">
                                  <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center mx-auto shadow-sm group-hover:scale-110 transition-transform">
                                    <Plus className="w-5 h-5 text-primary" />
                                  </div>
                                  <p className="text-xs text-muted-foreground font-medium">
                                    Click to upload{" "}
                                    {formData.headerType.toLowerCase()}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Body Text */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-medium">
                              Body Message{" "}
                              <span className="text-red-500">*</span>
                            </label>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={addVariable}
                              className="h-6 text-[10px] bg-background"
                            >
                              <Plus className="w-3 h-3 mr-1" /> Variable
                            </Button>
                          </div>
                          <div className="relative">
                            <textarea
                              className="w-full min-h-[120px] p-3 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none font-sans text-sm leading-relaxed"
                              placeholder="Hello {{1}}, check out our latest offers..."
                              value={formData.body}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  body: e.target.value,
                                })
                              }
                            />
                            <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground bg-background/80 px-1 rounded">
                              {formData.body.length} chars
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Use {`{{1}}`}, {`{{2}}`} etc. for variables.
                          </p>
                        </div>

                        {/* Footer */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">
                            Footer Text (Optional)
                          </label>
                          <Input
                            className="bg-background h-9 text-sm"
                            placeholder="e.g. Reply STOP to unsubscribe"
                            value={formData.footerText}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                footerText: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="w-full h-px bg-border/40"></div>

                    {/* Buttons Group */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                          <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                            3
                          </div>
                          Interactivity
                        </h3>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px]"
                            onClick={() => addButton("QUICK_REPLY")}
                          >
                            + Quick Reply
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px]"
                            onClick={() => addButton("URL")}
                          >
                            + Link
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px]"
                            onClick={() => addButton("PHONE_NUMBER")}
                          >
                            + Phone
                          </Button>
                        </div>
                      </div>

                      <div className="pl-8 space-y-3">
                        {buttons.length === 0 && (
                          <div className="text-center py-6 text-xs text-muted-foreground/60 border border-dashed border-border/60 rounded-lg bg-muted/5">
                            No buttons added yet. Add up to 3 buttons.
                          </div>
                        )}

                        {buttons.map((btn, idx) => (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={idx}
                            className="flex gap-2 items-start border p-3 rounded-lg bg-background shadow-sm group"
                          >
                            <div className="flex-1 space-y-2">
                              <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                <span className="flex items-center gap-1">
                                  {btn.type === "URL" && (
                                    <Globe className="w-3 h-3" />
                                  )}
                                  {btn.type === "PHONE_NUMBER" && (
                                    <Phone className="w-3 h-3" />
                                  )}
                                  {btn.type === "QUICK_REPLY" && (
                                    <CheckCircle className="w-3 h-3" />
                                  )}
                                  {btn.type.replace("_", " ")}
                                </span>
                              </div>
                              <Input
                                className="h-8 text-sm"
                                placeholder="Button Label"
                                value={btn.text}
                                onChange={(e) =>
                                  updateButton(idx, "text", e.target.value)
                                }
                              />
                              {(btn.type === "URL" ||
                                btn.type === "PHONE_NUMBER") && (
                                  <Input
                                    className="h-8 text-sm"
                                    placeholder={
                                      btn.type === "URL"
                                        ? "https://website.com"
                                        : "+1234567890"
                                    }
                                    value={btn.value}
                                    onChange={(e) =>
                                      updateButton(idx, "value", e.target.value)
                                    }
                                  />
                                )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeButton(idx)}
                              className="text-muted-foreground hover:text-red-500 h-6 w-6 rounded hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT: PHONE PREVIEW */}
                <div
                  className={cn(
                    "bg-[#F0F2F5] dark:bg-[#0c1317] p-8 flex-col items-center justify-center relative border-l border-border/50 overflow-hidden transition-all",
                    "lg:flex lg:col-span-5 xl:col-span-4 lg:static lg:z-auto lg:p-4 lg:pt-4", // Desktop defaults
                    showMobilePreview
                      ? "flex fixed inset-0 z-50 pt-24 pb-8"
                      : "hidden" // Mobile overlay
                  )}
                >
                  {showMobilePreview && (
                    <Button
                      className="absolute top-4 right-4 z-50 lg:hidden shadow-lg"
                      size="sm"
                      variant="secondary"
                      onClick={() => setShowMobilePreview(false)}
                    >
                      Close Preview
                    </Button>
                  )}
                  <div className="absolute inset-0 pattern-dots opacity-10 pointer-events-none"></div>

                  {/* Mobile Frame Container - Elegantly elongated and responsive */}
                  <div className="relative mx-auto w-full max-w-[280px] border-[10px] border-[#1F2937] rounded-[48px] shadow-2xl bg-[#0b141a] transition-all duration-500 overflow-hidden transform lg:scale-[1.02] 2xl:scale-105">
                    <div className="h-6 bg-[#0b141a] flex justify-between items-center px-6 pt-3 z-20 relative">
                      <span className="text-[10px] text-white font-semibold">9:41</span>
                      <div className="flex gap-1.5 opacity-50 italic font-bold text-[10px] text-white">WhatsApp</div>
                    </div>

                    <div className="relative bg-[#0b141a] p-3 pt-4 min-h-[500px] max-h-[550px] overflow-y-auto custom-scrollbar flex flex-col">
                      <div className="absolute inset-0 opacity-[0.05] bg-[url('https://camo.githubusercontent.com/857a221f7c706d8847f9723ec083b063878b2772591f463378b879a838be8194/68747470733a2f2f757365722d696d616765732e67697468756275736572636f6e74656e742e636f6d2f31353037353735392f32383731393134342d38366463306637302d373362312d346334382d393630332d3935303237396532373635382e706e67')] bg-repeat bg-[length:400px]"></div>

                      <div className="relative z-10 w-full flex flex-col gap-1 mt-1 animate-in fade-in zoom-in-95 duration-500">
                        <div className="bg-[#202c33] rounded-2xl rounded-tl-none shadow-lg relative overflow-hidden group border border-white/5">
                          <div className="p-1">
                            {/* Header Media */}
                            {(formData.headerType === "IMAGE" || formData.headerType === "VIDEO") && (
                              <div className="rounded-xl overflow-hidden bg-black/40 min-h-[140px] relative group flex items-center justify-center">
                                {headerPreview ? (
                                  formData.headerType === "VIDEO" ? (
                                    <video src={headerPreview} className="w-full h-full object-contain" />
                                  ) : (
                                    <img src={headerPreview} alt="Header" className="w-full h-full object-contain" />
                                  )
                                ) : (
                                  <div className="flex flex-col items-center gap-1 opacity-20">
                                    {formData.headerType === "IMAGE" ? <ImageIcon className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                                    <span className="text-[8px] font-bold uppercase">{formData.headerType}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Header Text */}
                            {formData.headerType === "TEXT" && formData.headerText && (
                              <p className="font-bold text-[14px] pt-2 px-3 text-[#e9edef] leading-tight">
                                {formData.headerText}
                              </p>
                            )}
                          </div>

                          <div className="px-3 pt-1 pb-3 text-[13px] leading-snug text-[#e9edef] whitespace-pre-wrap font-sans">
                            {formData.body || "Your message body..."}

                            {formData.footerText && (
                              <p className="mt-1.5 text-[11px] text-[#8696a0] font-medium border-t border-white/5 pt-1.5">
                                {formData.footerText}
                              </p>
                            )}
                          </div>

                          {/* Buttons */}
                          {buttons.length > 0 && (
                            <div className="border-t border-white/10 flex flex-col divide-y divide-white/10 bg-[#2a3942]/30">
                              {buttons.map((btn, idx) => (
                                <div key={idx} className="p-2.5 text-center text-[13px] font-medium text-[#00a884] flex items-center justify-center gap-2 hover:bg-white/5 transition-colors cursor-pointer">
                                  {btn.type === "URL" ? (
                                    <Globe className="w-3.5 h-3.5" />
                                  ) : btn.type === "PHONE_NUMBER" ? (
                                    <Phone className="w-3.5 h-3.5" />
                                  ) : (
                                    <CheckCircle className="w-3.5 h-3.5" />
                                  )}
                                  {btn.text || "Button Label"}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="self-end mr-1 mt-0.5 flex items-center gap-1 opacity-40">
                          <span className="text-[10px] text-white font-bold uppercase tracking-tighter">9:41 AM</span>
                          <div className="flex -space-x-1">
                            <CheckCircle className="w-2.5 h-2.5 text-white" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-4 font-bold tracking-widest uppercase opacity-40">
                    Live Preview
                  </p>
                </div>
              </div>

              <div className="p-4 border-t border-border bg-background flex justify-end gap-3 shrink-0 z-20">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white min-w-[150px] shadow-lg shadow-green-500/20"
                  onClick={handleCreateSubmit}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  {editId ? "Update Template" : "Submit for Approval"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      {deleteConf.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-[2px]">
          <Card className="w-full max-w-md bg-card border-border shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                <h2 className="text-xl font-semibold text-foreground">
                  Confirm Deletion
                </h2>
              </div>
              <button
                onClick={() => setDeleteConf({ ...deleteConf, isOpen: false })}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent>
              <p className="text-foreground mb-6">
                Are you sure you want to delete "{deleteConf.title}"?
                <br />
                <span className="text-sm text-muted-foreground mt-2 block">
                  This action cannot be undone.
                </span>
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 bg-secondary border-border text-foreground hover:bg-muted"
                  onClick={() =>
                    setDeleteConf({ ...deleteConf, isOpen: false })
                  }
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-destructive hover:bg-destructive/90"
                  onClick={handleConfirmDelete}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
