"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    ArrowLeft,
    Send,
    Phone,
    Globe,
    MessageSquareIcon,
    Image as ImageIcon,
    ShoppingBag,
    Layers,
    Loader2,
} from "lucide-react";

import { toast } from "react-toastify";
import type { Template } from "@/lib/types";

interface TemplatePickerProps {
    templates: Template[];

    selectedTemplate: Template | null;
    setSelectedTemplate: (t: Template | null) => void;

    templateVariables: string[];
    setTemplateVariables: (v: string[]) => void;

    templateSearch: string;
    setTemplateSearch: (v: string) => void;

    isSendingTemplate: boolean;
    handleSendTemplate: () => Promise<void>;
}

export default function TemplatePicker({
    templates,
    selectedTemplate,
    setSelectedTemplate,
    templateVariables,
    setTemplateVariables,
    templateSearch,
    setTemplateSearch,
    isSendingTemplate,
    handleSendTemplate,
}: TemplatePickerProps) {

    const handleSendClick = async () => {
        // Validation: Check if all variables are filled
        // This is especially critical for Catalog templates where params might be required
        if (selectedTemplate) {
            const emptyVars = templateVariables.some(v => !v || v.trim() === "");
            if (emptyVars) {
                toast.error("Please fill all required variable fields", {
                    position: "top-center",
                    autoClose: 3000
                });

                // Highlight empty fields logic could go here (e.g. by setting a 'touched' state), 
                // but toast is a good first step.
                return;
            }
        }

        await handleSendTemplate();
    };
    return (
        <div className="flex flex-col h-[500px]">
            {!selectedTemplate ? (
                <>
                    {/* Search */}
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search templates by name..."
                            value={templateSearch}
                            onChange={(e) => setTemplateSearch(e.target.value)}
                            className="w-full bg-muted/50 pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none border"
                        />
                    </div>

                    {/* Template List */}
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                        {templates
                            .filter((t) =>
                                t.displayName
                                    .toLowerCase()
                                    .includes(templateSearch.toLowerCase())
                            )
                            .map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => {
                                        setSelectedTemplate(t);

                                        const body = t.languages[0]?.body || "";
                                        const matches = body.match(/{{\d+}}/g);
                                        const count = matches ? new Set(matches).size : 0;

                                        setTemplateVariables(new Array(count).fill(""));
                                    }}
                                    className="w-full text-left p-4 rounded-xl border hover:border-primary/50 hover:bg-primary/5 transition"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="font-semibold text-sm">{t.displayName}</p>
                                        <div className="flex gap-1 items-center">
                                            <span className="text-[10px] px-2 py-0.5 rounded-full uppercase bg-muted">
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
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-200 flex items-center gap-1">
                                                    Standard
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                        {t.languages[0]?.body}
                                    </p>
                                </button>
                            ))}

                        {templates.length === 0 && (
                            <div className="text-center py-12 opacity-70">
                                <MessageSquareIcon className="w-6 h-6 mx-auto mb-2" />
                                <p className="text-sm font-medium">No approved templates</p>
                                <p className="text-xs text-muted-foreground">
                                    Check your Meta Business Suite
                                </p>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6 bg-muted/30 p-3 rounded-xl">
                        <button
                            onClick={() => setSelectedTemplate(null)}
                            className="p-1.5 rounded-full border hover:bg-muted"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>

                        <div>
                            <p className="font-semibold text-sm">
                                {selectedTemplate.displayName}
                            </p>
                            <div className="flex gap-2 items-center mt-1">
                                <p className="text-[10px] uppercase text-muted-foreground font-bold">
                                    {selectedTemplate.category}
                                </p>
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
                                    <span className="text-[10px] text-slate-900 dark:text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                        Standard
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Preview + Variables */}
                    <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                        {/* Live Preview */}
                        <div>
                            <p className="text-xs font-bold uppercase mb-2 text-muted-foreground">
                                Live Preview
                            </p>

                            <div className="rounded-xl border p-4 bg-[#0b141a] text-white">
                                <p className="text-sm whitespace-pre-wrap">
                                    {(() => {
                                        let body = selectedTemplate.languages[0]?.body || "";

                                        templateVariables.forEach((val, idx) => {
                                            body = body.replace(
                                                `{{${idx + 1}}}`,
                                                val || `{{${idx + 1}}}`
                                            );
                                        });

                                        return body;
                                    })()}
                                </p>
                            </div>
                        </div>

                        {/* Carousel Cards Preview */}
                        {(selectedTemplate.templateType === "carousel" || (selectedTemplate.carouselCards && selectedTemplate.carouselCards.length > 0)) && (
                            <div className="flex overflow-x-auto gap-2 py-2 mt-1 snap-x scrollbar-thin scrollbar-thumb-gray-600/50">
                                {(selectedTemplate.carouselCards || []).map((card, idx) => (
                                    <div key={idx} className="flex-shrink-0 w-[200px] bg-wa-inbound rounded-2xl overflow-hidden shadow-sm border border-border/50 snap-center flex flex-col">
                                        {/* Content Area */}
                                        <div className="p-3">
                                            {card.s3Url && (
                                                <div className="h-28 w-full relative mb-3 rounded-lg overflow-hidden bg-muted">
                                                    {card.mimeType?.startsWith('video') ? (
                                                        <video src={card.s3Url} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <img src={card.s3Url} alt="" className="w-full h-full object-cover" />
                                                    )}
                                                </div>
                                            )}
                                            <p className="font-bold text-sm text-foreground line-clamp-1 mb-1">{idx + 1}. {card.title || "No Title"}</p>
                                            <p className="text-xs text-muted-foreground line-clamp-2">{card.subtitle || "No subtitle available"}</p>
                                        </div>

                                        {/* Button */}
                                        {(card.buttonText || card.buttonValue) && (
                                            <div className="border-t border-border/30 py-2.5 text-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
                                                <span className="text-sm text-[#0084ff] dark:text-[#53bdeb] font-semibold">{card.buttonText || "View Details"}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        {/* Variables */}
                        {templateVariables.length > 0 && (
                            <div className="space-y-4">
                                <p className="text-xs font-semibold uppercase text-muted-foreground">
                                    Personalize Variables
                                </p>

                                {templateVariables.map((val, idx) => (
                                    <input
                                        key={idx}
                                        type="text"
                                        value={val}
                                        onChange={(e) => {
                                            const next = [...templateVariables];
                                            next[idx] = e.target.value;
                                            setTemplateVariables(next);
                                        }}
                                        placeholder={`Enter value for {{${idx + 1}}}`}
                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="mt-4 pt-4 border-t flex gap-3">
                        <button
                            onClick={() => setSelectedTemplate(null)}
                            className="flex-1 py-3 rounded-xl border font-semibold"
                        >
                            Cancel
                        </button>

                        <button
                            onClick={handleSendClick}
                            disabled={isSendingTemplate}
                            className="flex-[2] py-3 rounded-xl bg-primary text-white font-bold flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                        >
                            {isSendingTemplate ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Send Template
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
