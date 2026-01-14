"use client";

import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ImageIcon, X, Zap, Check, Filter } from "lucide-react";
import type { Category, WhatsAppRecipient, GalleryImage } from "@/lib/types";

const ImageSkeleton = () => (
  <div className="h-[120px] rounded-lg bg-gradient-to-br from-muted to-secondary animate-pulse" />
);

export default function CreateImageCampaignModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null
  );
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<
    number | null
  >(null);
  const [page, setPage] = useState(1);
  const [hasMoreImages, setHasMoreImages] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [contacts, setContacts] = useState<WhatsAppRecipient[]>([]);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [selectedRecipients, setSelectedRecipients] = useState<Set<number>>(
    new Set()
  );
  const isFetchingRef = useRef(false);

  const [recipientCategoryId, setRecipientCategoryId] = useState<number | null>(
    null
  );
  const [recipientSubcategoryId, setRecipientSubcategoryId] = useState<
    number | null
  >(null);

  const [campaignName, setCampaignName] = useState("");
  const [loadingImages, setLoadingImages] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    api
      .get<{ data: Category[] }>("/categories")
      .then((res) => {
        setCategories(res.data.data);
      })
      .catch(console.error);
  }, [isOpen]);

  const fetchRecipients = async (
    categoryId?: number | null,
    subcategoryId?: number | null
  ) => {
    const res = await api.get("/recipients/session-active", {
      params: {
        categoryId: categoryId ?? undefined,
        subcategoryId: subcategoryId ?? undefined,
      },
    });

    // IMPORTANT: this returns contacts WITH conversationId
    setContacts(res.data.data);
  };

  useEffect(() => {
    fetchRecipients(recipientCategoryId, recipientSubcategoryId);
  }, [recipientCategoryId, recipientSubcategoryId]);

  const handleRecipientCategoryChange = (categoryId: number | null) => {
    setRecipientCategoryId(categoryId);
    setRecipientSubcategoryId(null);
    setSelectedRecipients(new Set());
  };

  const handleRecipientSubcategoryChange = (subcategoryId: number | null) => {
    setRecipientSubcategoryId(subcategoryId);
    setSelectedRecipients(new Set());
  };

  useEffect(() => {
    if (!isOpen) {
      setSelectedCategoryId(null);
      setSelectedSubcategoryId(null);
      setImages([]);
      setContacts([]);
      setSelectedImages(new Set());
      setSelectedRecipients(new Set());
      setCampaignName("");
      setRecipientCategoryId(null);
      setRecipientSubcategoryId(null);
    }
  }, [isOpen]);

  const fetchImages = async (pageNumber: number, reset = false) => {
    if (!selectedCategoryId || isFetchingRef.current || !hasMoreImages) return;

    isFetchingRef.current = true;
    setLoadingImages(true);

    try {
      const res = await api.get<{ data: { images: GalleryImage[] } }>(
        "/gallery",
        {
          params: {
            category_id: selectedCategoryId,
            subcategory_id: selectedSubcategoryId || undefined,
            limit: 12,
            page: pageNumber,
          },
        }
      );

      const newImages = res.data.data.images;

      setImages((prev) => (reset ? newImages : [...prev, ...newImages]));

      if (newImages.length < 12) {
        setHasMoreImages(false);
      }
    } finally {
      setLoadingImages(false);
      isFetchingRef.current = false;
    }
  };

  const handleCategoryChange = (categoryId: number) => {
    setSelectedCategoryId(categoryId);
    setSelectedSubcategoryId(null);
    setImages([]);
    setPage(1);
    setHasMoreImages(true);
    fetchImages(1, true);
  };

  const handleSubcategoryChange = (subcategoryId: number | null) => {
    setSelectedSubcategoryId(subcategoryId);
    setImages([]);
    setPage(1);
    setHasMoreImages(true);
    fetchImages(1, true);
  };

  useEffect(() => {
    if (!selectedCategoryId) return;
    fetchImages(page, page === 1);
  }, [page, selectedCategoryId, selectedSubcategoryId]);

  useEffect(() => {
    if (!loadMoreRef.current || !hasMoreImages) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingImages) {
          setPage((prev) => prev + 1);
        }
      },
      { rootMargin: "100px" }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMoreImages, loadingImages]);

  const handleSelectAll = () => {
    if (selectedImages.size === images.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(images.map((img) => img.id)));
    }
  };

  const handleToggleImage = (id: number) => {
    const newSelected = new Set(selectedImages);
    newSelected.has(id) ? newSelected.delete(id) : newSelected.add(id);
    setSelectedImages(newSelected);
  };

  const handleToggleRecipient = (id: number) => {
    const newSelected = new Set(selectedRecipients);
    newSelected.has(id) ? newSelected.delete(id) : newSelected.add(id);
    setSelectedRecipients(newSelected);
  };

  const handleLaunch = async () => {
    if (!campaignName.trim()) return alert("Campaign name required");
    if (selectedRecipients.size === 0) return alert("Select recipients");
    if (!selectedCategoryId) return alert("Select image category");

    try {
      // Convert selected contacts → conversationIds
      const conversationIds = contacts
        .filter((c) => selectedRecipients.has(c.id))
        .map((c) => c.conversationId)
        .filter(Boolean);

      if (conversationIds.length === 0) {
        alert("No valid WhatsApp sessions found");
        return;
      }

      await api.post("/campaign/image", {
        name: campaignName,
        categoryId: selectedCategoryId,
        subCategoryId: selectedSubcategoryId,
        captionMode: "TITLE",
        imageLimit: selectedImages.size,
        conversationIds,
      });

      alert("Campaign created successfully 🚀");
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to create campaign");
    }
  };

  if (!isOpen) return null;

  const canLaunch =
    selectedImages.size > 0 &&
    campaignName.trim() &&
    selectedRecipients.size > 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-6xl"
      >
        <div className="bg-card rounded-2xl border border-border max-h-[80vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-card/80 p-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                Create Image Campaign
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Select images and configure your campaign
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-input"
              aria-label="Close modal"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
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

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                      Category
                    </label>
                    <select
                      value={selectedCategoryId ?? ""}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (!value) return;
                        handleCategoryChange(value);
                      }}
                      className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all hover:border-border"
                    >
                      <option value="">Select category</option>
                      {categories.map((cat) => (
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
                      disabled={!selectedCategoryId}
                      value={selectedSubcategoryId ?? ""}
                      onChange={(e) =>
                        handleSubcategoryChange(
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:border-border"
                    >
                      <option value="">All subcategories</option>
                      {categories
                        .find((c) => c.id === selectedCategoryId)
                        ?.subcategories?.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Image Grid Section */}
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Images <span className="text-red-400">*</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedImages.size} selected
                    </p>
                  </div>
                  {images.length > 0 && (
                    <button
                      onClick={handleSelectAll}
                      className="text-xs px-3 py-1.5 rounded-md bg-input hover:bg-secondary transition text-foreground font-medium border border-border hover:border-border"
                    >
                      {selectedImages.size === images.length
                        ? "Clear All"
                        : "Select All"}
                    </button>
                  )}
                </div>

                {/* Image Grid */}
                {!selectedCategoryId ? (
                  <div className="flex items-center justify-center flex-1">
                    <div className="text-center">
                      <ImageIcon className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Select a category to view images
                      </p>
                    </div>
                  </div>
                ) : loadingImages && images.length === 0 ? (
                  <div className="col-span-4 flex justify-center py-4 text-muted-foreground text-xs">
                    Loading more…
                  </div>
                ) : images.length === 0 ? (
                  <div className="flex items-center justify-center flex-1">
                    <p className="text-sm text-muted-foreground">
                      No images found
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-3 auto-rows-[120px] overflow-y-auto pr-2 flex-1">
                    {images.map((image) => (
                      <motion.div
                        key={image.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleToggleImage(image.id)}
                        className={`relative overflow-hidden rounded-lg cursor-pointer transition-all border-2 group ${
                          selectedImages.has(image.id)
                            ? "border-primary ring-2 ring-primary/30 shadow-lg shadow-primary/20"
                            : "border-border hover:border-primary/50 hover:shadow-md hover:shadow-primary/10"
                        }`}
                      >
                        <Image
                          src={image.image_url || "/placeholder.svg"}
                          alt={image.title || "Gallery image"}
                          fill
                          sizes="15vw"
                          className="object-cover group-hover:brightness-110 transition-all"
                          priority={false}
                        />

                        <AnimatePresence>
                          {selectedImages.has(image.id) && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 bg-primary/20 backdrop-blur-[2px] flex items-center justify-center"
                            >
                              <div className="bg-primary rounded-full p-2 shadow-lg shadow-primary/50">
                                <Check className="w-4 h-4 text-foreground" />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                    {hasMoreImages && (
                      <div ref={loadMoreRef} className="col-span-4 h-8" />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: Campaign Details */}
            <div className="w-full lg:w-96 overflow-auto p-6 bg-card flex flex-col space-y-6">
              {/* Campaign Name */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                  Campaign Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Summer Sale 2024"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all"
                />
              </div>

              {/* Recipients Section */}
              <div className="space-y-3 flex-1 flex flex-col">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-3">
                    Filter Recipients
                  </label>
                  <select
                    value={recipientCategoryId ?? ""}
                    onChange={(e) =>
                      handleRecipientCategoryChange(
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm"
                  >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={recipientSubcategoryId ?? ""}
                    disabled={!recipientCategoryId}
                    onChange={(e) =>
                      handleRecipientSubcategoryChange(
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  >
                    <option value="">All Subcategories</option>
                    {categories
                      .find((c) => c.id === recipientCategoryId)
                      ?.subcategories?.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Recipients List */}
                <div className="flex-1 flex flex-col">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                    Recipients <span className="text-red-400">*</span>
                  </label>
                  <div className="border border-border rounded-lg overflow-hidden flex-1 overflow-y-auto bg-input/30 divide-y divide-border">
                    {contacts.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground text-sm">
                        No contacts found
                      </div>
                    ) : (
                      contacts.map((contact) => (
                        <motion.div
                          key={contact.id}
                          whileHover={{
                            backgroundColor: "rgba(71, 85, 105, 0.3)",
                          }}
                          onClick={() => handleToggleRecipient(contact.id)}
                          className="flex items-center gap-3 p-3 cursor-pointer transition-colors"
                        >
                          <div
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                              selectedRecipients.has(contact.id)
                                ? "bg-primary border-primary"
                                : "border-primary hover:border-primary"
                            }`}
                          >
                            {selectedRecipients.has(contact.id) && (
                              <Check className="w-2.5 h-2.5 text-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {contact.company_name || contact.mobile_number}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {contact.category_name} •{" "}
                              {contact.sub_category_name || "—"}
                            </p>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="p-4 bg-secondary border border-border rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                      Images
                    </p>
                    <p className="text-2xl font-bold text-primary mt-1">
                      {selectedImages.size}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                      Recipients
                    </p>
                    <p className="text-2xl font-bold text-primary mt-1">
                      {selectedRecipients.size}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div
            className="border-t border-border p-6 flex gap-3 justify-end flex-shrink-0 bg-card/80
"
          >
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-lg bg-secondary hover:bg-primary/90 hover:text-primary-foreground text-secondary-foreground text-sm font-medium border border-border hover:border-border transition-all"
            >
              Cancel
            </button>
            <motion.button
              whileHover={{ scale: canLaunch ? 1.02 : 1 }}
              whileTap={{ scale: canLaunch ? 0.98 : 1 }}
              onClick={handleLaunch}
              disabled={!canLaunch}
              className={`px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                canLaunch
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/50"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              <Zap className="w-4 h-4" />
              Launch Campaign
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
