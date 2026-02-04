"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Image as ImageIcon, ShoppingBag, Layers, Upload, Eye, FileText, Video, MoreVertical, Phone, Globe, Workflow, CheckCircle, RefreshCw, Loader2, AlertTriangle, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "react-toastify";
import { cn } from "@/lib/utils";
import GalleryModal from "@/components/chatbot/GalleryModal";
import { processMedia } from "@/lib/mediaProcessor";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Select, SelectOption } from "@/components/select";
import { Badge } from "@/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";

interface CatalogTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (templateData: any) => Promise<void> | void;
    initialData?: any;
}

const TEMPLATE_TYPES = [
    {
        id: 'carousel',
        name: 'Carousel',
        icon: Layers,
        description: 'Multi-card carousel (up to 10 cards)',
    },
    {
        id: 'catalog',
        name: 'Product Catalog',
        icon: ShoppingBag,
        description: 'Multi-product catalog (up to 30 products)',
    },
];

export default function CatalogTemplateModal({ isOpen, onClose, onSubmit, initialData }: CatalogTemplateModalProps) {
    const [templateType, setTemplateType] = useState('carousel');
    const [templateName, setTemplateName] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [category, setCategory] = useState('MARKETING');
    const [language, setLanguage] = useState('en');
    const [bodyText, setBodyText] = useState('');
    const [footerText, setFooterText] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showMobilePreview, setShowMobilePreview] = useState(false);

    // Gallery Modal State
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [currentCardIndex, setCurrentCardIndex] = useState<number | null>(null);


    // Catalog-specific
    const [catalogProducts, setCatalogProducts] = useState<string[]>(['']);

    // Carousel-specific
    const carouselRef = useRef<HTMLDivElement>(null);
    const [carouselCards, setCarouselCards] = useState<Array<{
        title: string;
        subtitle: string;
        image: File | null;
        imagePreview: string | null;
        button: { text: string; url: string; };
    }>>([
        { title: '', subtitle: '', image: null, imagePreview: null, button: { text: '', url: '' } }
    ]);

    // Populate data for editing
    useEffect(() => {
        if (initialData) {
            // Determine type (this logic depends on your backend response structure)
            // Assuming initialData has type or components structure we can guess
            // For now, let's look for known fields

            setTemplateName(initialData.metaTemplateName || '');
            setDisplayName(initialData.displayName || '');
            setCategory(initialData.category || 'MARKETING');

            const lang = initialData.languages?.[0]; // Assuming first language
            if (lang) {
                setLanguage(lang.language || 'en');
                setBodyText(lang.body || '');
                setFooterText(lang.footerText || '');
            }

            // Simple heuristic for type - update this based on actual backend data
            // Determine type and populate data
            if (initialData.templateType === 'carousel' || initialData.carouselCards?.length > 0 || lang?.headerType === 'CAROUSEL') {
                setTemplateType('carousel');
                if (initialData.carouselCards && Array.isArray(initialData.carouselCards) && initialData.carouselCards.length > 0) {
                    setCarouselCards(initialData.carouselCards.map((c: any) => ({
                        title: c.title || '',
                        subtitle: c.subtitle || '',
                        image: null,
                        imagePreview: c.s3Url || null,
                        button: {
                            text: c.buttonText || '',
                            url: c.buttonValue || ''
                        }
                    })));
                }
            } else if (initialData.templateType === 'catalog' || initialData.catalogProducts?.length > 0 || lang?.headerType === 'CATALOG') {
                setTemplateType('catalog');
                if (initialData.catalogProducts && Array.isArray(initialData.catalogProducts) && initialData.catalogProducts.length > 0) {
                    // Assuming catalogProducts in DB are objects { productId: string }
                    setCatalogProducts(initialData.catalogProducts.map((p: any) => p.productId || ''));
                }
            } else {
                setTemplateType('carousel');
            }
        } else if (isOpen) {
            // Reset form for create mode - ONLY if modal is open
            setTemplateName('');
            setDisplayName('');
            setCategory('MARKETING');
            setLanguage('en');
            setBodyText('');
            setFooterText('');


            // Reset Catalog
            setCatalogProducts(['']);

            // Reset Carousel
            setCarouselCards([{
                title: '',
                subtitle: '',
                image: null,
                imagePreview: null,
                button: { text: '', url: '' }
            }]);

            // Default to carousel if that's what we want, or standard
            setTemplateType('carousel');
        }
    }, [initialData, isOpen]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, cardIndex?: number) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const preview = e.target?.result as string;

                    if (cardIndex !== undefined) {
                        // Carousel card image
                        const updated = [...carouselCards];
                        updated[cardIndex].image = file;
                        updated[cardIndex].imagePreview = preview;
                        setCarouselCards(updated);
                    }
                };
                reader.readAsDataURL(file);
            }
        }
    };

    const handleGallerySelect = (url: string | string[]) => {
        const selectedUrl = Array.isArray(url) ? url[0] : url;

        if (currentCardIndex !== null) {
            // Edit Carousel Card Image
            const updated = [...carouselCards];
            updated[currentCardIndex].image = null; // Clear file as we use URL
            updated[currentCardIndex].imagePreview = selectedUrl;
            setCarouselCards(updated);
        }
        setIsGalleryOpen(false);
        setCurrentCardIndex(null);
    };

    const handleAddProduct = () => {
        if (catalogProducts.length < 30) {
            setCatalogProducts([...catalogProducts, '']);
        }
    };

    const handleRemoveProduct = (index: number) => {
        setCatalogProducts(catalogProducts.filter((_, i) => i !== index));
    };

    const handleProductChange = (index: number, value: string) => {
        const updated = [...catalogProducts];
        updated[index] = value;
        setCatalogProducts(updated);
    };

    const handleAddCard = () => {
        if (carouselCards.length < 10) {
            setCarouselCards([...carouselCards, {
                title: '',
                subtitle: '',
                image: null,
                imagePreview: null,
                button: { text: '', url: '' }
            }]);
        }
    };

    const handleRemoveCard = (index: number) => {
        setCarouselCards(carouselCards.filter((_, i) => i !== index));
    };

    const handleCardChange = (index: number, field: string, value: any) => {
        const updated = [...carouselCards];
        if (field.includes('.')) {
            const [parent, child] = field.split('.');
            (updated[index] as any)[parent][child] = value;
        } else {
            (updated[index] as any)[field] = value;
        }
        setCarouselCards(updated);
    };


    const handleSubmit = async () => {
        try {
            setIsSubmitting(true);
            setError(null);

            const formData = new FormData();
            formData.append('metaTemplateName', templateName);
            formData.append('displayName', displayName);
            formData.append('category', category);
            formData.append('language', language);
            formData.append('body', bodyText);
            if (footerText) formData.append('footerText', footerText);
            formData.append('templateType', templateType);

            // Catalog products
            if (templateType === 'catalog') {
                const products = catalogProducts.filter(p => p.trim() !== '');
                formData.append('catalogProducts', JSON.stringify(products));
            }

            // Carousel cards
            if (templateType === 'carousel') {
                for (let i = 0; i < carouselCards.length; i++) {
                    if (!carouselCards[i].title) throw new Error(`Card ${i + 1} requires a title`);
                    if (!carouselCards[i].image && !carouselCards[i].imagePreview) throw new Error(`Card ${i + 1} requires an image`);
                }

                const cleanCards = carouselCards.map((card, index) => {
                    if (card.image instanceof File) {
                        formData.append(`carouselImages_${index}`, card.image);
                    }
                    const { image, imagePreview, ...rest } = card;
                    const cardData: any = { ...rest };
                    if (!image && imagePreview && typeof imagePreview === 'string' && imagePreview.startsWith('http')) {
                        cardData.s3Url = imagePreview;
                    }
                    return cardData;
                });
                formData.append('carouselCards', JSON.stringify(cleanCards));
            }

            await onSubmit(formData);
        } catch (err: any) {
            console.error(err);
            const msg = err.message || 'An error occurred';
            setError(msg);
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-[2px]"
                        onClick={onClose}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-background w-full max-w-6xl sm:rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col h-full sm:h-[90vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="p-4 sm:p-5 border-b border-border flex justify-between items-center shrink-0 bg-muted/10">
                                <div>
                                    <h2 className="text-lg font-bold">
                                        {initialData ? "Edit Template" : "New Template"}
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
                                        onClick={onClose}
                                    >
                                        <X className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 bg-muted/5 divide-y lg:divide-y-0 lg:divide-x divide-border/50">
                                {/* LEFT: FORM */}
                                <div className="lg:col-span-7 xl:col-span-8 p-4 sm:p-6 overflow-y-auto space-y-6 scrollbar-thin">
                                    {error && (
                                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg text-sm text-red-600 dark:text-red-400">
                                            {error}
                                        </div>
                                    )}
                                    {/* Step 1: Template Type Selection */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-semibold text-foreground/80">
                                            Template Type
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            {TEMPLATE_TYPES.map((type) => {
                                                const Icon = type.icon;
                                                return (
                                                    <button
                                                        key={type.id}
                                                        onClick={() => setTemplateType(type.id)}
                                                        className={cn(
                                                            "p-3 rounded-xl border-2 transition-all text-left group",
                                                            templateType === type.id
                                                                ? "border-primary bg-primary/5 shadow-sm"
                                                                : "border-border bg-card hover:border-primary/50"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-colors",
                                                            templateType === type.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                                                        )}>
                                                            <Icon className="w-4 h-4" />
                                                        </div>
                                                        <div className="text-xs font-bold text-foreground">
                                                            {type.name}
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                                                            {type.description}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="w-full h-px bg-border/40"></div>

                                    {/* Step 2: Basic Information */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-semibold text-foreground/80">
                                            Basic Information
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium">Template Name <span className="text-red-500">*</span></label>
                                                <Input
                                                    placeholder="e.g. summer_sale_2026"
                                                    value={templateName}
                                                    onChange={(e) => setTemplateName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium">Display Name <span className="text-red-500">*</span></label>
                                                <Input
                                                    placeholder="e.g. Summer Sale 2026"
                                                    value={displayName}
                                                    onChange={(e) => setDisplayName(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full h-px bg-border/40"></div>

                                    {/* Step 3: Message Content */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-semibold text-foreground/80">
                                            Message Content
                                        </h3>
                                        <div className="space-y-6">
                                            {/* Body */}
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-xs font-medium">Message Body <span className="text-red-500">*</span></label>
                                                    <span className="text-[10px] text-muted-foreground font-mono">{bodyText.length}/1024</span>
                                                </div>
                                                <textarea
                                                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none min-h-[120px] resize-none"
                                                    placeholder="Enter your message here..."
                                                    value={bodyText}
                                                    onChange={(e) => setBodyText(e.target.value)}
                                                />
                                            </div>

                                            {/* Footer */}
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium">Footer Text (Optional)</label>
                                                <Input
                                                    placeholder="Enter footer text..."
                                                    value={footerText}
                                                    onChange={(e) => setFooterText(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full h-px bg-border/40"></div>

                                    {/* Step 5: Type-Specific Details */}
                                    {(templateType === 'catalog' || templateType === 'carousel') && (
                                        <div className="space-y-4">
                                            <h3 className="text-sm font-semibold text-foreground/80">
                                                {templateType === 'catalog' ? 'Product Selection' : 'Carousel Cards'}
                                            </h3>

                                            <div className="space-y-4">
                                                {templateType === 'catalog' && (
                                                    <div className="space-y-4">
                                                        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-2">
                                                            <div className="flex items-center gap-2 text-primary">
                                                                <ShoppingBag className="w-4 h-4" />
                                                                <span className="text-[10px] font-bold uppercase tracking-wider">Catalog Integration</span>
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                                                                Enter product IDs from your Meta Catalog. Images and details will auto-populate on the customer's device.
                                                            </p>
                                                        </div>

                                                        <div className="space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <label className="text-xs font-semibold">Products ({catalogProducts.filter(p => p.trim()).length}/30)</label>
                                                                <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={handleAddProduct}>
                                                                    <Plus className="w-3 h-3 mr-1" /> Add Product
                                                                </Button>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[260px] overflow-y-auto pr-2 scrollbar-thin">
                                                                {catalogProducts.map((product, index) => (
                                                                    <div key={index} className="flex gap-2">
                                                                        <Input
                                                                            placeholder="e.g. SKU_101"
                                                                            value={product}
                                                                            onChange={(e) => handleProductChange(index, e.target.value)}
                                                                            className="h-9 text-xs"
                                                                        />
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                                                                            onClick={() => handleRemoveProduct(index)}
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {templateType === 'carousel' && (
                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Carousel Config ({carouselCards.length}/10)</label>
                                                            <Button variant="outline" size="sm" className="h-8 text-xs gap-2" onClick={handleAddCard} disabled={carouselCards.length >= 10}>
                                                                <Plus className="w-3.5 h-3.5" /> Add Card
                                                            </Button>
                                                        </div>
                                                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
                                                            {carouselCards.map((card, index) => (
                                                                <Card key={index} className="border-border/60 bg-muted/20 shadow-none">
                                                                    <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between space-y-0 text-[10px] font-bold uppercase text-muted-foreground">
                                                                        <span>Card {index + 1}</span>
                                                                        {carouselCards.length > 1 && (
                                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveCard(index)}>
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </Button>
                                                                        )}
                                                                    </CardHeader>
                                                                    <CardContent className="p-3 space-y-4">
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                            <div className="space-y-3">
                                                                                <div className="space-y-1">
                                                                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Card Title *</label>
                                                                                    <Input
                                                                                        placeholder="Title (max 60)"
                                                                                        value={card.title}
                                                                                        onChange={(e) => handleCardChange(index, 'title', e.target.value)}
                                                                                        className="h-8 text-xs font-semibold"
                                                                                    />
                                                                                </div>
                                                                                <div className="space-y-1">
                                                                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Description</label>
                                                                                    <textarea
                                                                                        placeholder="Subtitle text..."
                                                                                        value={card.subtitle}
                                                                                        onChange={(e) => handleCardChange(index, 'subtitle', e.target.value)}
                                                                                        className="w-full h-16 p-2 bg-background border border-border rounded-lg text-[10px] resize-none outline-none focus:ring-1 focus:ring-primary"
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                            <div className="space-y-3">
                                                                                <div className="space-y-1">
                                                                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Card Image *</label>
                                                                                    <div
                                                                                        className="aspect-video border-2 border-dashed border-primary/20 rounded-xl flex flex-col items-center justify-center bg-background hover:bg-primary/5 transition-all cursor-pointer group overflow-hidden"
                                                                                        onClick={() => { setCurrentCardIndex(index); setIsGalleryOpen(true); }}
                                                                                    >
                                                                                        {card.imagePreview ? (
                                                                                            <img src={card.imagePreview} className="w-full h-full object-cover" />
                                                                                        ) : (
                                                                                            <div className="text-center">
                                                                                                <ImageIcon className="w-6 h-6 text-primary/30 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                                                                                                <span className="text-[10px] text-muted-foreground font-medium">Click to select</span>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="pt-2 border-t border-border/40 grid grid-cols-2 gap-3">
                                                                            <div className="space-y-1">
                                                                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Button Text</label>
                                                                                <Input
                                                                                    placeholder="Shop Now"
                                                                                    value={card.button.text}
                                                                                    onChange={(e) => handleCardChange(index, 'button.text', e.target.value)}
                                                                                    className="h-8 text-xs"
                                                                                />
                                                                            </div>
                                                                            <div className="space-y-1">
                                                                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Button URL</label>
                                                                                <Input
                                                                                    placeholder="https://..."
                                                                                    value={card.button.url}
                                                                                    onChange={(e) => handleCardChange(index, 'button.url', e.target.value)}
                                                                                    className="h-8 text-xs"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </CardContent>
                                                                </Card>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* RIGHT: PHONE PREVIEW */}
                                <div
                                    className={cn(
                                        "bg-muted/50 p-8 flex-col items-center justify-center relative border-l border-border/50 overflow-hidden transition-all",
                                        "lg:flex lg:col-span-5 xl:col-span-4 lg:static lg:z-auto lg:p-4 lg:pt-4", // Desktop defaults
                                        showMobilePreview ? "flex fixed inset-0 z-50 pt-24 pb-8" : "hidden" // Mobile overlay
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

                                    {/* Mobile Frame Container */}
                                    <div className="relative mx-auto w-full max-w-[280px] border-[10px] border-border rounded-[48px] shadow-2xl bg-card transition-all duration-500 overflow-hidden transform lg:scale-[1.02] 2xl:scale-105">
                                        <div className="h-6 bg-card flex justify-between items-center px-6 pt-3 z-20 relative">
                                            <span className="text-[10px] text-muted-foreground font-semibold">9:41</span>
                                            <div className="flex gap-1.5 opacity-50 italic font-bold text-[10px] text-muted-foreground">WhatsApp</div>
                                        </div>

                                        <div className="relative bg-muted/30 p-3 pt-4 min-h-[500px] max-h-[550px] overflow-y-auto custom-scrollbar flex flex-col">
                                            <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]"></div>

                                            <div className="relative z-10 w-full flex flex-col gap-1 mt-1 animate-in fade-in zoom-in-95 duration-500">
                                                <div className="bg-card rounded-2xl rounded-tl-none shadow-lg relative overflow-hidden group border border-border">
                                                    <div className="px-3 pt-3 pb-3 text-[13px] leading-snug text-foreground/80 whitespace-pre-wrap font-sans">
                                                        {bodyText || "Design your message and it will appear here in real-time..."}

                                                        {footerText && (
                                                            <p className="mt-1.5 text-[11px] text-muted-foreground font-medium border-t border-border pt-1.5">
                                                                {footerText}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* Catalog Content (Inside Bubble as meta-card) */}
                                                    {templateType === 'catalog' && catalogProducts.filter(p => p.trim()).length > 0 && (
                                                        <div className="px-3 pb-3 border-t border-border bg-muted/10">
                                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                                {catalogProducts.filter(p => p.trim()).slice(0, 4).map((product, idx) => (
                                                                    <div key={idx} className="aspect-square bg-muted dark:bg-[#2c3941] rounded-xl relative overflow-hidden group border border-black/5 transition-all hover:scale-[1.02]">
                                                                        <div className="w-full h-full flex items-center justify-center">
                                                                            <ShoppingBag className="w-8 h-8 opacity-[0.08]" />
                                                                        </div>
                                                                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 backdrop-blur-[2px] transition-all group-hover:bg-black/80">
                                                                            <div className="text-[9px] text-white truncate font-bold text-center tracking-wide">{product}</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            {catalogProducts.filter(p => p.trim()).length > 4 && (
                                                                <div className="mt-2 py-1 text-center text-[10px] font-bold text-primary bg-primary/10 rounded-lg">+ {catalogProducts.filter(p => p.trim()).length - 4} More Products</div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Action Buttons */}
                                                    {templateType === 'catalog' && (
                                                        <div className="border-t border-border bg-muted/20">
                                                            <div className="w-full py-2.5 text-primary text-[13px] font-bold text-center flex items-center justify-center gap-2">
                                                                <ShoppingBag className="w-3.5 h-3.5" />
                                                                View Catalog
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="self-end mr-1 mt-0.5 flex items-center gap-1 opacity-40">
                                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                                                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <div className="flex -space-x-1">
                                                        <CheckCircle className="w-2.5 h-2.5 text-muted-foreground" />
                                                    </div>
                                                </div>

                                                {/* Carousel cards (Below bubble) */}
                                                {templateType === 'carousel' && (
                                                    <div className="relative mt-2 group/carousel">
                                                        {carouselCards.length > 1 && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => carouselRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
                                                                    className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-8 h-8 flex items-center justify-center bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 rounded-full shadow-md border border-border opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-gray-50 dark:hover:bg-gray-700"
                                                                >
                                                                    <ChevronLeft className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => carouselRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
                                                                    className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-8 h-8 flex items-center justify-center bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 rounded-full shadow-md border border-border opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-gray-50 dark:hover:bg-gray-700"
                                                                >
                                                                    <ChevronRight className="w-4 h-4" />
                                                                </button>
                                                            </>
                                                        )}
                                                        <div
                                                            ref={carouselRef}
                                                            className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-1 px-1 snap-x no-scrollbar"
                                                        >
                                                            {carouselCards.map((card, idx) => (
                                                                <div key={idx} className="bg-card shrink-0 w-[220px] rounded-2xl shadow-lg overflow-hidden border border-border snap-center">
                                                                    <div className="h-28 bg-muted dark:bg-[#2c3941] flex items-center justify-center relative group">
                                                                        {card.imagePreview ? (
                                                                            <img src={card.imagePreview} alt="" className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            <ImageIcon className="w-8 h-8 opacity-10" />
                                                                        )}
                                                                    </div>
                                                                    <div className="p-3 space-y-1">
                                                                        <div className="text-[12px] font-bold text-foreground truncate">{card.title || `Product ${idx + 1}`}</div>
                                                                        <div className="text-[10px] text-muted-foreground line-clamp-2 leading-tight h-7">{card.subtitle || "Card description goes here..."}</div>
                                                                        <div className="mt-2 pt-2 text-center text-primary text-[12px] font-bold border-t border-border">
                                                                            {card.button.text || "View Product"}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-4 font-bold tracking-widest uppercase opacity-40">
                                        Live Preview
                                    </p>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 sm:p-5 border-t border-border bg-muted/5 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                                <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest max-sm:hidden">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        {language}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <Button
                                        variant="outline"
                                        onClick={onClose}
                                        className="flex-1 sm:flex-none h-11 px-8 rounded-xl font-bold"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                        className="flex-1 sm:flex-none h-11 px-10 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all gap-2"
                                    >
                                        {isSubmitting ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>{initialData ? 'Update Template' : 'Create Template'}</>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {isGalleryOpen && (
                <GalleryModal
                    isOpen={isGalleryOpen}
                    onClose={() => {
                        setIsGalleryOpen(false);
                        setCurrentCardIndex(null);
                    }}
                    onSelect={handleGallerySelect}
                    multiSelect={false}
                />
            )}
        </>
    );
}
