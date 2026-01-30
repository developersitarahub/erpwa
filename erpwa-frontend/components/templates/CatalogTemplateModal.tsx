"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Image as ImageIcon, ShoppingBag, Layers, Upload, Eye } from "lucide-react";
import { toast } from "react-toastify";
import { cn } from "@/lib/utils";
import GalleryModal from "@/components/chatbot/GalleryModal";

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

    // Gallery Modal State
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [currentCardIndex, setCurrentCardIndex] = useState<number | null>(null);

    // Standard template
    const [headerType, setHeaderType] = useState('TEXT');
    const [headerText, setHeaderText] = useState('');
    const [headerFile, setHeaderFile] = useState<File | null>(null);
    const [headerPreview, setHeaderPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Standard Buttons & Flows
    const [buttons, setButtons] = useState<Array<{
        type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'FLOW';
        text: string;
        value?: string;
        flowId?: string;
        flowAction?: 'navigate' | 'data_exchange';
    }>>([]);
    const [publishedFlows, setPublishedFlows] = useState<any[]>([]);

    useEffect(() => {
        // Fetch published flows for the dropdown
        const fetchFlows = async () => {
            try {
                // We need to import api here, or passed as prop. 
                // Assuming api is available globally or we import it.
                // Since this file uses 'use client', I'll import it at top.
                const { default: api } = await import('@/lib/api');
                const response = await api.get('/whatsapp/flows');
                // Filter only published flows
                const allFlows = response.data.flows || [];
                setPublishedFlows(allFlows.filter((f: any) => f.status === 'PUBLISHED'));
            } catch (error) {
                console.error('Failed to fetch flows', error);
            }
        };
        if (isOpen) fetchFlows();
    }, [isOpen]);

    // Catalog-specific
    const [catalogProducts, setCatalogProducts] = useState<string[]>(['']);

    // Carousel-specific
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
                setHeaderType(lang.headerType || 'TEXT');
                setHeaderText(lang.headerText || '');
                if (lang.media?.s3Url) {
                    setHeaderPreview(lang.media.s3Url);
                }

                // Populate buttons if standard
                if (initialData.buttons && initialData.templateType === 'standard') {
                    setButtons(initialData.buttons.map((b: any) => ({
                        type: b.type,
                        text: b.text,
                        value: b.value,
                        flowId: b.flowId,
                        flowAction: b.flowAction
                    })));
                }
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
                setTemplateType('standard');
            }
        } else if (isOpen) {
            // Reset form for create mode - ONLY if modal is open
            setTemplateName('');
            setDisplayName('');
            setCategory('MARKETING');
            setLanguage('en');
            setBodyText('');
            setFooterText('');

            // Reset Standard
            setHeaderType('TEXT');
            setHeaderText('');
            setHeaderFile(null);
            setHeaderPreview(null);
            setButtons([]);

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
                    } else {
                        // Standard header image
                        setHeaderFile(file);
                        setHeaderPreview(preview);
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
        } else {
            // Edit Header Image (if applicable in future, currently only handling cards per user request)
            // But let's support header too if needed
            if (headerType === 'IMAGE') {
                setHeaderFile(null);
                setHeaderPreview(selectedUrl);
            }
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

    // Standard Buttons Helpers
    const handleAddButton = () => {
        if (buttons.length < 3) {
            setButtons([...buttons, { type: 'QUICK_REPLY', text: '' }]);
        }
    };

    const handleRemoveButton = (index: number) => {
        setButtons(buttons.filter((_, i) => i !== index));
    };

    const handleButtonChange = (index: number, field: string, value: any) => {
        const updated = [...buttons];
        (updated[index] as any)[field] = value;

        // Reset fields when type changes
        if (field === 'type') {
            updated[index].text = '';
            updated[index].value = '';
            delete updated[index].flowId;
            delete updated[index].flowAction;

            if (value === 'FLOW') {
                updated[index].text = 'View Flow';
                updated[index].flowAction = 'navigate';
            }
        }

        setButtons(updated);
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

            // Standard template
            if (templateType === 'standard') {
                formData.append('header.type', headerType);
                if (headerType === 'TEXT' && headerText) {
                    formData.append('header.text', headerText);
                } else if (headerType !== 'TEXT' && headerFile) {
                    formData.append('header.file', headerFile);
                }

                buttons.forEach((btn, index) => {
                    formData.append(`buttons[${index}][type]`, btn.type);
                    formData.append(`buttons[${index}][text]`, btn.text);
                    if (btn.type === 'URL' || btn.type === 'PHONE_NUMBER') {
                        formData.append(`buttons[${index}][value]`, btn.value || '');
                    }
                    if (btn.type === 'FLOW') {
                        if (btn.flowId) formData.append(`buttons[${index}][flowId]`, btn.flowId);
                        if (btn.flowAction) formData.append(`buttons[${index}][flowAction]`, btn.flowAction);
                    }
                });
            }

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
                    <>
                        <motion.div
                            key="backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                            onClick={onClose}
                        />
                        <motion.div
                            key="modal"
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-6xl h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl z-50 flex flex-col"
                        >
                            {/* Header */}
                            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                        {templateType === 'standard' && <ImageIcon className="w-5 h-5 text-white" />}
                                        {templateType === 'catalog' && <ShoppingBag className="w-5 h-5 text-white" />}
                                        {templateType === 'carousel' && <Layers className="w-5 h-5 text-white" />}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-white">
                                            Create Template
                                        </h2>
                                        <p className="text-sm text-blue-100">
                                            {templateType === 'standard' && 'Standard message template'}
                                            {templateType === 'catalog' && 'Multi-product catalog template'}
                                            {templateType === 'carousel' && 'Multi-card carousel template'}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>

                            {/* Split View */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 flex-1 overflow-hidden">
                                {/* LEFT: Form */}
                                <div className="p-6 space-y-4 overflow-y-auto border-r border-gray-200 dark:border-gray-800">
                                    {error && (
                                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg text-sm text-red-600 dark:text-red-400">
                                            {error}
                                        </div>
                                    )}
                                    {/* Template Type */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                                            Template Type
                                        </label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {TEMPLATE_TYPES.map((type) => {
                                                const Icon = type.icon;
                                                return (
                                                    <button
                                                        key={type.id}
                                                        onClick={() => setTemplateType(type.id)}
                                                        className={`p-3 rounded-xl border-2 transition-all ${templateType === type.id
                                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                                                            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                                                            }`}
                                                    >
                                                        <Icon className={`w-5 h-5 mx-auto mb-1 ${templateType === type.id ? 'text-blue-600' : 'text-gray-600'
                                                            }`} />
                                                        <div className="text-xs font-semibold text-gray-900 dark:text-white">
                                                            {type.name}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Basic Info */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-900 dark:text-white mb-1.5">
                                                Template Name *
                                            </label>
                                            <input
                                                type="text"
                                                value={templateName}
                                                onChange={(e) => setTemplateName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                                                placeholder="summer_sale_2026"
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Lowercase, underscores only</p>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-gray-900 dark:text-white mb-1.5">
                                                Display Name *
                                            </label>
                                            <input
                                                type="text"
                                                value={displayName}
                                                onChange={(e) => setDisplayName(e.target.value)}
                                                placeholder="Summer Sale 2026"
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            />
                                        </div>
                                    </div>

                                    {/* Standard: Header Type */}
                                    {templateType === 'standard' && (
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-900 dark:text-white mb-1.5">
                                                Header Type
                                            </label>
                                            <select
                                                value={headerType}
                                                onChange={(e) => setHeaderType(e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="TEXT">Text</option>
                                                <option value="IMAGE">Image</option>
                                                <option value="VIDEO">Video</option>
                                                <option value="DOCUMENT">Document</option>
                                            </select>

                                            {headerType === 'TEXT' ? (
                                                <input
                                                    type="text"
                                                    value={headerText}
                                                    onChange={(e) => setHeaderText(e.target.value)}
                                                    placeholder="Header text"
                                                    className="w-full mt-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                                />
                                            ) : (
                                                <div className="mt-2">
                                                    <input
                                                        ref={fileInputRef}
                                                        type="file"
                                                        accept={headerType === 'IMAGE' ? 'image/*' : headerType === 'VIDEO' ? 'video/*' : '.pdf,.doc,.docx'}
                                                        onChange={handleFileChange}
                                                        className="hidden"
                                                    />
                                                    <button
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="w-full px-3 py-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:border-blue-500 transition-colors flex items-center justify-center gap-2"
                                                    >
                                                        <Upload className="w-4 h-4" />
                                                        {headerFile ? headerFile.name : `Upload ${headerType.toLowerCase()}`}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Body Text */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-900 dark:text-white mb-1.5">
                                            Message Body *
                                        </label>
                                        <textarea
                                            value={bodyText}
                                            onChange={(e) => setBodyText(e.target.value)}
                                            rows={3}
                                            placeholder="Enter your message..."
                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
                                        />
                                    </div>

                                    {/* Footer */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-900 dark:text-white mb-1.5">
                                            Footer (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={footerText}
                                            onChange={(e) => setFooterText(e.target.value)}
                                            placeholder="Reply STOP to unsubscribe"
                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    {/* Standard: Buttons */}
                                    {templateType === 'standard' && (
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-xs font-semibold text-gray-900 dark:text-white">
                                                    Buttons ({buttons.length}/3)
                                                </label>
                                                <button
                                                    onClick={handleAddButton}
                                                    disabled={buttons.length >= 3}
                                                    className="flex items-center gap-1 px-2 py-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded text-xs font-medium"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                    Add Button
                                                </button>
                                            </div>
                                            <div className="space-y-3">
                                                {buttons.map((btn, index) => (
                                                    <div key={index} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Button {index + 1}</span>
                                                            <button onClick={() => handleRemoveButton(index)} className="text-red-500 hover:text-red-600">
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                                            <select
                                                                value={btn.type}
                                                                onChange={(e) => handleButtonChange(index, 'type', e.target.value)}
                                                                className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                                            >
                                                                <option value="QUICK_REPLY">Quick Reply</option>
                                                                <option value="URL">URL</option>
                                                                <option value="PHONE_NUMBER">Phone Number</option>
                                                                <option value="FLOW">WhatsApp Flow</option>
                                                            </select>

                                                            <input
                                                                type="text"
                                                                value={btn.text}
                                                                onChange={(e) => handleButtonChange(index, 'text', e.target.value)}
                                                                placeholder="Button Text"
                                                                className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                                            />
                                                        </div>

                                                        {/* Button Details */}
                                                        {btn.type === 'URL' && (
                                                            <input
                                                                type="url"
                                                                value={btn.value}
                                                                onChange={(e) => handleButtonChange(index, 'value', e.target.value)}
                                                                placeholder="https://example.com"
                                                                className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                                            />
                                                        )}
                                                        {btn.type === 'PHONE_NUMBER' && (
                                                            <input
                                                                type="tel"
                                                                value={btn.value}
                                                                onChange={(e) => handleButtonChange(index, 'value', e.target.value)}
                                                                placeholder="+1234567890"
                                                                className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                                            />
                                                        )}
                                                        {btn.type === 'FLOW' && (
                                                            <div className="space-y-2">
                                                                <select
                                                                    value={btn.flowId || ''}
                                                                    onChange={(e) => handleButtonChange(index, 'flowId', e.target.value)}
                                                                    className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                                                >
                                                                    <option value="">Select a Flow...</option>
                                                                    {publishedFlows.map((f, i) => (
                                                                        <option key={f.id || i} value={f.id}>{f.name}</option>
                                                                    ))}
                                                                </select>
                                                                <select
                                                                    value={btn.flowAction || 'navigate'}
                                                                    onChange={(e) => handleButtonChange(index, 'flowAction', e.target.value)}
                                                                    className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                                                >
                                                                    <option value="navigate">Navigate</option>
                                                                    <option value="data_exchange">Data Exchange</option>
                                                                </select>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Catalog Products */}
                                    {templateType === 'catalog' && (
                                        <div>
                                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
                                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                                    ℹ️ <strong>Note:</strong> Enter product IDs from your Meta Business Catalog.
                                                    Images, prices, and descriptions will be automatically pulled from the catalog!
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-xs font-semibold text-gray-900 dark:text-white">
                                                    Products ({catalogProducts.filter(p => p.trim()).length}/30)
                                                </label>
                                                <button
                                                    onClick={handleAddProduct}
                                                    disabled={catalogProducts.length >= 30}
                                                    className="flex items-center gap-1 px-2 py-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded text-xs font-medium"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                    Add
                                                </button>
                                            </div>
                                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                                {catalogProducts.map((product, index) => (
                                                    <div key={index} className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={product}
                                                            onChange={(e) => handleProductChange(index, e.target.value)}
                                                            placeholder={`Product Retailer ID ${index + 1}`}
                                                            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                                                        />
                                                        <button
                                                            onClick={() => handleRemoveProduct(index)}
                                                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 rounded-lg"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Compulsory Button Indicator */}
                                            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                                <label className="block text-xs font-semibold text-gray-900 dark:text-white mb-1.5 flex items-center gap-2">
                                                    Action Button
                                                    <span className="text-[10px] font-normal px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">
                                                        Compulsory
                                                    </span>
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value="View Catalog"
                                                        disabled
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-sm text-gray-500 dark:text-gray-400 cursor-not-allowed"
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                                                        Default
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-gray-500 mt-1">
                                                    This button is automatically added to all catalog templates
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Carousel Cards */}
                                    {templateType === 'carousel' && (
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-xs font-semibold text-gray-900 dark:text-white">
                                                    Cards ({carouselCards.length}/10)
                                                </label>
                                                <button
                                                    onClick={handleAddCard}
                                                    disabled={carouselCards.length >= 10}
                                                    className="flex items-center gap-1 px-2 py-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded text-xs font-medium"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                    Add Card
                                                </button>
                                            </div>
                                            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                                                {carouselCards.map((card, index) => (
                                                    <div key={index} className="p-3 border border-border rounded-lg bg-card/50">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="text-xs font-semibold text-foreground">Card {index + 1}</span>
                                                            {carouselCards.length > 1 && (
                                                                <button onClick={() => handleRemoveCard(index)} className="text-destructive hover:text-destructive/80">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="space-y-3">
                                                            <InputField
                                                                label="Card Title *"
                                                                value={card.title}
                                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCardChange(index, 'title', e.target.value)}
                                                                placeholder="Card title"
                                                            />
                                                            <InputField
                                                                label="Card Description"
                                                                value={card.subtitle}
                                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCardChange(index, 'subtitle', e.target.value)}
                                                                placeholder="Card description"
                                                            />
                                                            <div className="space-y-1.5">
                                                                <label className="text-xs font-medium text-foreground/80">Card Image *</label>
                                                                <div className="flex flex-col gap-2">
                                                                    <input
                                                                        type="file"
                                                                        accept="image/*"
                                                                        onChange={(e) => handleFileChange(e, index)}
                                                                        className="w-full text-xs text-foreground file:mr-4 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                                                    />
                                                                    <div className="text-center text-xs text-gray-400 font-medium">- OR -</div>
                                                                    <button
                                                                        onClick={() => {
                                                                            setCurrentCardIndex(index);
                                                                            setIsGalleryOpen(true);
                                                                        }}
                                                                        className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                                                    >
                                                                        <ImageIcon className="w-4 h-4" />
                                                                        Select from Media Gallery
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <InputField
                                                                    label="Button Text *"
                                                                    value={card.button.text}
                                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCardChange(index, 'button.text', e.target.value)}
                                                                    placeholder="Button text"
                                                                />
                                                                <InputField
                                                                    label="Button URL *"
                                                                    value={card.button.url}
                                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCardChange(index, 'button.url', e.target.value)}
                                                                    placeholder="Button URL"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* RIGHT: Preview */}
                                <div className="bg-gray-50 dark:bg-gray-950 p-6 overflow-y-auto border-l border-gray-200 dark:border-gray-800">
                                    <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        <Eye className="w-4 h-4" />
                                        WhatsApp Preview
                                    </div>

                                    <div className="mx-auto max-w-[340px] bg-white dark:bg-gray-900 rounded-[30px] border-[6px] border-gray-300 dark:border-gray-700 shadow-2xl overflow-hidden relative">
                                        {/* Notch/Status Bar Area */}
                                        <div className="h-6 bg-gray-800 flex items-center justify-center">
                                            <div className="w-16 h-3 bg-black rounded-b-xl"></div>
                                        </div>

                                        {/* Header */}
                                        <div className="bg-[#008069] dark:bg-[#202c33] text-white p-3 flex items-center gap-3 shadow-md z-10 relative">
                                            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                                                <ShoppingBag className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="font-semibold text-sm">Your Business</div>
                                                <div className="text-[10px] opacity-80">Business Account</div>
                                            </div>
                                        </div>

                                        {/* Chat Area */}
                                        <div className="bg-[#efeae2] dark:bg-[#0b141a] p-3 min-h-[400px] relative">
                                            <div className="bg-white dark:bg-[#202c33] rounded-lg shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] overflow-hidden max-w-[90%] mb-2 rounded-tl-none">
                                                {/* Standard: Header */}
                                                {templateType === 'standard' && headerType !== 'TEXT' && headerPreview && (
                                                    <div className="p-1 pb-0">
                                                        <img src={headerPreview} alt="Header" className="w-full h-36 object-cover rounded-md" />
                                                    </div>
                                                )}
                                                {templateType === 'standard' && headerType === 'TEXT' && headerText && (
                                                    <div className="px-3 pt-2 pb-0 font-bold text-sm text-[#111b21] dark:text-[#e9edef]">{headerText}</div>
                                                )}

                                                {/* Body */}
                                                {bodyText && <div className="px-3 py-2 text-sm text-[#111b21] dark:text-[#e9edef] whitespace-pre-wrap">{bodyText}</div>}

                                                {/* Catalog: Products */}
                                                {templateType === 'catalog' && catalogProducts.filter(p => p.trim()).length > 0 && (
                                                    <div className="px-3 py-2">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {catalogProducts.filter(p => p.trim()).slice(0, 4).map((product, idx) => (
                                                                <div key={idx} className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg relative overflow-hidden group">
                                                                    <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-800">
                                                                        <ShoppingBag className="w-6 h-6 text-gray-400" />
                                                                    </div>
                                                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 backdrop-blur-[2px]">
                                                                        <div className="text-[10px] text-white truncate font-medium text-center">{product}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="text-center mt-2 text-[10px] text-gray-500 dark:text-gray-400 font-medium tracking-wide uppercase">
                                                            {catalogProducts.filter(p => p.trim()).length} Items
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Carousel: Cards Preview */}
                                                {templateType === 'carousel' && (
                                                    <div className="px-2 py-2 space-y-2">
                                                        {carouselCards.slice(0, 3).map((card, idx) => (
                                                            <div key={idx} className="bg-white dark:bg-[#1f2c34] border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
                                                                {card.imagePreview && (
                                                                    <div className="h-24 bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                                                                        <img src={card.imagePreview} alt="" className="w-full h-full object-cover" />
                                                                    </div>
                                                                )}
                                                                <div className="p-2">
                                                                    {card.title && <div className="text-sm font-semibold text-[#111b21] dark:text-[#e9edef]">{card.title}</div>}
                                                                    {card.subtitle && <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{card.subtitle}</div>}
                                                                    {card.button.text && (
                                                                        <div className="mt-2 w-full py-1.5 text-center text-[#00A884] font-medium text-xs hover:bg-gray-50 dark:hover:bg-white/5 rounded transition-colors border-t border-gray-100 dark:border-gray-700">
                                                                            {card.button.text}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Footer */}
                                                {footerText && <div className="px-3 pb-2 text-[10px] text-gray-400 dark:text-gray-500">{footerText}</div>}

                                                {/* Buttons Section */}
                                                {(templateType === 'catalog' || (templateType === 'standard' && buttons.length > 0)) && (
                                                    <div className="border-t border-gray-100 dark:border-[#2a3942]">
                                                        {templateType === 'catalog' && (
                                                            <button className="w-full py-2.5 text-[#008069] font-medium text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-[#2a3942] last:border-0">
                                                                View Catalog
                                                            </button>
                                                        )}
                                                        {buttons.map((btn, index) => (
                                                            <button key={index} className="w-full py-2.5 text-[#008069] font-medium text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-[#2a3942] last:border-0 flex items-center justify-center gap-2">
                                                                {btn.type === 'PHONE_NUMBER' && <span>📞</span>}
                                                                {btn.type === 'URL' && <span>🔗</span>}
                                                                {btn.text}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="px-3 pb-1 text-right text-[10px] text-gray-400 dark:text-gray-500">
                                                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-6 flex gap-3 justify-end flex-shrink-0">
                                <button
                                    onClick={onClose}
                                    className="px-6 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className="px-6 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white font-medium flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <LoadingSpinner />
                                            Creating...
                                        </>
                                    ) : (
                                        'Create Template'
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </>
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

/* ================= HELPER COMPONENTS ================= */

function LoadingSpinner() {
    return (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    );
}

function InputField({ label, ...props }: any) {
    return (
        <div className="space-y-1.5">
            {label && <label className="text-xs font-medium text-foreground/80">{label}</label>}
            <input
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-foreground placeholder:text-muted-foreground"
                {...props}
            />
        </div>
    );
}

function TextAreaField({ label, ...props }: any) {
    return (
        <div className="space-y-1.5">
            {label && <label className="text-xs font-medium text-foreground/80">{label}</label>}
            <textarea
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none min-h-[80px] resize-none text-foreground placeholder:text-muted-foreground"
                {...props}
            />
        </div>
    );
}
