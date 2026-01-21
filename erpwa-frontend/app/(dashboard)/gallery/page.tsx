"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/card"
import { Badge } from "@/components/badge"
import { Select, SelectOption } from "@/components/select"
import { Input } from "@/components/input"
import { Plus, Edit2, Trash2, Upload, X, FileText, Check, Save, Search, Filter, FolderOpen, MoreVertical, LayoutGrid, List, CheckSquare, Square, Loader2, ImagesIcon, AlertTriangle, ArrowRight, Lock, ChevronDown, ChevronUp } from "lucide-react"
import { categoriesAPI } from "@/lib/categoriesApi"
import { galleryAPI } from "@/lib/galleryApi"
import type { Category, GalleryImage } from "@/lib/types"
import { toast } from "react-toastify"
import { processMedia } from "@/lib/mediaProcessor"

export default function GalleryPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<number | null>(null)
  const [images, setImages] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalImages, setTotalImages] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [sortBy, setSortBy] = useState<string>("createdAt")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [filterBy, setFilterBy] = useState<string>("")
  const [isImagesExpanded, setIsImagesExpanded] = useState(false)

  // Upload form states
  const [uploadForm, setUploadForm] = useState({
    category_id: "",
    subcategory_id: "",
  })
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [uploadSubcategories, setUploadSubcategories] = useState<Category[]>([])

  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingImage, setEditingImage] = useState<GalleryImage | null>(null)
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    price: "",
    price_currency: "USD",
  })

  // Bulk selection
  const [selectedImageIds, setSelectedImageIds] = useState<number[]>([])

  // Confirmation Modal State
  const [deleteConf, setDeleteConf] = useState<{
    isOpen: boolean;
    type: 'single' | 'bulk';
    id?: number;
    title?: string;
    count?: number;
  }>({ isOpen: false, type: 'single' });

  // Upload State
  // Batch Type
  interface UploadBatch {
    id: string
    files: { file: File; status: "pending" | "processing" | "success" | "error"; error?: string }[]
    categoryId: string
    subcategoryId: string
    categoryName: string
    subcategoryName: string // Added to store name instead of ID
    status: "pending" | "processing" | "completed" | "partial_error"
    progress: number // 0-100 batch completion
    processedCount: number
    totalCount: number
    successCount: number
    failedCount: number
  }

  // Upload Queue State (now Batches)
  const [uploadBatches, setUploadBatches] = useState<UploadBatch[]>([])
  const isProcessing = useRef(false)

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    // Load images whenever filters change, including when filters are cleared
    setCurrentPage(1)
    loadImages(1, false)
  }, [selectedCategory, selectedSubcategory, sortBy, sortOrder, itemsPerPage, filterBy])

  const loadCategories = async () => {
    try {
      const response = await categoriesAPI.list()
      setCategories(response.data || [])
    } catch (error: any) {
      toast.error("Failed to load categories")
    }
  }

  const loadImages = async (page: number = 1, append: boolean = false) => {
    try {
      if (!append) {
        setLoading(true)
      }
      const response = await galleryAPI.list(
        selectedCategory || undefined,
        selectedSubcategory || undefined,
        page,
        itemsPerPage,
        sortBy,
        sortOrder,
        filterBy,
        ""
      )
      const newImages = response.data?.images || []
      if (append) {
        setImages([...images, ...newImages])
      } else {
        setImages(newImages)
      }
      setHasMore(response.data?.hasMore || false)
      setTotalImages(response.data?.total || 0)
      setCurrentPage(page)
    } catch (error: any) {
      toast.error("Failed to load images")
    } finally {
      setLoading(false)
    }
  }

  const loadMoreImages = () => {
    if (hasMore && !loading) {
      loadImages(currentPage + 1, true)
    }
  }

  const loadSubcategories = async (categoryId: number) => {
    try {
      const response = await categoriesAPI.detail(categoryId)
      setUploadSubcategories(response.data.subcategories || [])
    } catch (error) {
      setUploadSubcategories([])
    }
  }

  const handleCategoryClick = async (categoryId: number) => {
    if (selectedCategory === categoryId) {
      setSelectedCategory(null)
      setSelectedSubcategory(null)
      return
    }

    setSelectedCategory(categoryId)
    setSelectedSubcategory(null)
    setIsImagesExpanded(true) // Auto-expand when category is clicked

    const response = await categoriesAPI.detail(categoryId)
    const category = categories.find((c) => c.id === categoryId)
    if (category) {
      category.subcategories = response.data.subcategories || []
      setCategories([...categories])
    }
  }

  const handleSubcategoryClick = (subcategoryId: number) => {
    if (selectedSubcategory === subcategoryId) {
      setSelectedSubcategory(null)
    } else {
      setSelectedSubcategory(subcategoryId)
    }
  }

  // Process Batches
  useEffect(() => {
    const processNextBatch = async () => {
      if (isProcessing.current) return

      // Find first pending batch
      const batchIndex = uploadBatches.findIndex((b) => b.status === "pending" || b.status === "processing")
      if (batchIndex === -1) return

      const batch = uploadBatches[batchIndex]
      // If batch is marked processing but we are here, it implies we are continuing (or recovering state, though local state is simpler)
      // Actually, we usually take 'pending'. 'processing' implies it's already running in a parallel loop, but our effect is simple sequential.
      // Let's assume we pick up where we left off or start new.

      // If the batch is already completed in state, skip (shouldn't happen with findIndex)
      if (batch.processedCount >= batch.totalCount && batch.files.every(f => f.status !== 'pending')) {
        // Just marks as completed if not
        if (batch.status !== 'completed' && batch.status !== 'partial_error') {
          setUploadBatches(prev => prev.map((b, i) => i === batchIndex ? { ...b, status: 'completed', progress: 100 } : b))
        }
        return
      }

      isProcessing.current = true

      // Mark batch processing if not already
      if (batch.status === "pending") {
        setUploadBatches((prev) =>
          prev.map((b, i) => (i === batchIndex ? { ...b, status: "processing" } : b))
        )
      }

      // Find next pending file in this batch
      const fileIndex = batch.files.findIndex(f => f.status === 'pending')
      if (fileIndex === -1) {
        // Batch done
        const isError = batch.failedCount > 0
        setUploadBatches(prev => prev.map((b, i) => i === batchIndex ? { ...b, status: isError ? 'partial_error' : 'completed', progress: 100 } : b))
        isProcessing.current = false
        return
      }

      const fileItem = batch.files[fileIndex]

      // Update file status to processing
      setUploadBatches(prev => prev.map((b, i) => {
        if (i !== batchIndex) return b
        const newFiles = [...b.files]
        newFiles[fileIndex] = { ...newFiles[fileIndex], status: 'processing' }
        return { ...b, files: newFiles }
      }))

      try {
        const { file: compressedFile } = await processMedia(fileItem.file)

        const formData = new FormData()
        formData.append("category_id", batch.categoryId)
        if (batch.subcategoryId) {
          formData.append("subcategory_id", batch.subcategoryId)
        }
        formData.append("images", compressedFile)

        const response = await galleryAPI.upload(formData)
        const success = response.data?.success !== false

        setUploadBatches(prev => prev.map((b, i) => {
          if (i !== batchIndex) return b
          const newFiles = [...b.files]
          newFiles[fileIndex] = { ...newFiles[fileIndex], status: success ? 'success' : 'error', error: success ? undefined : 'Upload rejected' }
          const newProcessed = b.processedCount + 1
          const newSuccess = b.successCount + (success ? 1 : 0)
          const newFailed = b.failedCount + (success ? 0 : 1)
          const newProgress = Math.round((newProcessed / b.totalCount) * 100)
          return {
            ...b,
            files: newFiles,
            processedCount: newProcessed,
            successCount: newSuccess,
            failedCount: newFailed,
            progress: newProgress
          }
        }))

        if (success) {
          loadImages(currentPage, false)
        }

      } catch (error: any) {
        setUploadBatches(prev => prev.map((b, i) => {
          if (i !== batchIndex) return b
          const newFiles = [...b.files]
          newFiles[fileIndex] = { ...newFiles[fileIndex], status: 'error', error: error.message || "Failed" }
          const newProcessed = b.processedCount + 1
          const newFailed = b.failedCount + 1
          const newProgress = Math.round((newProcessed / b.totalCount) * 100)
          return {
            ...b,
            files: newFiles,
            processedCount: newProcessed,
            failedCount: newFailed,
            progress: newProgress
          }
        }))
      } finally {
        // Recursive step or next loop
        isProcessing.current = false
        // Trigger next effect run
      }
    }

    processNextBatch()
  }, [uploadBatches, currentPage])

  const handleAddToQueue = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedImages.length || !uploadForm.category_id) {
      toast.error("Please select category and images")
      return
    }

    // Validation
    const validImages: File[] = []
    const invalidFiles: string[] = []

    selectedImages.forEach((file) => {
      if (!file.type.startsWith("image/")) {
        invalidFiles.push(file.name)
      } else {
        validImages.push(file)
      }
    })

    if (invalidFiles.length > 0) {
      toast.error(`Ignored ${invalidFiles.length} non-image file(s)`)
    }

    if (validImages.length === 0) return

    const selectedCat = categories.find(c => c.id.toString() === uploadForm.category_id)
    const categoryName = selectedCat?.name || "Unknown"

    // Find subcategory name
    const selectedSub = uploadSubcategories.find(s => s.id.toString() === uploadForm.subcategory_id)
    const subcategoryName = selectedSub?.name || (uploadForm.subcategory_id ? "Unknown Sub-cat" : "All")

    // Check if a batch with same destination is already active
    const isDuplicateBatch = uploadBatches.some(b =>
      (b.status === 'pending' || b.status === 'processing') &&
      b.categoryId === uploadForm.category_id &&
      b.subcategoryId === uploadForm.subcategory_id
    )

    if (isDuplicateBatch) {
      toast.warning("A batch is already processing for this destination. Please wait.")
      return
    }

    // Create a NEW BATCH
    const newBatch: UploadBatch = {
      id: Math.random().toString(36).substring(7),
      files: validImages.map(f => ({ file: f, status: 'pending' })),
      categoryId: uploadForm.category_id,
      subcategoryId: uploadForm.subcategory_id,
      categoryName,
      subcategoryName,
      status: "pending",
      progress: 0,
      processedCount: 0,
      totalCount: validImages.length,
      successCount: 0,
      failedCount: 0
    }

    setUploadBatches((prev) => [...prev, newBatch])

    setSelectedImages([])
    // Do NOT reset category/subcategory as requested
    toast.info(`Added batch of ${validImages.length} image(s) to queue`)
  }

  const clearCompleted = () => {
    setUploadBatches(prev => prev.filter(b => b.status === 'pending' || b.status === 'processing'))
  }

  const handleDeleteImage = (imageId: number, imageTitle: string) => {
    setDeleteConf({
      isOpen: true,
      type: 'single',
      id: imageId,
      title: imageTitle
    });
  }

  const handleBulkDelete = () => {
    if (selectedImageIds.length === 0) {
      toast.error("Please select images to delete")
      return
    }
    setDeleteConf({
      isOpen: true,
      type: 'bulk',
      count: selectedImageIds.length
    });
  }

  const handleConfirmDelete = async () => {
    try {
      if (deleteConf.type === 'single' && deleteConf.id) {
        await galleryAPI.delete([deleteConf.id])
        toast.success("Image deleted successfully!")
      } else if (deleteConf.type === 'bulk') {
        await galleryAPI.delete(selectedImageIds)
        toast.success(`Successfully deleted ${selectedImageIds.length} image(s)!`)
        setSelectedImageIds([])
      }

      setDeleteConf({ isOpen: false, type: 'single' });
      await loadImages(currentPage, false) // Reload current page
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to delete image(s)")
    }
  }

  const toggleSelectAll = () => {
    if (selectedImageIds.length === images.length && images.length > 0) {
      setSelectedImageIds([]);
    } else {
      setSelectedImageIds(images.map(img => img.id));
    }
  }

  const handleEditImage = (image: GalleryImage) => {
    setEditingImage(image)
    setEditForm({
      title: image.title || "",
      description: image.description || "",
      price: image.price?.toString() || "",
      price_currency: image.price_currency || "USD",
    })
    setShowEditModal(true)
  }

  const handleUpdateImage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingImage) return

    try {
      const formData = new FormData()
      formData.append("title", editForm.title.trim())
      formData.append("description", editForm.description.trim())
      if (editForm.price) {
        formData.append("price", editForm.price)
      }
      formData.append("price_currency", editForm.price_currency)

      const response = await galleryAPI.update(editingImage.id, formData)

      if (response.data?.success !== false) {
        toast.success("Image updated successfully!")
        setShowEditModal(false)
        setEditingImage(null)
        await loadImages(currentPage, false)
      } else {
        toast.error("Failed to update image")
      }
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Failed to update image"
      toast.error(errorMsg)
      console.error("Image update error:", error)
    }
  }

  const getImageUrl = (image: GalleryImage) => {
    return image.s3_url || image.url || image.image_url || image.image?.url || ""
  }

  const selectedCategoryData = categories.find((c) => c.id === selectedCategory)
  const subcategories = selectedCategoryData?.subcategories || []

  // Logic to lock queue if busy
  // No global lock anymore, we lock specifically per subcategory in logic
  const isGlobalLock = false // We disabled the UI lock to allow other subcat selections

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-foreground">Gallery Management</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload and manage images across categories
            </p>
          </div>
        </div>

        {/* Upload Section */}
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-4">
            <div className="grid grid-cols-[40%_60%] gap-0 relative">
              <h3 className="text-lg font-semibold text-foreground pr-6">
                Upload Images
              </h3>
              <h3 className="text-lg font-semibold text-foreground pl-6 border-l-[3px] border-border">
                Upload Status
              </h3>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-[40%_60%] gap-0">
              {/* Left Column (40%): Controls */}
              <div className="pr-6 space-y-4 flex flex-col">

                {/* Top Row: Category | Sub-Category */}
                <div className="flex gap-4">
                  <div className="w-1/2">
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Category</label>
                    <Select
                      value={uploadForm.category_id}
                      disabled={false}
                      onChange={(e) => {
                        setUploadForm({ ...uploadForm, category_id: e.target.value, subcategory_id: "" })
                        if (e.target.value) {
                          loadSubcategories(parseInt(e.target.value))
                        } else {
                          setUploadSubcategories([])
                        }
                      }}
                    >
                      <SelectOption value="">Select Category</SelectOption>
                      {categories.map((cat) => (
                        <SelectOption key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </SelectOption>
                      ))}
                    </Select>
                  </div>

                  <div className="w-1/2">
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                      Sub-Category
                    </label>
                    <Select
                      value={uploadForm.subcategory_id}
                      disabled={!uploadForm.category_id || uploadSubcategories.length === 0}
                      onChange={(e) =>
                        setUploadForm({ ...uploadForm, subcategory_id: e.target.value })
                      }
                    >
                      <SelectOption value="">All</SelectOption>
                      {uploadSubcategories.map((subcat) => (
                        <SelectOption key={subcat.id} value={subcat.id.toString()}>
                          {subcat.name}
                        </SelectOption>
                      ))}
                    </Select>
                  </div>
                </div>

                {/* Image Selection Area */}
                <div className="relative border-2 border-dashed border-border rounded-lg h-[200px] flex flex-col items-center justify-center hover:bg-secondary/20 transition-colors text-center">
                  <input
                    ref={(ref) => {
                      if (ref && selectedImages.length === 0) ref.value = "";
                    }}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || [])
                      if (files.length > 200) {
                        toast.error("Maximum 200 images allowed")
                        return
                      }
                      setSelectedImages(files)
                    }}
                    disabled={!uploadForm.category_id}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                  />

                  <div className="p-4 bg-secondary rounded-full mb-3">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {selectedImages.length > 0
                        ? `${selectedImages.length} images selected`
                        : "Upload Image"}
                    </p>
                    <p className="text-[10px] text-muted-foreground px-4">
                      {!uploadForm.category_id
                        ? "Select category first"
                        : "Drag & drop or click to upload"}
                    </p>
                  </div>
                </div>

                {/* Upload Button */}
                <Button
                  onClick={handleAddToQueue}
                  className="w-full bg-primary hover:bg-primary/90 h-10"
                  disabled={!uploadForm.category_id || selectedImages.length === 0}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Upload Image
                </Button>
              </div>

              {/* Right Column (60%): Queue Status */}
              <div className="pl-6 border-l-[3px] border-border flex flex-col">
                <div className="flex items-center justify-end pb-4 mb-4">
                  {uploadBatches.some(b => b.status === 'completed' || b.status === 'partial_error') && (
                    <button onClick={clearCompleted} className="text-xs flex items-center gap-1 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3 h-3" /> Clear History
                    </button>
                  )}
                </div>

                <div className="space-y-3 h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                  {uploadBatches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-3 opacity-60">
                      <ImagesIcon className="w-12 h-12 stroke-1" />
                      <p className="text-sm">No active uploads</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {uploadBatches.map((batch) => (
                        <BatchCard key={batch.id} batch={batch} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category Navigation */}
        <Card className="bg-card border-border">
          <CardHeader>
            <h3 className="text-lg font-semibold text-foreground">Categories</h3>
          </CardHeader>
          <CardContent>
            {/* Categories */}
            <div className="flex flex-wrap gap-4 justify-start">
              {categories.map((category) => (
                <div key={category.id} className="text-center">
                  <button
                    onClick={() => handleCategoryClick(category.id)}
                    className={`flex flex-col items-center gap-2 px-4 py-3 rounded-lg transition-colors ${selectedCategory === category.id
                      ? "bg-primary text-white"
                      : "bg-secondary text-foreground hover:bg-primary/20"
                      }`}
                  >
                    <FolderOpen className="w-6 h-6" />
                    <span className="font-medium">{category.name}</span>
                  </button>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-muted-foreground">No categories found. Create categories first.</p>
              )}
            </div>

            {/* Subcategories (Separate Block) */}
            <div className="mt-6 pt-6 border-t border-border">
              <h4 className="text-sm font-semibold text-foreground mb-3 text-left">Sub-Category</h4>
              <div className="flex flex-wrap gap-2 justify-start">
                <button
                  onClick={() => handleSubcategoryClick(0)}
                  disabled={!selectedCategory}
                  className={`px-4 py-2 rounded-lg text-sm transition-all duration-200 flex items-center gap-2 ${!selectedSubcategory
                    ? "bg-primary text-white shadow-md"
                    : "bg-secondary border border-border text-foreground hover:bg-muted/70"
                    } ${!selectedCategory ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span>-</span>
                  All
                </button>
                {subcategories.map((subcat) => (
                  <button
                    key={subcat.id}
                    onClick={() => handleSubcategoryClick(subcat.id)}
                    className={`px-4 py-2 rounded-lg text-sm transition-all duration-200 flex items-center gap-2 ${selectedSubcategory === subcat.id
                      ? "bg-primary text-white shadow-md"
                      : "bg-secondary border border-border text-foreground hover:bg-muted/70"
                      }`}
                  >
                    <FolderOpen className="w-4 h-4" />
                    {subcat.name}
                  </button>
                ))}
                {selectedCategory && subcategories.length === 0 && (
                  <span className="text-xs text-muted-foreground self-center ml-2">No subcategories</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Image Gallery */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-col gap-4 space-y-0">
            <div className="flex flex-row items-center justify-between w-full">
              <h3 className="text-lg font-semibold text-foreground">All Images</h3>
              <div className="flex items-center gap-2">
                {isImagesExpanded && (
                  <>
                    {images.length > 0 && (
                      <Button
                        onClick={toggleSelectAll}
                        variant="outline"
                        className="bg-secondary border-border text-foreground hover:bg-muted"
                        title={selectedImageIds.length === images.length ? "Deselect All" : "Select All"}
                      >
                        {selectedImageIds.length === images.length && images.length > 0 ? (
                          <CheckSquare className="w-4 h-4 mr-2" />
                        ) : (
                          <Square className="w-4 h-4 mr-2" />
                        )}
                        Select All
                      </Button>
                    )}
                    {selectedImageIds.length > 0 && (
                      <Button
                        onClick={handleBulkDelete}
                        variant="outline"
                        className="bg-destructive/10 border-destructive text-destructive hover:bg-destructive/20"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete ({selectedImageIds.length})
                      </Button>
                    )}
                    <Button
                      onClick={() => loadImages(1, false)}
                      variant="outline"
                      className="bg-secondary border-border text-foreground hover:bg-muted"
                    >
                      <Loader2 className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  </>
                )}
                <button
                  onClick={() => setIsImagesExpanded(!isImagesExpanded)}
                  className="p-2 hover:bg-secondary rounded-lg transition-colors"
                >
                  {isImagesExpanded ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>

            {isImagesExpanded && (
              <>
                {/* Filters and Sort */}
                <div className="flex flex-col sm:flex-row gap-3 w-full border-t border-border pt-4">
                  {/* Filter By & Sort By */}
                  <div className="flex gap-2">
                    <div className="w-[150px]">
                      <Select value={filterBy} onChange={(e) => setFilterBy(e.target.value)}>
                        <SelectOption value="">Filter By...</SelectOption>
                        <SelectOption value="price">Price</SelectOption>
                        <SelectOption value="description">Description</SelectOption>
                      </Select>
                    </div>

                    <div className="w-[180px]">
                      <Select
                        value={`${sortBy}-${sortOrder}`}
                        onChange={(e) => {
                          const [by, order] = e.target.value.split('-');
                          setSortBy(by);
                          setSortOrder(order as 'asc' | 'desc');
                        }}
                      >
                        <SelectOption value="createdAt-desc">Newest First</SelectOption>
                        <SelectOption value="createdAt-asc">Oldest First</SelectOption>
                        <SelectOption value="price-asc">Price: Low to High</SelectOption>
                        <SelectOption value="price-desc">Price: High to Low</SelectOption>
                        <SelectOption value="title-asc">Name: A-Z</SelectOption>
                        <SelectOption value="title-desc">Name: Z-A</SelectOption>
                        <SelectOption value="updatedAt-desc">Modified: Newest</SelectOption>
                        <SelectOption value="updatedAt-asc">Modified: Oldest</SelectOption>
                      </Select>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardHeader>
          {isImagesExpanded && (
            <CardContent>
              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading images...</p>
                </div>
              ) : images.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {images.map((image) => (
                      <div
                        key={image.id}
                        className="group relative rounded-lg border-2 border-border overflow-hidden hover:border-primary transition-colors bg-card"
                      >
                        {/* Checkbox */}
                        <div className="absolute top-2 left-2 z-10 bg-card/90 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={selectedImageIds.includes(image.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedImageIds([...selectedImageIds, image.id])
                              } else {
                                setSelectedImageIds(selectedImageIds.filter((id) => id !== image.id))
                              }
                            }}
                            className="w-4 h-4 cursor-pointer rounded border-border"
                          />
                        </div>

                        {/* Image */}
                        {/* Image */}
                        <div className="relative w-full h-48">
                          <Image
                            src={getImageUrl(image)}
                            alt={image.title || "Gallery Image"}
                            fill
                            className="object-cover group-hover:opacity-75 transition-opacity"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          />
                        </div>

                        {/* Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEditImage(image)}
                            className="p-2 bg-primary hover:bg-primary/90 rounded-full text-white transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteImage(image.id, image.title || "Image")}
                            className="p-2 bg-destructive hover:bg-destructive/90 rounded-full text-white transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Info */}
                        <div className="p-3 bg-card border-t border-border">
                          <h4 className="text-sm font-semibold text-foreground break-words line-clamp-2">
                            {image.title || "Untitled"}
                          </h4>
                          {image.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {image.description}
                            </p>
                          )}
                          {image.price && (
                            <p className="text-sm text-primary font-semibold mt-1">
                              {image.price_display || image.get_display_price || `${image.price_currency} ${image.price}`}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {image.sub_category_name
                              ? `${image.category_name} > ${image.sub_category_name}`
                              : image.category_name}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>


                  {/* Pagination */}
                  {totalImages > 0 && (
                    <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-8 pt-6 border-t border-border relative">
                      {/* Pagination Controls */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newPage = Math.max(1, currentPage - 1);
                            setCurrentPage(newPage);
                            loadImages(newPage, false);
                          }}
                          disabled={currentPage === 1}
                          className="bg-secondary border-border text-foreground hover:bg-muted transition-all duration-200 font-semibold"
                        >
                          ← Previous
                        </Button>

                        {/* Page Numbers */}
                        <div className="flex gap-2">
                          {Array.from({ length: Math.ceil(totalImages / itemsPerPage) }, (_, i) => i + 1)
                            .filter((page) => {
                              const totalPages = Math.ceil(totalImages / itemsPerPage);
                              if (totalPages <= 7) return true;
                              if (page === 1 || page === totalPages) return true;
                              if (page >= currentPage - 1 && page <= currentPage + 1) return true;
                              return false;
                            })
                            .map((page, idx, arr) => {
                              if (idx > 0 && arr[idx - 1] + 1 < page) {
                                return (
                                  <span key={`dots-${page}`} className="px-3 text-muted-foreground font-semibold">
                                    ...
                                  </span>
                                );
                              }
                              return (
                                <Button
                                  key={page}
                                  size="sm"
                                  onClick={() => {
                                    setCurrentPage(page);
                                    loadImages(page, false);
                                  }}
                                  variant={page === currentPage ? "primary" : "outline"}
                                  className={`transition-all duration-200 font-semibold min-w-10 ${page === currentPage
                                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md scale-105"
                                    : "bg-secondary border-border text-foreground hover:bg-muted hover:scale-105"
                                    }`}
                                >
                                  {page}
                                </Button>
                              );
                            })}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const totalPages = Math.ceil(totalImages / itemsPerPage);
                            const newPage = Math.min(totalPages, currentPage + 1);
                            setCurrentPage(newPage);
                            loadImages(newPage, false);
                          }}
                          disabled={currentPage >= Math.ceil(totalImages / itemsPerPage)}
                          className="bg-secondary border-border text-foreground hover:bg-muted transition-all duration-200 font-semibold"
                        >
                          Next →
                        </Button>
                      </div>

                      {/* Page Info & Rows per page */}
                      <div className="flex items-center gap-4 text-sm sm:absolute sm:right-0">
                        <p className="font-semibold text-foreground hidden md:block">
                          Page <span className="text-primary">{currentPage}</span> of{" "}
                          <span className="text-primary">{Math.ceil(totalImages / itemsPerPage)}</span>
                        </p>

                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Rows:</span>
                          <select
                            className="px-2 py-1 bg-secondary border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                            value={itemsPerPage}
                            onChange={(e) => {
                              setItemsPerPage(Number(e.target.value));
                              setCurrentPage(1);
                            }}
                          >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={30}>30</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-12 text-center">
                  <ImagesIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No images found</p>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>

      {/* Edit Modal */}
      {
        showEditModal && editingImage && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 max-h-screen overflow-y-auto">
            <Card className="w-full max-w-md bg-card border-border my-4">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <h2 className="text-xl font-semibold text-foreground">Edit Image</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingImage(null)
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateImage} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Title</label>
                    <input
                      placeholder="Enter image title"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Description</label>
                    <textarea
                      placeholder="Enter image description"
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 space-y-2">
                      <label className="text-sm font-medium text-foreground">Price</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={editForm.price}
                        onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                        className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Currency</label>
                      <select
                        value={editForm.price_currency}
                        onChange={(e) =>
                          setEditForm({ ...editForm, price_currency: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      >
                        <option>USD</option>
                        <option>EUR</option>
                        <option>GBP</option>
                        <option>INR</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
                      Update Image
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 bg-secondary border-border text-foreground hover:bg-muted"
                      onClick={() => {
                        setShowEditModal(false)
                        setEditingImage(null)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )
      }
      {
        deleteConf.isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  <h2 className="text-xl font-semibold text-foreground">Confirm Deletion</h2>
                </div>
                <button
                  onClick={() => setDeleteConf({ isOpen: false, type: 'single' })}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </CardHeader>
              <CardContent>
                <p className="text-foreground mb-6">
                  {deleteConf.type === 'single'
                    ? `Are you sure you want to delete "${deleteConf.title}"?`
                    : `Are you sure you want to delete ${deleteConf.count} image(s)?`}
                  <br />
                  <span className="text-sm text-muted-foreground mt-2 block">This action cannot be undone.</span>
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 bg-secondary border-border text-foreground hover:bg-muted"
                    onClick={() => setDeleteConf({ isOpen: false, type: 'single' })}
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
        )
      }
      {/* Upload Progress Modal */}

    </div >
  )
}

// Helper Component for Batch Card to handle local state for "dropdown/details"
function BatchCard({ batch }: { batch: any }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={`p-4 rounded-xl border transition-all ${batch.status === 'processing'
      ? 'bg-primary/5 border-primary/20 shadow-sm'
      : 'bg-card border-border'
      }`}>

      {/* Header: Destination */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${batch.status === 'completed' ? 'bg-green-500/10 text-green-500' :
            batch.status === 'processing' ? 'bg-primary/10 text-primary' :
              'bg-secondary text-muted-foreground'
            }`}>
            {batch.status === 'processing' ? <Loader2 className="animate-spin w-5 h-5" /> :
              batch.status === 'completed' ? <Check className="w-5 h-5" /> :
                <ImagesIcon className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              {/* Breadcrumbs */}
              <span>{batch.categoryName}</span>
              <span className="text-muted-foreground/60">/</span>
              <span className="text-foreground">
                {batch.subcategoryName}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={
            batch.status === 'completed' ? 'default' :
              batch.status === 'processing' ? 'secondary' : 'outline'
          } className={
            batch.status === 'completed' ? 'bg-green-500 hover:bg-green-600' : ''
          }>
            {batch.status === 'processing' ? 'Uploading...' :
              batch.status === 'completed' ? 'Completed' : 'Queued'}
          </Badge>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 hover:bg-secondary rounded-full transition-colors"
          >
            {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
        </div>
      </div>

      {/* Progress Section */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-medium">
          <span className={
            batch.status === 'processing' ? 'text-primary' : 'text-muted-foreground'
          }>
            {batch.processedCount} of {batch.totalCount} files processed
          </span>
          <span className="text-foreground">{batch.progress}%</span>
        </div>

        <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ease-out ${batch.status === 'completed' ? 'bg-green-500' :
              batch.status === 'partial_error' ? 'bg-amber-500' :
                'bg-primary'
              }`}
            style={{ width: `${batch.progress}%` }}
          />
        </div>

        {/* Stats Footer */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex gap-4">
            {(batch.status === 'processing' || batch.status === 'completed' || batch.status === 'partial_error') && (
              <>
                <div className="flex items-center gap-1.5 text-xs text-green-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Success: {batch.successCount}
                </div>
                {batch.failedCount > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-red-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    Failed: {batch.failedCount}
                  </div>
                )}
              </>
            )}
          </div>
          {isOpen && (
            <span className="text-[10px] text-muted-foreground">Showing details</span>
          )}
        </div>
      </div>

      {/* Detail Dropdown */}
      {
        isOpen && (
          <div className="mt-3 pt-3 border-t border-border space-y-2 max-h-[150px] overflow-y-auto scrollbar-thin scrollbar-thumb-secondary">
            {batch.files.map((f: any, i: number) => (
              <div key={i} className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2 truncate max-w-[80%]">
                  {f.status === 'success' ? <Check className="w-3 h-3 text-green-500" /> :
                    f.status === 'error' ? <X className="w-3 h-3 text-red-500" /> :
                      f.status === 'processing' ? <Loader2 className="w-3 h-3 animate-spin text-blue-500" /> :
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />}
                  <span className={`truncate ${f.status === 'success' ? 'text-muted-foreground line-through opacity-70' : 'text-foreground'}`}>
                    {f.file.name}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground capitalize">{f.status}</span>
              </div>
            ))}
          </div>
        )
      }
    </div >
  )
}



