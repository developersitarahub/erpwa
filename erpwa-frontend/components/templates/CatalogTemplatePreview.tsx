"use client";

import { ShoppingBag, ExternalLink } from "lucide-react";

/**
 * Visual Preview Component for Catalog Templates
 * Shows how the template will appear in WhatsApp
 */

interface Product {
    id: string;
    name: string;
    image: string;
    price?: string;
}

interface CatalogTemplatePreviewProps {
    bodyText: string;
    footerText?: string;
    products: Product[];
}

export default function CatalogTemplatePreview({
    bodyText,
    footerText,
    products = [],
}: CatalogTemplatePreviewProps) {
    return (
        <div className="max-w-md mx-auto">
            {/* Phone Frame */}
            <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-3xl shadow-2xl">
                <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden">
                    {/* WhatsApp Header (Preview) */}
                    <div className="bg-[#075E54] text-white p-3 flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                            <ShoppingBag className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="font-semibold">Your Business</div>
                            <div className="text-xs opacity-80">Catalog Message</div>
                        </div>
                    </div>

                    {/* Message Bubble */}
                    <div className="p-4 bg-[#E5DDD5] dark:bg-gray-900">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden max-w-sm">
                            {/* Body Text */}
                            <div className="p-4 pb-2">
                                <p className="text-sm text-gray-900 dark:text-white">
                                    {bodyText || "Check out our featured products!"}
                                </p>
                            </div>

                            {/* Product Grid */}
                            <div className="px-4 py-2">
                                <div className="grid grid-cols-3 gap-2">
                                    {products.slice(0, 30).map((product, index) => (
                                        <div
                                            key={product.id}
                                            className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden relative group"
                                        >
                                            {product.image ? (
                                                <img
                                                    src={product.image}
                                                    alt={product.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <ShoppingBag className="w-6 h-6 text-gray-400" />
                                                </div>
                                            )}
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1">
                                                <div className="text-xs text-white font-medium truncate">
                                                    {product.name || `Product ${index + 1}`}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Product Count */}
                                <div className="text-center mt-2 text-xs text-gray-600 dark:text-gray-400">
                                    {products.length} product{products.length !== 1 ? 's' : ''}
                                </div>
                            </div>

                            {/* Footer Text */}
                            {footerText && (
                                <div className="px-4 pb-2">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {footerText}
                                    </p>
                                </div>
                            )}

                            {/* View Catalog Button (WhatsApp style) */}
                            <div className="border-t border-gray-200 dark:border-gray-700">
                                <button className="w-full py-3 text-[#00A884] font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                    <ShoppingBag className="w-4 h-4" />
                                    View Catalog
                                    <ExternalLink className="w-3 h-3" />
                                </button>
                            </div>

                            {/* Timestamp */}
                            <div className="px-4 pb-2 text-right">
                                <span className="text-xs text-gray-400">
                                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Badge */}
            <div className="mt-4 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-full">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        WhatsApp Catalog Preview
                    </span>
                </div>
            </div>
        </div>
    );
}

// Example Usage Component
export function CatalogTemplateExample() {
    const sampleProducts = [
        {
            id: "1",
            name: "Sheet Pan Dinner",
            image: "/examples/sheet-pan-dinner.jpg",
            price: "$12.99",
        },
        {
            id: "2",
            name: "Salad Bowl",
            image: "/examples/salad-bowl.jpg",
            price: "$9.99",
        },
        {
            id: "3",
            name: "Protein Smoothie",
            image: "/examples/smoothie.jpg",
            price: "$7.99",
        },
        {
            id: "4",
            name: "Breakfast Burrito",
            image: "/examples/burrito.jpg",
            price: "$8.99",
        },
        {
            id: "5",
            name: "Buddha Bowl",
            image: "/examples/buddha-bowl.jpg",
            price: "$11.99",
        },
        {
            id: "6",
            name: "Pasta Primavera",
            image: "/examples/pasta.jpg",
            price: "$10.99",
        },
    ];

    return (
        <div className="p-8">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                        Multi-Product Catalog Template
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Send up to 30 products in a single WhatsApp message
                    </p>
                </div>

                <CatalogTemplatePreview
                    bodyText="Check out our healthy meal collection! Fresh, delicious, and ready in minutes. 🥗"
                    footerText="Reply to order or visit our catalog"
                    products={sampleProducts}
                />

                {/* Features */}
                <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center mb-4">
                            <ShoppingBag className="w-6 h-6 text-blue-600" />
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                            Up to 30 Products
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Showcase multiple products from your catalog in one message
                        </p>
                    </div>

                    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-xl flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                            Meta Approved
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            All templates go through Meta's approval process
                        </p>
                    </div>

                    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-xl flex items-center justify-center mb-4">
                            <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                            Interactive
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Customers can browse and inquire about products directly
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
