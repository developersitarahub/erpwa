"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    Phone,
    ArrowLeft,
    Send,
    Check,
    X,
    Image as ImageIcon,
    Filter,
    Zap,
    Loader2,
    MessageSquareIcon,
    Globe,
    ShoppingBag,
    Layers,
} from "lucide-react";
import Image from "next/image";
import { toast } from "react-toastify";
import type { Category, GalleryImage, Template } from "@/lib/types";
import api from "@/lib/api";
import { processMedia } from "@/lib/mediaProcessor";
import type { Conversation } from "@/lib/types";


interface MediaModalProps {
    mediaModal: { type: "image" | "video" | "audio" | "document" | "template" | "gallery" } | null;
    onClose: () => void;

    /* IMAGE */
    imageMode: "single" | "bulk";
    setImageMode: (v: "single" | "bulk") => void;
    imageInputRef: React.RefObject<HTMLInputElement | null>;
    genericInputRef: React.RefObject<HTMLInputElement | null>;
    handleImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;

    conversation: Conversation;
    setMediaModal: (v: { type: "image" | "video" | "audio" | "document" | "template" | "gallery" } | null) => void;

    /* GALLERY */
    galleryCategories: Category[];
    gallerySubcategories: Category[];
    galleryImages: GalleryImage[];
    selectedGalleryImages: GalleryImage[];
    galleryLoading: boolean;
    includeCaption: boolean;
    isPreparingMedia: boolean;

    setSelectedGalleryImages: React.Dispatch<React.SetStateAction<GalleryImage[]>>;
    setIncludeCaption: (v: boolean) => void;
    handleGalleryCategoryClick: (id: number | null) => void;
    loadGalleryImages: (cat?: number, sub?: number) => void;
    toggleSelectAll: () => void;
    handleSendGalleryImages: () => Promise<void>;

    /* TEMPLATE */
    templates: Template[];
    selectedTemplate: Template | null;
    setSelectedTemplate: (t: Template | null) => void;
    templateVariables: string[];
    setTemplateVariables: (v: string[]) => void;
    templateSearch: string;
    setTemplateSearch: (v: string) => void;
    isSendingTemplate: boolean;
    handleSendTemplate: () => Promise<void>;
    selectedGalleryCategory: number | null;
    selectedGallerySubcategory: number | null;
    setSelectedGallerySubcategory: (v: number | null) => void;

}

