"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Zap,
  Check,
  Filter,
  Search,
  Image as ImageIcon,
  ArrowLeft,
  MessageSquareIcon,
  ChevronRight,
  Loader2,
  Globe,
  Phone,
  ShoppingBag,
  Layers
} from "lucide-react";
import type { Category, Contact } from "@/lib/types";

// Re-using Template interface from inbox/page.tsx logic
interface Template {
  id: string;
  metaTemplateName: string;
  displayName: string;
  category: string;
  status: string;
  languages: {
    language: string;
    body: string;
    headerType: string;
    footerText?: string;
    headerText?: string;
  }[];
  media?: {
    id: string;
    mediaType: string;
    s3Url: string;
    language: string;
  }[];
  buttons?: {
    type: string;
    text: string;
    value?: string;
  }[];
  templateType?: string;
}

export default function CreateTemplateCampaignModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [campaignName, setCampaignName] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);
  const [variableModes, setVariableModes] = useState<('custom' | 'company')[]>([]);
  const [templateSearch, setTemplateSearch] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<Set<number>>(new Set());

  const [recipientCategoryId, setRecipientCategoryId] = useState<number | null>(null);
  const [recipientSubcategoryId, setRecipientSubcategoryId] = useState<number | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  // Load Categories and Templates on Open
  useEffect(() => {
    if (!isOpen) return;

    setLoadingTemplates(true);
    // Fetch Categories
    api.get<{ data: Category[] }>("/categories")
      .then((res) => setCategories(res.data.data))
      .catch(console.error);

    // Fetch Templates
    api.get("/vendor/templates")
      .then((res) => {
        const approved = res.data.filter((t: Template) => t.status === "approved");
        setTemplates(approved);
      })
      .catch((err) => console.error("Failed to load templates", err))
      .finally(() => setLoadingTemplates(false));
  }, [isOpen]);

  // Fetch Recipients
  const fetchRecipients = async (catId?: number | null, subId?: number | null) => {
    setLoadingContacts(true);
    try {
      const res = await api.get<{ data: { contacts: Contact[] } }>("/categories/contacts", {
        params: {
          category_id: catId ?? undefined,
          subcategory_id: subId ?? undefined,
        },
      });
      setContacts(res.data.data.contacts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRecipients(recipientCategoryId, recipientSubcategoryId);
    }
  }, [isOpen, recipientCategoryId, recipientSubcategoryId]);

  // Reset State on Close
  useEffect(() => {
    if (!isOpen) {
      setCampaignName("");
      setSelectedTemplate(null);
      setTemplateVariables([]);
      setVariableModes([]);
      setTemplateSearch("");
      setSelectedRecipients(new Set());
      setRecipientCategoryId(null);
      setRecipientSubcategoryId(null);
    }
  }, [isOpen]);

  const handleToggleRecipient = (id: number) => {
    const newSelected = new Set(selectedRecipients);
    newSelected.has(id) ? newSelected.delete(id) : newSelected.add(id);
    setSelectedRecipients(newSelected);
  };

  const handleSelectAllRecipients = () => {
    if (contacts.length === 0) return;
    const allVisibleSelected = contacts.every(c => selectedRecipients.has(c.id));
    const newSelected = new Set(selectedRecipients);
    if (allVisibleSelected) {
      contacts.forEach(c => newSelected.delete(c.id));
    } else {
      contacts.forEach(c => newSelected.add(c.id));
    }
    setSelectedRecipients(newSelected);
  };

  const handleLaunch = async () => {
    if (!campaignName.trim()) return alert("Campaign name required");
    if (!selectedTemplate) return alert("Select a template");
    if (selectedRecipients.size === 0) return alert("Select recipients");

    setIsLaunching(true);

    try {
      const payload = {
        name: campaignName,
        templateId: selectedTemplate.id,
        language: selectedTemplate.languages[0].language,
        language: selectedTemplate.languages[0].language,
        recipients: Array.from(selectedRecipients).map(id => {
          const contact = contacts.find(c => c.id === id);
          return contact?.mobile_number;
        }).filter(Boolean),
        bodyVariables: templateVariables,
        variableModes: variableModes,
      };

      await api.post("/campaign/template", payload);

      onSuccess?.();
      onClose();
    } catch (err) {
      alert("Failed to launch campaign. Please try again.");
    } finally {
      setIsLaunching(false);
    }
  };

  const canLaunch = campaignName.trim() && selectedTemplate && selectedRecipients.size > 0 && !isLaunching;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-6xl"
      >
        <div className="bg-card rounded-2xl border border-border h-[75vh] max-h-[800px] flex flex-col overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-card/80 p-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                Create Template Campaign
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure your message template and select recipients
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-input"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">
            {/* Left Panel: Template Selection & Variables */}
            <div className="flex-1 overflow-hidden flex flex-col border-b lg:border-b-0 lg:border-r border-border bg-background">
              {!selectedTemplate ? (
                <div className="flex-1 flex flex-col min-h-0 p-6 space-y-6">
                  <div className="space-y-4 flex-shrink-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search templates..."
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                        className="w-full bg-input pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 border border-border transition-all"
                      />
                    </div>

                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      <Filter className="w-3.5 h-3.5" />
                      Approved Templates
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {loadingTemplates ? (
                      <div className="flex flex-col items-center justify-center py-20 opacity-50">
                        <Zap className="w-10 h-10 animate-pulse text-primary mb-3" />
                        <p className="text-sm">Loading templates...</p>
                      </div>
                    ) : templates.length === 0 ? (
                      <div className="text-center py-20 bg-muted/20 rounded-2xl border-2 border-dashed border-border">
                        <MessageSquareIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-20" />
                        <p className="text-sm text-muted-foreground font-medium">No approved templates found</p>
                      </div>
                    ) : (
                      templates
                        .filter(t => t.displayName.toLowerCase().includes(templateSearch.toLowerCase()))
                        .map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setSelectedTemplate(t);
                              const body = t.languages[0]?.body || "";
                              const match = body.match(/\{\{\d+\}\}/g);
                              const count = match ? new Set(match).size : 0;
                              setTemplateVariables(new Array(count).fill(""));
                              setVariableModes(new Array(count).fill('custom'));
                            }}
                            className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group relative overflow-hidden bg-card shadow-sm hover:shadow-md"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <p className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                                {t.displayName}
                              </p>
                              <div className="flex gap-1 items-center">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${t.category === 'MARKETING' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' :
                                  t.category === 'UTILITY' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' :
                                    'bg-muted text-muted-foreground'
                                  }`}>
                                  {t.category}
                                </span>
                                {(t.templateType || "").toLowerCase() === "catalog" && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-purple-100 text-purple-600 dark:bg-purple-900/30 flex items-center gap-1">
                                    <ShoppingBag className="w-3 h-3" /> Catalog
                                  </span>
                                )}
                                {(t.templateType || "").toLowerCase() === "carousel" && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-pink-100 text-pink-600 dark:bg-pink-900/30 flex items-center gap-1">
                                    <Layers className="w-3 h-3" /> Carousel
                                  </span>
                                )}
                                {(!t.templateType || (t.templateType || "").toLowerCase() === "standard") && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-800 flex items-center gap-1">
                                    Standard
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed italic">
                              &ldquo;{t.languages[0]?.body}&rdquo;
                            </p>
                            <div className="mt-3 flex items-center justify-end text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                              SELECT TEMPLATE <ChevronRight className="w-3 h-3 ml-1" />
                            </div>
                          </button>
                        ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-6 space-y-8 animate-in fade-in slide-in-from-left-4 duration-300 custom-scrollbar">
                  <div className="flex items-center gap-3 bg-primary/5 p-4 rounded-2xl border border-primary/10">
                    <button
                      onClick={() => setSelectedTemplate(null)}
                      className="p-2 hover:bg-primary/10 rounded-full transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5 text-primary" />
                    </button>
                    <div>
                      <p className="font-bold text-lg text-foreground">{selectedTemplate.displayName}</p>
                      <div className="flex gap-2">
                        <p className="text-[10px] text-primary font-bold uppercase tracking-widest">{selectedTemplate.category}</p>
                        {(selectedTemplate.templateType || "").toLowerCase() === "catalog" && (
                          <span className="text-[10px] text-purple-600 font-bold uppercase tracking-widest flex items-center gap-1">
                            <ShoppingBag className="w-3 h-3" /> Catalog
                          </span>
                        )}
                        {(selectedTemplate.templateType || "").toLowerCase() === "carousel" && (
                          <span className="text-[10px] text-pink-600 font-bold uppercase tracking-widest flex items-center gap-1">
                            <Layers className="w-3 h-3" /> Carousel
                          </span>
                        )}
                        {(!selectedTemplate.templateType || (selectedTemplate.templateType || "").toLowerCase() === "standard") && (
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
                            Standard
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Campaign Name & Variables Section */}
                  <div className="space-y-8">
                    {/* Campaign Name */}
                    <div className="space-y-4">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block mb-2">
                        Campaign Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Summer Launch 2024"
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        className="w-full px-4 py-3 bg-input border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                      />
                    </div>

                    {/* Variables */}
                    <div>
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary" /> Variables Configuration
                      </h3>
                      <div className="space-y-4">
                        {templateVariables.length === 0 ? (
                          <div className="p-6 bg-muted/30 rounded-xl text-center border border-dashed border-border">
                            <p className="text-sm text-muted-foreground">This template has no dynamic variables.</p>
                          </div>
                        ) : (
                          templateVariables.map((val, idx) => (
                            <div key={idx} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase">
                                  Variable {"\u007B\u007B"}{idx + 1}{"\u007D\u007D"}
                                </label>
                                <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newModes = [...variableModes];
                                      newModes[idx] = 'custom';
                                      setVariableModes(newModes);
                                    }}
                                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${variableModes[idx] === 'custom'
                                      ? 'bg-white dark:bg-card text-foreground shadow-sm'
                                      : 'text-muted-foreground hover:text-foreground'
                                      }`}
                                  >
                                    Custom
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newModes = [...variableModes];
                                      newModes[idx] = 'company';
                                      setVariableModes(newModes);
                                      const newVars = [...templateVariables];
                                      newVars[idx] = '';
                                      setTemplateVariables(newVars);
                                    }}
                                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${variableModes[idx] === 'company'
                                      ? 'bg-white dark:bg-card text-foreground shadow-sm'
                                      : 'text-muted-foreground hover:text-foreground'
                                      }`}
                                  >
                                    Company
                                  </button>
                                </div>
                              </div>
                              <input
                                type="text"
                                disabled={variableModes[idx] === 'company'}
                                placeholder={variableModes[idx] === 'company' ? 'Will use company name for each recipient' : `Value for {{${idx + 1}}}`}
                                value={variableModes[idx] === 'company' ? 'Company Name' : val}
                                onChange={(e) => {
                                  const newVars = [...templateVariables];
                                  newVars[idx] = e.target.value;
                                  setTemplateVariables(newVars);
                                }}
                                className={`w-full bg-input border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:opacity-30 ${variableModes[idx] === 'company' ? 'opacity-60 cursor-not-allowed' : ''
                                  }`}
                              />
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Recipients Section (Moved here) */}
                    <div className="space-y-4 pt-4 border-t border-border">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          Select Recipients <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center gap-4">
                          <button
                            onClick={handleSelectAllRecipients}
                            className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider"
                          >
                            {contacts.length > 0 && contacts.every(c => selectedRecipients.has(c.id)) ? 'Deselect All' : 'Select All'}
                          </button>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">
                            {selectedRecipients.size} Selected
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={recipientCategoryId ?? ""}
                          onChange={(e) => {
                            setRecipientCategoryId(e.target.value ? Number(e.target.value) : null);
                            setRecipientSubcategoryId(null);
                          }}
                          className="w-full px-3 py-2.5 bg-input border border-border rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        >
                          <option value="">All Categories</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>

                        <select
                          value={recipientSubcategoryId ?? ""}
                          disabled={!recipientCategoryId}
                          onChange={(e) => setRecipientSubcategoryId(e.target.value ? Number(e.target.value) : null)}
                          className="w-full px-3 py-2.5 bg-input border border-border rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:opacity-50"
                        >
                          <option value="">All Subcategories</option>
                          {categories
                            .find((c) => c.id === recipientCategoryId)
                            ?.subcategories?.map((sub) => (
                              <option key={sub.id} value={sub.id}>{sub.name}</option>
                            ))}
                        </select>
                      </div>

                      {/* Recipients List */}
                      <div className="min-h-[250px] border border-border rounded-2xl overflow-hidden bg-input/20 flex flex-col">
                        <div className="max-h-[300px] overflow-y-auto divide-y divide-border custom-scrollbar">
                          {loadingContacts ? (
                            <div className="p-10 text-center opacity-30">
                              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                              <p className="text-[10px] font-bold uppercase tracking-widest">Searching contacts...</p>
                            </div>
                          ) : contacts.length === 0 ? (
                            <div className="p-10 text-center opacity-30">
                              <p className="text-[10px] font-bold uppercase tracking-widest">No matching contacts</p>
                            </div>
                          ) : (
                            contacts.map((contact) => (
                              <div
                                key={contact.id}
                                onClick={() => handleToggleRecipient(contact.id)}
                                className="group flex items-center gap-4 p-4 hover:bg-primary/5 cursor-pointer transition-all"
                              >
                                <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${selectedRecipients.has(contact.id) ? 'bg-primary border-primary shadow-lg shadow-primary/30' : 'border-border group-hover:border-primary/50 bg-background'
                                  }`}>
                                  {selectedRecipients.has(contact.id) && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-foreground truncate">{contact.company_name || contact.mobile_number}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-50 px-1.5 py-0.5 bg-muted rounded">
                                      {contact.category_name}
                                    </span>
                                    <span className="text-[10px] font-bold text-primary truncate">
                                      {contact.mobile_number}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel: Preview & Recipients */}
            <div className="w-full lg:w-[400px] overflow-hidden bg-muted/10 flex flex-col border-l border-border min-h-0 bg-gradient-to-b from-card to-background">
              <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center custom-scrollbar">
                {/* Live Preview Section */}
                {selectedTemplate ? (
                  <div className="w-full h-full flex flex-col items-center justify-center py-4">
                    <div className="flex items-center justify-center w-full px-1 mb-4">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Live Preview
                      </label>
                    </div>

                    {/* Mobile Frame Container - Elegantly elongated and responsive */}
                    <div className="relative mx-auto w-full max-w-[280px] border-[10px] border-[#1F2937] rounded-[48px] shadow-2xl bg-[#0b141a] transition-all duration-500 overflow-hidden transform lg:scale-105">
                      <div className="h-6 bg-[#0b141a] flex justify-between items-center px-6 pt-3 z-20 relative">
                        <span className="text-[10px] text-white font-semibold">9:41</span>
                        <div className="flex gap-1.5 opacity-50 italic font-bold text-[10px] text-white">WhatsApp</div>
                      </div>

                      <div className="relative bg-[#0b141a] p-3 pt-4 min-h-[540px] max-h-[550px] overflow-y-auto custom-scrollbar flex flex-col">
                        <div className="absolute inset-0 opacity-[0.05] bg-[url('https://camo.githubusercontent.com/857a221f7c706d8847f9723ec083b063878b2772591f463378b879a838be8194/68747470733a2f2f757365722d696d616765732e67697468756275736572636f6e74656e742e636f6d2f31353037353735392f32383731393134342d38366463306637302d373362312d346334382d393630332d3935303237396532373635382e706e67')] bg-repeat bg-[length:400px]"></div>

                        <div className="relative z-10 w-full flex flex-col gap-1 mt-1 animate-in fade-in zoom-in-95 duration-500">
                          <div className="bg-[#202c33] rounded-2xl rounded-tl-none shadow-lg relative overflow-hidden group border border-white/5">
                            <div className="p-1">
                              {/* Header Media */}
                              {(() => {
                                const mediaItem = selectedTemplate.media?.find(m => m.language === selectedTemplate.languages[0].language);
                                if (mediaItem?.s3Url) {
                                  return (
                                    <div className="rounded-xl overflow-hidden bg-black/40 min-h-[140px] relative group flex items-center justify-center">
                                      {selectedTemplate.languages[0].headerType === "VIDEO" ? (
                                        <video src={mediaItem.s3Url} className="w-full h-full object-contain" />
                                      ) : (
                                        <img src={mediaItem.s3Url} alt="Header" className="w-full h-full object-contain" />
                                      )}
                                      <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-all" />
                                    </div>
                                  );
                                }
                                return (
                                  <div className="min-h-[140px] bg-[#2a3942] flex flex-col items-center justify-center rounded-xl text-slate-500 text-[10px] font-bold uppercase tracking-wider border border-white/5">
                                    <ImageIcon className="w-6 h-6 mb-2 opacity-30 text-white" />
                                    {selectedTemplate.languages[0].headerType} MEDIA
                                  </div>
                                );
                              })()}

                              {/* Header Text */}
                              {selectedTemplate.languages[0]?.headerType === "TEXT" && selectedTemplate.languages[0]?.headerText && (
                                <p className="font-bold text-[14px] pt-2 px-3 text-[#e9edef] leading-tight">
                                  {selectedTemplate.languages[0].headerText}
                                </p>
                              )}
                            </div>

                            <div className="px-3 pt-1 pb-3 text-[13px] leading-snug text-[#e9edef] whitespace-pre-wrap font-sans">
                              {(() => {
                                let body = selectedTemplate.languages[0]?.body || "";
                                templateVariables.forEach((val, idx) => {
                                  const placeholder = `{{${idx + 1}}}`;
                                  body = body.replace(placeholder, val || placeholder);
                                });
                                return body;
                              })()}

                              {selectedTemplate.languages[0]?.footerText && (
                                <p className="mt-1.5 text-[11px] text-[#8696a0] font-medium border-t border-white/5 pt-1.5">
                                  {selectedTemplate.languages[0].footerText}
                                </p>
                              )}
                            </div>

                            {/* Buttons */}
                            {selectedTemplate.buttons && selectedTemplate.buttons.length > 0 && (
                              <div className="border-t border-white/10 flex flex-col divide-y divide-white/10 bg-[#2a3942]/30">
                                {selectedTemplate.buttons.map((btn, idx) => (
                                  <div key={idx} className="p-2.5 text-center text-[13px] font-medium text-[#00a884] flex items-center justify-center gap-2 hover:bg-white/5 transition-colors cursor-pointer">
                                    {btn.type === "URL" ? (
                                      <Globe className="w-3.5 h-3.5" />
                                    ) : btn.type === "PHONE_NUMBER" ? (
                                      <Phone className="w-3.5 h-3.5" />
                                    ) : (
                                      <MessageSquareIcon className="w-3.5 h-3.5" />
                                    )}
                                    {btn.text}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="self-end mr-1 mt-0.5 flex items-center gap-1 opacity-40">
                            <span className="text-[10px] text-white font-bold uppercase tracking-tighter">9:41 AM</span>
                            <div className="flex -space-x-1">
                              <Check className="w-2.5 h-2.5 text-white" />
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-12 opacity-30">
                    <ImageIcon className="w-16 h-16 mb-4 text-muted-foreground" />
                    <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Select a template to view preview</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-border p-6 flex gap-4 justify-end bg-card/80">
            <button
              onClick={onClose}
              className="px-8 py-3 rounded-xl bg-secondary hover:bg-muted text-foreground text-sm font-bold transition-all border border-border shadow-sm active:scale-95"
            >
              Cancel
            </button>
            <motion.button
              whileHover={{ scale: canLaunch ? 1.02 : 1 }}
              whileTap={{ scale: canLaunch ? 0.98 : 1 }}
              onClick={handleLaunch}
              disabled={!canLaunch}
              className={`px-10 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${canLaunch
                ? "bg-primary text-white shadow-xl shadow-primary/30 hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed border border-border opacity-50"
                }`}
            >
              <Zap className="w-4 h-4" />
              {isLaunching ? "Launching..." : "Launch Campaign"}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
