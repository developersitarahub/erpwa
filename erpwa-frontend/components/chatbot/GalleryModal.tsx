"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Upload,
  Image as ImageIcon,
  Search,
  Check,
  Loader2,
} from "lucide-react";
import Image from "next/image";
import ReactDOM from "react-dom";
import { galleryAPI } from "@/lib/galleryApi";
import { categoriesAPI } from "@/lib/categoriesApi";
import api from "@/lib/api";

interface GalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string | string[]) => void;
  multiSelect?: boolean;
}

export default function GalleryModal({
  isOpen,
  onClose,
  onSelect,
  multiSelect = false,
}: GalleryModalProps) {
  const [images, setImages] = useState<any[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Category State
  const [categories, setCategories] = useState<any[]>([]); // Using any for simplicity, should be Category[]
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState<number | null>(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      loadCategories();
      fetchImages();
      setSelectedUrls([]);
    }
  }, [isOpen]);

  // Refetch images when filters change
  useEffect(() => {
    if (isOpen) {
      fetchImages();
    }
  }, [selectedCategory, selectedSubcategory]);

  const loadCategories = async () => {
    try {
      const res = await categoriesAPI.list();
      setCategories(res.data || []);
    } catch (error) {
      console.error("Failed to load categories", error);
    }
  };

  const loadSubcategories = async (categoryId: number) => {
    try {
      const res = await categoriesAPI.detail(categoryId);
      setSubcategories(res.data.subcategories || []);
    } catch (error) {
      console.error("Failed to load subcategories", error);
      setSubcategories([]);
    }
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const catId = e.target.value ? parseInt(e.target.value) : null;
    setSelectedCategory(catId);
    setSelectedSubcategory(null);
    setSubcategories([]);

    if (catId) {
      loadSubcategories(catId);
    }
  };

  const fetchImages = async () => {
    try {
      setLoading(true);
      // Pass category filters to API
      const res = await galleryAPI.list(
        selectedCategory || undefined,
        selectedSubcategory || undefined
      );
      setImages(res.data?.images || []);
    } catch (error) {
      console.error("Failed to fetch images", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      // If category selected, append it
      if (selectedCategory) formData.append("category_id", selectedCategory.toString());
      if (selectedSubcategory) formData.append("subcategory_id", selectedSubcategory.toString());

      // Use galleryAPI to upload if available, or generic
      // galleryAPI.upload usually handles this
      await galleryAPI.upload(formData); // Using galleryAPI wrapper instead of raw api request

      // Refresh list
      await fetchImages();
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setUploading(false);
    }
  };

  const toggleSelection = (url: string) => {
    if (multiSelect) {
      setSelectedUrls((prev) =>
        prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url],
      );
    } else {
      onSelect(url);
    }
  };

  const handleConfirm = () => {
    onSelect(multiSelect ? selectedUrls : selectedUrls[0]);
  };

  if (!isOpen || !mounted) return null;

  // Client-side filtering for search query only (API handles categories)
  const filteredImages = images.filter((img) =>
    (img.url || img.s3_url || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <ImageIcon className="text-blue-600" />
            Media Gallery
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 flex flex-col md:flex-row gap-4">

          {/* Filters */}
          <div className="flex gap-2 w-full md:w-auto">
            <select
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
              value={selectedCategory || ""}
              onChange={handleCategoryChange}
            >
              <option value="">All Categories</option>
              {categories.map((cat: any) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <select
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
              value={selectedSubcategory || ""}
              onChange={(e) => setSelectedSubcategory(e.target.value ? parseInt(e.target.value) : null)}
              disabled={!selectedCategory || subcategories.length === 0}
            >
              <option value="">All Subcategories</option>
              {subcategories.map((sub: any) => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>

          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-2.5 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search images..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-700 dark:text-gray-200"
            />
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 transition disabled:opacity-50 font-medium text-sm whitespace-nowrap"
          >
            {uploading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Upload size={18} />
            )}
            Upload Image
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleUpload}
          />
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 dark:bg-gray-900/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="animate-spin text-blue-500 mb-2" size={40} />
              <p className="text-gray-500 text-sm">Loading media...</p>
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <ImageIcon size={48} className="mb-2 opacity-20" />
              <p>No images found in this category.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredImages.map((img, idx) => {
                const url = img.s3_url || img.url;
                if (!url) return null; // Skip invalid images

                const isSelected = selectedUrls.includes(url);
                return (
                  <div
                    key={img.id || idx}
                    onClick={() => toggleSelection(url)}
                    className={`group relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all shadow-sm ${isSelected
                      ? "border-blue-500 ring-2 ring-blue-500/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-400"
                      }`}
                  >
                    <Image
                      src={url}
                      className="object-cover transition-transform group-hover:scale-105"
                      alt={img.title || "Gallery Image"}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />

                    {/* Overlay Gradient */}
                    <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 ${isSelected ? 'opacity-100' : ''}`}>
                      {img.title && <p className="text-white text-xs font-medium truncate">{img.title}</p>}
                    </div>

                    {isSelected && (
                      <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1 shadow-sm z-10">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {multiSelect && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white dark:bg-gray-900">
            <span className="text-sm text-gray-500 font-medium">
              {selectedUrls.length} selected
            </span>
            <button
              onClick={handleConfirm}
              disabled={selectedUrls.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Insert Selected
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
