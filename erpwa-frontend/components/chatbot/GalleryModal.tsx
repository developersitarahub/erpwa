"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Upload,
  Image as ImageIcon,
  Search,
  Check,
  Loader2,
  Filter,
} from "lucide-react";
import Image from "next/image";
import ReactDOM from "react-dom";
import { galleryAPI } from "@/lib/galleryApi";
import { categoriesAPI } from "@/lib/categoriesApi"; // ✅ Import categories API
import api from "@/lib/api";
import { processMedia } from "@/lib/mediaProcessor";
import { toast } from "react-toastify";
import type { Category } from "@/lib/types"; // Assuming types exist

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

  // 🔹 Filter & Pagination State
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<number | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      loadCategories(); // ✅ Load categories on open
      setSelectedUrls([]);
      setPage(1);
      setImages([]); // Reset images to avoid stale data
      fetchImages(1, true); // Initial fetch
    }
  }, [isOpen]);

  // Fetches categories for the filter dropdown
  const loadCategories = async () => {
    try {
      const res = await categoriesAPI.list();
      setCategories(res.data || []);
    } catch (err) {
      console.error("Failed to load categories", err);
    }
  };

  // Fetches images with filters & pagination
  const fetchImages = async (
    pageNo: number,
    reset = false,
    catId?: number | null,
    subCatId?: number | null,
  ) => {
    try {
      setLoading(true);
      const res = await galleryAPI.list(
        catId ?? selectedCategory ?? undefined,
        subCatId ?? selectedSubcategory ?? undefined,
        pageNo,
        20, // Limit
      );

      const newImages = res.data?.images || [];
      if (reset) {
        setImages(newImages);
      } else {
        setImages((prev) => [...prev, ...newImages]);
      }
      setHasMore(newImages.length === 20); // Assume limit is 20
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
      const { file: processedFile } = await processMedia(file);

      const formData = new FormData();
      formData.append("images", processedFile); // Backend expects 'images'

      if (selectedCategory)
        formData.append("category_id", selectedCategory.toString());
      if (selectedSubcategory)
        formData.append("subcategory_id", selectedSubcategory.toString());

      const res = await galleryAPI.upload(formData, true);

      toast.success("Image uploaded successfully!");
      if (fileInputRef.current) fileInputRef.current.value = "";

      // 🔥 Auto-select and close for single-select mode
      const uploadedImage = res.data?.images?.[0];
      const imageUrl = uploadedImage?.url || uploadedImage?.s3_url;

      if (imageUrl && !multiSelect) {
        onSelect(imageUrl);
        onClose();
        return;
      }

      setPage(1);
      fetchImages(1, true);
    } catch (error: any) {
      console.error("Upload failed", error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || "Failed to upload image.";
      toast.error(errorMsg);
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

  // Handle Filter Changes
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const catId = e.target.value ? Number(e.target.value) : null;
    setSelectedCategory(catId);
    setSelectedSubcategory(null); // Reset subcategory
    setPage(1);

    // Update subcategories list
    if (catId) {
      const cat = categories.find((c) => c.id === catId);
      setSubcategories(cat?.subcategories || []);
    } else {
      setSubcategories([]);
    }

    fetchImages(1, true, catId, null);
  };

  const handleSubcategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const subId = e.target.value ? Number(e.target.value) : null;
    setSelectedSubcategory(subId);
    setPage(1);
    fetchImages(1, true, selectedCategory, subId);
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchImages(nextPage, false);
    }
  };

  if (!isOpen || !mounted) return null;

  // Local search Filter (applied on top of fetched images)
  const filteredImages = images.filter((img) =>
    (img.url || img.s3_url || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-card rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-transparent dark:border-border">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-border flex items-center justify-between bg-white dark:bg-card">
          <h2 className="text-xl font-bold text-gray-800 dark:text-foreground flex items-center gap-2">
            <ImageIcon className="text-primary" />
            Media Gallery
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-muted-foreground dark:hover:text-foreground p-1 hover:bg-gray-100 dark:hover:bg-muted/50 rounded-full transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Toolbar with Filters */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-muted/30 border-b border-gray-100 dark:border-border flex flex-wrap gap-4 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search
              className="absolute left-3 top-2.5 text-gray-400 dark:text-muted-foreground"
              size={18}
            />
            <input
              type="text"
              placeholder="Search loaded images..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-border text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white dark:bg-background dark:text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 min-w-[150px]">
            <Filter size={16} className="text-gray-500 dark:text-muted-foreground" />
            <select
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-border text-sm focus:ring-2 focus:ring-primary outline-none bg-white dark:bg-background dark:text-foreground w-full"
              value={selectedCategory || ""}
              onChange={handleCategoryChange}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategory Filter */}
          {subcategories.length > 0 && (
            <div className="min-w-[150px]">
              <select
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-border text-sm focus:ring-2 focus:ring-primary outline-none bg-white dark:bg-background dark:text-foreground w-full"
                value={selectedSubcategory || ""}
                onChange={handleSubcategoryChange}
              >
                <option value="">All Subcategories</option>
                {subcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2 hover:bg-primary/90 transition disabled:opacity-50 shadow-sm"
          >
            {uploading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Upload size={18} />
            )}
            Upload from Device
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
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-muted-foreground/20 dark:scrollbar-track-muted/10 bg-white dark:bg-card">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredImages.map((img, idx) => {
              const isSelected = selectedUrls.includes(img.url);
              return (
                <div
                  key={idx}
                  onClick={() => toggleSelection(img.url)}
                  className={`group relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${isSelected
                    ? "border-primary ring-2 ring-primary/20 scale-[0.98]"
                    : "border-gray-100 dark:border-border hover:border-gray-300 dark:hover:border-foreground/20 hover:shadow-md"
                    }`}
                >
                  <Image
                    src={img.url}
                    className="object-cover"
                    alt="Gallery Image"
                    fill
                    sizes="(max-width: 768px) 50vw, 20vw"
                  />
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1.5 shadow-sm z-10">
                      <Check size={14} strokeWidth={3} />
                    </div>
                  )}
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  {/* Title Preview on Hover */}
                  {img.title && (
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/60 text-white text-xs truncate opacity-0 group-hover:opacity-100 transition-opacity">
                      {img.title}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Loading State or Empty */}
          {loading && (
            <div className="flex justify-center py-10 w-full">
              <Loader2 className="animate-spin text-primary" size={40} />
            </div>
          )}

          {!loading && filteredImages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 dark:text-muted-foreground">
              <ImageIcon size={48} className="mb-2 opacity-20" />
              <p>No images found</p>
            </div>
          )}

          {/* Load More Trigger */}
          {!loading && hasMore && filteredImages.length > 0 && (
            <div className="flex justify-center py-6">
              <button
                onClick={loadMore}
                className="px-6 py-2 bg-gray-100 dark:bg-muted dark:text-foreground hover:bg-gray-200 dark:hover:bg-muted/80 text-gray-700 rounded-full font-medium transition-colors"
              >
                Load More
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {multiSelect && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-border flex justify-between items-center bg-white dark:bg-card">
            <span className="text-sm text-gray-500 dark:text-muted-foreground font-medium">
              {selectedUrls.length} selected
            </span>
            <button
              onClick={handleConfirm}
              disabled={selectedUrls.length === 0}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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