export default function MediaModal(props: MediaModalProps) {
    const {
        mediaModal,
        onClose,
        imageMode,
        setImageMode,
        imageInputRef,
        genericInputRef,
        handleImageSelect,
        conversation,
        setMediaModal,
        galleryCategories,
        gallerySubcategories,
        galleryImages,
        selectedGalleryImages,
        galleryLoading,
        includeCaption,
        isPreparingMedia,
        setSelectedGalleryImages,
        setIncludeCaption,
        handleGalleryCategoryClick,
        loadGalleryImages,
        toggleSelectAll,
        handleSendGalleryImages,
        templates,
        selectedTemplate,
        setSelectedTemplate,
        templateVariables,
        setTemplateVariables,
        templateSearch,
        setTemplateSearch,
        isSendingTemplate,
        handleSendTemplate,
        selectedGalleryCategory,
        selectedGallerySubcategory,
        setSelectedGallerySubcategory,
    } = props;

    return (
        <AnimatePresence>
            {mediaModal && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 z-50 bg-black/60"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    {/* Center Modal */}
                    <motion.div
                        initial={{ scale: 0.92, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.92, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`
              fixed z-50
              top-1/2 left-1/2
              -translate-x-1/2 -translate-y-1/2
              w-[95%] ${mediaModal.type === "gallery" ? "max-w-6xl" : "max-w-md"}
              bg-card
              rounded-2xl
              shadow-2xl
              p-0
              overflow-hidden
              border border-border/50
              backdrop-blur-xl
            `}
                    >
                        <div className="flex items-center justify-between border-b border-border bg-card/80 p-4">
                            <div>
                                <h2 className="text-xl font-bold text-foreground">
                                    {mediaModal.type === "template"
                                        ? "Select Template"
                                        : mediaModal.type === "gallery"
                                            ? "Browse Gallery"
                                            : "Send Media"}
                                </h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {mediaModal.type === "gallery"
                                        ? "Select images from your collection to send"
                                        : "Choose what you want to send"}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-input"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className={mediaModal.type === "gallery" ? "" : "p-4"}>
                            {/* IMAGE */}
                            {mediaModal.type === "image" && (
                                <div className="mt-2 flex flex-col h-[340px] mb-2">
                                    <div className="flex-shrink-0 space-y-3 mb-3">
                                        <div>
                                            <h3 className="text-base font-semibold">Send Photos</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Select mode and source
                                            </p>
                                        </div>

                                        {/* SEND MODE */}
                                        <div>
                                            <p className="text-[10px] text-muted-foreground mb-1.5">
                                                Send mode
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        setImageMode("single");
                                                        setSelectedGalleryImages([]);
                                                    }}
                                                    className={`flex-1 py-2 rounded-lg text-sm ${imageMode === "single"
                                                        ? "bg-primary text-white"
                                                        : "bg-muted"
                                                        }`}
                                                >
                                                    Single
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setImageMode("bulk");
                                                        setSelectedGalleryImages([]);
                                                    }}
                                                    className={`flex-1 py-2 rounded-lg text-sm ${imageMode === "bulk"
                                                        ? "bg-primary text-white"
                                                        : "bg-muted"
                                                        }`}
                                                >
                                                    Bulk
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* DEVICE */}
                                        <button
                                            onClick={() => imageInputRef.current?.click()}
                                            className="rounded-xl border p-4 hover:bg-muted text-left flex flex-col items-center justify-center gap-1.5 aspect-square"
                                        >
                                            <div className="text-3xl">📁</div>
                                            <p className="font-medium text-xs">Device</p>
                                        </button>

                                        {/* GALLERY */}
                                        <button
                                            onClick={() => setMediaModal({ type: "gallery" })}
                                            className="rounded-xl border p-4 hover:bg-muted text-left flex flex-col items-center justify-center gap-1.5 aspect-square"
                                        >
                                            <div className="text-3xl">🖼️</div>
                                            <p className="font-medium text-xs">Gallery</p>
                                        </button>
                                    </div>

                                    {/* Hidden Input for Device Upload */}
                                    <input
                                        ref={imageInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple={imageMode === "bulk"}
                                        className="hidden"
                                        onChange={handleImageSelect}
                                    />
                                </div>
                            )}

                            {/* GALLERY MODAL CONTENT */}
                            {mediaModal.type === "gallery" && (
                                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row h-[70vh]">
                                    {/* Left Panel: Image Selection */}
                                    <div className="flex-1 overflow-auto flex flex-col border-b lg:border-b-0 lg:border-r border-border p-6 bg-background">
                                        <div className="space-y-4 flex flex-col h-full">
                                            <div className="space-y-3 flex-shrink-0">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <Filter className="w-4 h-4 text-primary" />
                                                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                        Filters
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                                                            Category
                                                        </label>
                                                        <select
                                                            value={selectedGalleryCategory ?? ""}
                                                            onChange={(e) => {
                                                                handleGalleryCategoryClick(
                                                                    e.target.value ? Number(e.target.value) : null
                                                                );
                                                            }}
                                                            className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                                        >
                                                            <option value="">All Categories</option>
                                                            {galleryCategories.map((cat) => (
                                                                <option key={cat.id} value={cat.id}>
                                                                    {cat.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                                                            Subcategory
                                                        </label>
                                                        <select
                                                            disabled={!selectedGalleryCategory}
                                                            value={selectedGallerySubcategory ?? ""}
                                                            onChange={(e) => {
                                                                const val = e.target.value
                                                                    ? Number(e.target.value)
                                                                    : null;
                                                                setSelectedGallerySubcategory(val);
                                                                loadGalleryImages(
                                                                    selectedGalleryCategory!,
                                                                    val ?? undefined
                                                                );
                                                            }}
                                                            className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 transition-all font-inter"
                                                        >
                                                            <option value="">All subcategories</option>
                                                            {gallerySubcategories.map((sub) => (
                                                                <option key={sub.id} value={sub.id}>
                                                                    {sub.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Image Grid Section Header */}
                                            <div className="flex items-center justify-between mb-3 flex-shrink-0">
                                                <div>
                                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                        Images
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {selectedGalleryImages.length} selected
                                                    </p>
                                                </div>
                                                {galleryImages.length > 0 && imageMode === "bulk" && (
                                                    <button
                                                        onClick={toggleSelectAll}
                                                        className="text-xs px-3 py-1.5 rounded-md bg-input hover:bg-secondary transition text-foreground font-medium border border-border"
                                                    >
                                                        {galleryImages.every((img) =>
                                                            selectedGalleryImages.some((s) => s.id === img.id)
                                                        )
                                                            ? "Deselect All"
                                                            : "Select All"}
                                                    </button>
                                                )}
                                            </div>

                                            {/* Image Grid */}
                                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 auto-rows-[120px] overflow-y-auto pr-2 flex-1 custom-scrollbar">
                                                {galleryLoading ? (
                                                    <div className="col-span-full flex items-center justify-center h-40">
                                                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                                    </div>
                                                ) : galleryImages.length === 0 ? (
                                                    <div className="col-span-full flex flex-col items-center justify-center h-40 text-muted-foreground opacity-50">
                                                        <ImageIcon className="w-12 h-12 mb-2" />
                                                        <p className="text-sm">No images found</p>
                                                    </div>
                                                ) : (
                                                    galleryImages.map((img) => {
                                                        const isSelected = !!selectedGalleryImages.find(
                                                            (i) => i.id === img.id
                                                        );
                                                        return (
                                                            <motion.div
                                                                key={img.id}
                                                                whileHover={{ scale: 1.02 }}
                                                                whileTap={{ scale: 0.98 }}
                                                                className={`relative overflow-hidden rounded-lg cursor-pointer transition-all border-2 group bg-muted/10 ${isSelected
                                                                    ? "border-primary ring-2 ring-primary/30 shadow-lg shadow-primary/20"
                                                                    : "border-border hover:border-primary/50 hover:shadow-md"
                                                                    }`}
                                                                onClick={() => {
                                                                    if (imageMode === "single") {
                                                                        setSelectedGalleryImages([img]);
                                                                    } else {
                                                                        if (isSelected) {
                                                                            setSelectedGalleryImages((prev) =>
                                                                                prev.filter((i) => i.id !== img.id)
                                                                            );
                                                                        } else {
                                                                            setSelectedGalleryImages((prev) => [
                                                                                ...prev,
                                                                                img,
                                                                            ]);
                                                                        }
                                                                    }
                                                                }}
                                                            >
                                                                <Image
                                                                    src={
                                                                        img.s3_url || img.url || img.image_url || ""
                                                                    }
                                                                    alt="Gallery"
                                                                    fill
                                                                    className="object-cover group-hover:brightness-110 transition-all"
                                                                    sizes="(max-width: 768px) 33vw, 200px"
                                                                />

                                                                <AnimatePresence>
                                                                    {isSelected && (
                                                                        <motion.div
                                                                            initial={{ opacity: 0 }}
                                                                            animate={{ opacity: 1 }}
                                                                            exit={{ opacity: 0 }}
                                                                            className="absolute inset-0 bg-primary/20 backdrop-blur-[1px] flex items-center justify-center"
                                                                        >
                                                                            <div className="bg-primary rounded-full p-1.5 shadow-lg shadow-primary/50">
                                                                                <Check className="w-4 h-4 text-white" />
                                                                            </div>
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            </motion.div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Panel: Send Details */}
                                    <div className="w-full lg:w-80 overflow-auto p-6 bg-card flex flex-col space-y-6">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-3">
                                                    Send Mode
                                                </label>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setImageMode("single");
                                                            setSelectedGalleryImages([]);
                                                        }}
                                                        className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${imageMode === "single"
                                                            ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                                                            : "bg-muted/50 border-border hover:bg-muted"
                                                            }`}
                                                    >
                                                        Single
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setImageMode("bulk");
                                                            setSelectedGalleryImages([]);
                                                        }}
                                                        className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${imageMode === "bulk"
                                                            ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                                                            : "bg-muted/50 border-border hover:bg-muted"
                                                            }`}
                                                    >
                                                        Bulk
                                                    </button>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-3">
                                                    Options
                                                </label>
                                                <button
                                                    onClick={() => setIncludeCaption(!includeCaption)}
                                                    className="flex items-center gap-3 w-full p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors group"
                                                >
                                                    <div
                                                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${includeCaption
                                                            ? "bg-primary border-primary"
                                                            : "border-muted-foreground group-hover:border-primary"
                                                            }`}
                                                    >
                                                        {includeCaption && (
                                                            <Check className="w-3.5 h-3.5 text-white" />
                                                        )}
                                                    </div>
                                                    <span className="text-sm font-medium text-foreground">
                                                        Include Caption
                                                    </span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex-1" />

                                        {/* Selection Summary */}
                                        <div className="p-5 bg-secondary/50 border border-border rounded-2xl space-y-4 mt-auto">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                                                        Selected
                                                    </p>
                                                    <p className="text-3xl font-bold text-primary mt-1">
                                                        {selectedGalleryImages.length}
                                                    </p>
                                                </div>
                                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <ImageIcon className="w-6 h-6 text-primary" />
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleSendGalleryImages}
                                            disabled={selectedGalleryImages.length === 0 || isPreparingMedia}
                                            className={`w-full py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${selectedGalleryImages.length > 0 && !isPreparingMedia
                                                ? "bg-primary text-white shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]"
                                                : "bg-muted text-muted-foreground cursor-not-allowed opacity-70"
                                                }`}
                                        >
                                            {isPreparingMedia ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Preparing Preview...
                                                </>
                                            ) : (
                                                <>
                                                    <Zap className="w-4 h-4" />
                                                    Send Images
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* VIDEO */}
                            {mediaModal.type === "video" && (
                                <div className="mt-4 flex flex-col gap-4">
                                    <button
                                        onClick={() => genericInputRef.current?.click()}
                                        className="rounded-xl border p-4 hover:bg-muted text-left flex flex-col items-center justify-center gap-1.5 aspect-square max-w-[160px]"
                                    >
                                        <div className="text-3xl">📁</div>
                                        <p className="font-medium text-xs">Device</p>
                                    </button>
                                    <p className="text-xs text-muted-foreground text-center">
                                        Select a video from your device
                                    </p>
                                </div>
                            )}

                            {/* AUDIO */}
                            {mediaModal.type === "audio" && (
                                <div className="mt-4 flex flex-col gap-4">
                                    <button
                                        onClick={() => genericInputRef.current?.click()}
                                        className="rounded-xl border p-4 hover:bg-muted text-left flex flex-col items-center justify-center gap-1.5 aspect-square max-w-[160px]"
                                    >
                                        <div className="text-3xl">📁</div>
                                        <p className="font-medium text-xs">Device</p>
                                    </button>
                                    <p className="text-xs text-muted-foreground text-center">
                                        Select an audio file from your device
                                    </p>
                                </div>
                            )}

                            {/* DOCUMENT */}
                            {mediaModal.type === "document" && (
                                <div className="mt-4 flex flex-col gap-4">
                                    <button
                                        onClick={() => genericInputRef.current?.click()}
                                        className="rounded-xl border p-4 hover:bg-muted text-left flex flex-col items-center justify-center gap-1.5 aspect-square max-w-[160px]"
                                    >
                                        <div className="text-3xl">📁</div>
                                        <p className="font-medium text-xs">Device</p>
                                    </button>
                                    <p className="text-xs text-muted-foreground text-center">
                                        Select a document from your device
                                    </p>
                                </div>
                            )}

                            {mediaModal.type === "template" && (
                                <div className="mt-0 flex flex-col h-[500px]">
                                    {!selectedTemplate ? (
                                        <>
                                            <div className="relative mb-4">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                <input
                                                    type="text"
                                                    placeholder="Search templates by name..."
                                                    value={templateSearch}
                                                    onChange={(e) => setTemplateSearch(e.target.value)}
                                                    className="w-full bg-muted/50 pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 border border-border/50 transition-all"
                                                />
                                            </div>
                                            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
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
                                                                const match = body.match(/{{\d+}}/g);
                                                                const count = match ? new Set(match).size : 0;
                                                                setTemplateVariables(
                                                                    new Array(count).fill("")
                                                                );
                                                            }}
                                                            className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group relative overflow-hidden"
                                                        >
                                                            <div className="flex justify-between items-start mb-1">
                                                                <p className="font-semibold text-sm group-hover:text-primary transition-colors">
                                                                    {t.displayName}
                                                                </p>
                                                                <div className="flex flex-wrap justify-end gap-1 max-w-[50%]">
                                                                    <span
                                                                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${t.category === "MARKETING"
                                                                            ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30"
                                                                            : t.category === "UTILITY"
                                                                                ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30"
                                                                                : "bg-muted text-muted-foreground"
                                                                            }`}
                                                                    >
                                                                        {t.category}
                                                                    </span>
                                                                    {(t.templateType || "").toLowerCase() === "catalog" && (
                                                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider bg-purple-100 text-purple-600 dark:bg-purple-900/30 flex items-center gap-1">
                                                                            <ShoppingBag className="w-3 h-3" /> Catalog
                                                                        </span>
                                                                    )}
                                                                    {(t.templateType || "").toLowerCase() === "carousel" && (
                                                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider bg-pink-100 text-pink-600 dark:bg-pink-900/30 flex items-center gap-1">
                                                                            <Layers className="w-3 h-3" /> Carousel
                                                                        </span>
                                                                    )}
                                                                    {(!t.templateType || (t.templateType || "").toLowerCase() === "standard") && (
                                                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-slate-200 text-slate-700 dark:bg-slate-800 flex items-center gap-1">
                                                                            Standard
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                                                                {t.languages[0]?.body}
                                                            </p>
                                                            <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Send className="w-4 h-4 text-primary" />
                                                            </div>
                                                        </button>
                                                    ))}
                                                {templates.length === 0 && (
                                                    <div className="text-center py-12">
                                                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                                                            <MessageSquareIcon className="w-6 h-6 text-muted-foreground" />
                                                        </div>
                                                        <p className="text-sm font-medium text-foreground">
                                                            No approved templates
                                                        </p>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            Check your Meta Business Suite
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col h-full">
                                            <div className="flex items-center gap-3 mb-6 bg-muted/30 p-3 rounded-xl">
                                                <button
                                                    onClick={() => setSelectedTemplate(null)}
                                                    className="p-1.5 hover:bg-muted rounded-full bg-background shadow-sm transition-transform active:scale-95"
                                                >
                                                    <ArrowLeft className="w-4 h-4" />
                                                </button>
                                                <div>
                                                    <p className="font-semibold text-sm">
                                                        {selectedTemplate.displayName}
                                                    </p>
                                                    <div className="flex gap-2 items-center mt-1">
                                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
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
                                                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
                                                                Standard
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar pb-4">
                                                {/* Real-time Preview Bubble */}
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-center px-1">
                                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                                            Live Preview
                                                        </label>
                                                    </div>

                                                    {/* Mobile Frame Container */}
                                                    <div className="relative mx-auto max-w-[340px] border-[6px] border-[#1F2937] rounded-[30px] overflow-hidden shadow-2xl bg-[#0b141a]">
                                                        {/* Status Bar Mock */}
                                                        <div className="h-6 bg-[#0b141a] flex justify-between items-center px-4 pt-1 z-20 relative">
                                                            <span className="text-[9px] text-white/60 font-medium">
                                                                9:41
                                                            </span>
                                                            <div className="flex gap-1.5 opacity-60">
                                                                <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
                                                                <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
                                                            </div>
                                                        </div>

                                                        {/* Chat Area */}
                                                        <div className="relative bg-[#0b141a] p-3 min-h-[350px] flex flex-col overflow-y-auto scrollbar-none">
                                                            {/* Chat Background Pattern */}
                                                            <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent bg-[length:24px_24px]"></div>
                                                            <div className="absolute inset-0 opacity-[0.03] bg-[url('https://camo.githubusercontent.com/857a221f7c706d8847f9723ec083b063878b2772591f463378b879a838be8194/68747470733a2f2f757365722d696d616765732e67697468756275736572636f6e74656e742e636f6d2f31353037353735392f32383731393134342d38366463306637302d373362312d346334382d393630332d3935303237396532373635382e706e67')] bg-repeat bg-[length:400px]"></div>

                                                            {/* Message Bubble */}
                                                            <div className="relative z-10 w-full max-w-[95%] self-start flex flex-col gap-1.5 mt-2 animate-in slide-in-from-bottom-2 fade-in duration-500">
                                                                <div className="bg-[#202c33] rounded-lg rounded-tl-none shadow-sm relative overflow-hidden group">
                                                                    <div className="p-1">
                                                                        {/* Header Media */}
                                                                        {(selectedTemplate.languages[0]
                                                                            ?.headerType === "IMAGE" ||
                                                                            selectedTemplate.languages[0]
                                                                                ?.headerType === "VIDEO") &&
                                                                            (() => {
                                                                                const mediaItem =
                                                                                    selectedTemplate.media?.find(
                                                                                        (m) =>
                                                                                            m.language ===
                                                                                            selectedTemplate.languages[0]
                                                                                                .language
                                                                                    );
                                                                                if (mediaItem?.s3Url) {
                                                                                    if (
                                                                                        selectedTemplate.languages[0]
                                                                                            .headerType === "VIDEO"
                                                                                    ) {
                                                                                        return (
                                                                                            <div className="rounded-md overflow-hidden bg-black/20">
                                                                                                <video
                                                                                                    src={mediaItem.s3Url}
                                                                                                    controls
                                                                                                    className="w-full h-auto max-h-[180px] object-cover"
                                                                                                />
                                                                                            </div>
                                                                                        );
                                                                                    }
                                                                                    return (
                                                                                        <div className="rounded-md overflow-hidden bg-black/20">
                                                                                            <img
                                                                                                src={mediaItem.s3Url}
                                                                                                alt="Header"
                                                                                                className="w-full h-auto max-h-[180px] object-cover hover:scale-105 transition-transform duration-500 will-change-transform"
                                                                                            />
                                                                                        </div>
                                                                                    );
                                                                                }
                                                                                return (
                                                                                    <div className="h-28 bg-[#2a3942] flex items-center justify-center rounded-md text-slate-400 text-xs uppercase tracking-wider border border-white/5 mx-0.5 mt-0.5">
                                                                                        <ImageIcon className="w-5 h-5 mr-2 opacity-50" />
                                                                                        {
                                                                                            selectedTemplate.languages[0]
                                                                                                .headerType
                                                                                        }
                                                                                    </div>
                                                                                );
                                                                            })()}

                                                                        {/* Header Text */}
                                                                        {selectedTemplate.languages[0]
                                                                            ?.headerType === "TEXT" &&
                                                                            selectedTemplate.languages[0]
                                                                                ?.headerText && (
                                                                                <p className="font-bold text-[15px] pt-2 px-2 text-[#e9edef]">
                                                                                    {
                                                                                        selectedTemplate.languages[0]
                                                                                            .headerText
                                                                                    }
                                                                                </p>
                                                                            )}
                                                                    </div>

                                                                    {/* Body */}
                                                                    <div className="px-3 pt-1 pb-3 text-[15px] leading-snug text-[#e9edef] whitespace-pre-wrap font-sans">
                                                                        {(() => {
                                                                            let body =
                                                                                selectedTemplate.languages[0]?.body ||
                                                                                "";
                                                                            templateVariables.forEach(
                                                                                (val, idx) => {
                                                                                    const placeholder = `{{${idx + 1
                                                                                        }}}`;
                                                                                    body = body.replace(
                                                                                        placeholder,
                                                                                        val || `{{${idx + 1}}}`
                                                                                    );
                                                                                }
                                                                            );
                                                                            return body;
                                                                        })()}
                                                                    </div>

                                                                    {/* Carousel Cards Preview */}
                                                                    {(selectedTemplate.templateType === "carousel" || (selectedTemplate.carouselCards && selectedTemplate.carouselCards.length > 0)) && (
                                                                        <div className="flex overflow-x-auto gap-2 px-2 pb-2 mt-1 snap-x scrollbar-thin scrollbar-thumb-gray-600/50">
                                                                            {(selectedTemplate.carouselCards || []).map((card, idx) => (
                                                                                <div key={idx} className="flex-shrink-0 w-40 bg-[#2a3942] rounded-lg overflow-hidden border border-white/10 flex flex-col snap-center">
                                                                                    {card.s3Url && (
                                                                                        <div className="h-24 w-full relative">
                                                                                            {card.mimeType?.startsWith('video') ? (
                                                                                                <video src={card.s3Url} className="w-full h-full object-cover" />
                                                                                            ) : (
                                                                                                <img src={card.s3Url} alt="" className="w-full h-full object-cover" />
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                    <div className="p-2 flex-1">
                                                                                        <p className="font-bold text-xs text-[#e9edef] line-clamp-1 mb-0.5">{card.title}</p>
                                                                                        <p className="text-[10px] text-[#8696a0] line-clamp-2">{card.subtitle}</p>
                                                                                    </div>
                                                                                    {(card.buttonText || card.buttonValue) && (
                                                                                        <div className="border-t border-white/10 py-1.5 text-center">
                                                                                            <span className="text-xs text-[#53bdeb] font-medium">{card.buttonText || "View"}</span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    {/* Footer */}
                                                                    {selectedTemplate.languages[0]
                                                                        ?.footerText && (
                                                                            <div className="px-3 pb-2">
                                                                                <p className="text-[11px] text-[#8696a0]">
                                                                                    {
                                                                                        selectedTemplate.languages[0]
                                                                                            .footerText
                                                                                    }
                                                                                </p>
                                                                            </div>
                                                                        )}

                                                                    {/* Time + Status */}
                                                                    <div className="absolute right-2 bottom-1.5 flex items-end gap-1">
                                                                        <span className="text-[10px] text-[#8696a0]">
                                                                            12:00 PM
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Interactive Buttons (Native Look) */}
                                                                {selectedTemplate.buttons &&
                                                                    selectedTemplate.buttons.length > 0 && (
                                                                        <div className="space-y-1.5 pt-0.5 w-full">
                                                                            {selectedTemplate.buttons.map(
                                                                                (btn, i) => (
                                                                                    <div
                                                                                        key={i}
                                                                                        className="bg-[#202c33] rounded-md py-2.5 px-3 flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.99] transition-all cursor-pointer hover:bg-[#2a3942]"
                                                                                    >
                                                                                        {btn.type === "PHONE_NUMBER" && (
                                                                                            <Phone className="w-4 h-4 text-[#00a884]" />
                                                                                        )}
                                                                                        {btn.type === "URL" && (
                                                                                            <Globe className="w-4 h-4 text-[#53bdeb]" />
                                                                                        )}
                                                                                        {btn.type === "QUICK_REPLY" && (
                                                                                            <div className="w-4 h-4 rounded-full border border-[#00a884] flex items-center justify-center">
                                                                                                <div className="w-2 h-2 bg-[#00a884] rounded-full"></div>
                                                                                            </div>
                                                                                        )}
                                                                                        <span className="text-[#00a884] font-medium text-sm truncate max-w-[200px]">
                                                                                            {btn.text}
                                                                                        </span>
                                                                                    </div>
                                                                                )
                                                                            )}
                                                                        </div>
                                                                    )}
                                                            </div>
                                                        </div>

                                                        {/* Home Bar Mock */}
                                                        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-white/20 rounded-full z-20"></div>
                                                    </div>
                                                </div>

                                                {templateVariables.length > 0 && (
                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-between ml-1">
                                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                                                                Personalize Variables
                                                            </p>
                                                            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                                                                {templateVariables.length} Required
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-1 gap-4">
                                                            {templateVariables.map((val, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    className="group flex flex-col gap-1.5 p-3 rounded-xl border border-border hover:border-primary/30 transition-colors"
                                                                >
                                                                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider group-focus-within:text-primary transition-colors">
                                                                        Variable {"{{" + (idx + 1) + "}}"}
                                                                    </label>
                                                                    <input
                                                                        type="text"
                                                                        value={val}
                                                                        onChange={(e) => {
                                                                            const next = [...templateVariables];
                                                                            next[idx] = e.target.value;
                                                                            setTemplateVariables(next);
                                                                        }}
                                                                        placeholder={`Enter value for placeholder ${idx + 1
                                                                            }...`}
                                                                        className="w-full bg-transparent text-sm outline-none focus:ring-0 placeholder:text-muted-foreground/50 h-6"
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-4 pt-4 border-t border-border flex gap-3">
                                                <button
                                                    onClick={() => setSelectedTemplate(null)}
                                                    className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleSendTemplate}
                                                    disabled={isSendingTemplate}
                                                    className="flex-[2] py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                                                >
                                                    {isSendingTemplate ? (
                                                        <>
                                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                            )}

                            {/* Hidden file input for Send Media types (EXCLUDING gallery) */}
                            {mediaModal.type !== "template" &&
                                mediaModal.type !== "gallery" && (
                                    <input
                                        ref={genericInputRef}
                                        type="file"
                                        multiple
                                        accept={
                                            mediaModal.type === "video"
                                                ? "video/*"
                                                : mediaModal.type === "audio"
                                                    ? "audio/*"
                                                    : "*"
                                        }
                                        className="hidden"
                                        onChange={async (e) => {
                                            if (!e.target.files?.length) return;

                                            try {
                                                for (const rawFile of Array.from(e.target.files)) {
                                                    const { file } = await processMedia(rawFile);

                                                    const form = new FormData();
                                                    form.append("conversationId", conversation.id);
                                                    form.append("file", file);

                                                    await api.post(
                                                        "/vendor/whatsapp/send-media",
                                                        form
                                                    );
                                                }

                                                setMediaModal(null);
                                            } catch (err) {
                                                const message =
                                                    err instanceof Error
                                                        ? err.message
                                                        : "An error occurred";
                                                toast.error(message);
                                            }
                                        }}
                                    />
                                )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}