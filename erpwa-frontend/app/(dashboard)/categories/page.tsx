"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/card"
import { Badge } from "@/components/badge"
import { Plus, Edit2, Trash2, Eye, EyeOff, X, FolderOpen, Check, AlertTriangle, Search, Filter, ChevronDown, ChevronUp } from "lucide-react"
import { categoriesAPI } from "@/lib/categoriesApi"
import type { Category, Contact } from "@/lib/types"
import { toast } from "react-toastify"
import { Checkbox } from "@/components/checkbox"
import { CoolTooltip } from "../../../components/ui/cool-tooltip"
import { Select, SelectOption } from "@/components/select"

function StatusBadge({ status, isLead }: { status: string; isLead?: boolean }) {
  // Lead statuses
  const leadStyles: Record<string, string> = {
    new: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
    contacted: "bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30",
    qualified: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
    converted: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30",
    lost: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
  }

  const leadLabels: Record<string, string> = {
    new: "New",
    contacted: "Contacted",
    qualified: "Qualified",
    converted: "Converted",
    lost: "Lost",
  }

  // Contact statuses
  const contactStyles: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
    active: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30",
    inactive: "bg-gray-500/20 text-gray-700 dark:text-gray-400 border-gray-500/30",
    closed: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
  }

  const contactLabels: Record<string, string> = {
    pending: "Pending",
    active: "Active",
    inactive: "Inactive",
    closed: "Closed",
  }

  const styles = isLead ? leadStyles : contactStyles
  const labels = isLead ? leadLabels : contactLabels
  const displayStatus = status || (isLead ? "new" : "pending")

  return (
    <Badge className={`${styles[displayStatus] || styles[isLead ? "new" : "pending"]} border`} variant="outline">
      {labels[displayStatus] || displayStatus}
    </Badge>
  )
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<number | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactCount, setContactCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // Search, filter, sort, and pagination states
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<string>("created_at")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Category form states
  const [categoryName, setCategoryName] = useState("")
  const [subcategoryName, setSubcategoryName] = useState("")
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [cascadeDeleteModal, setShowCascadeDeleteModal] = useState<{
    show: boolean
    categoryId: number
    categoryName: string
    imagesCount: number
    contactsCount: number
    leadsCount: number
    subcategoriesCount: number
  } | null>(null)

  // Confirmation State
  const [deleteConf, setDeleteConf] = useState<{
    isOpen: boolean;
    type: 'category' | 'contact';
    id?: number;
    title?: string;
  }>({ isOpen: false, type: 'category' });
  const [isContactsExpanded, setIsContactsExpanded] = useState(false)

  // Combobox State
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false)
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.category-combobox-container')) {
        setIsCategoryDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [])

  // Filter categories when input changes
  useEffect(() => {
    if (categoryName) {
      const filtered = categories.filter(c =>
        c.name.toLowerCase().includes(categoryName.toLowerCase())
      )
      setFilteredCategories(filtered)
    } else {
      setFilteredCategories(categories)
    }
  }, [categoryName, categories])



  useEffect(() => {
    loadCategories()
    // Load all contacts on initial page load
    loadContactDetails()
  }, [])

  useEffect(() => {
    // Load contacts whenever category/subcategory selection changes
    loadContactDetails()
  }, [selectedCategory, selectedSubcategory])

  const loadCategories = async () => {
    try {
      const response = await categoriesAPI.list()
      setCategories(response.data || [])
    } catch (error: any) {
      toast.error("Failed to load categories: " + (error.response?.data?.error || error.message))
    } finally {
      setLoading(false)
    }
  }

  const loadContactCount = async () => {
    // Only call API if we have at least one valid category/subcategory ID
    const hasValidCategory = selectedCategory !== null && !isNaN(selectedCategory) && selectedCategory > 0
    const hasValidSubcategory = selectedSubcategory !== null && !isNaN(selectedSubcategory) && selectedSubcategory > 0

    if (!hasValidCategory && !hasValidSubcategory) {
      setContactCount(0)
      return
    }

    try {
      const response = await categoriesAPI.getContacts(
        hasValidCategory ? selectedCategory : undefined,
        hasValidSubcategory ? selectedSubcategory : undefined
      )
      // API returns { data: { count, contacts } }
      const count = (response.data as any)?.count ?? 0
      setContactCount(count)
    } catch (error: any) {
      // API wrapper now never throws, but just in case
      console.error("Failed to load contact count:", error)
      setContactCount(0)
    }
  }

  const loadContactDetails = async () => {
    const hasValidCategory = selectedCategory !== null && !isNaN(selectedCategory) && selectedCategory > 0
    const hasValidSubcategory = selectedSubcategory !== null && !isNaN(selectedSubcategory) && selectedSubcategory > 0

    try {
      // If no category/subcategory selected, pass undefined to get ALL contacts
      const response = await categoriesAPI.getContacts(
        hasValidCategory ? selectedCategory : undefined,
        hasValidSubcategory ? selectedSubcategory : undefined
      )
      // API returns { data: { count, contacts } }
      const contacts = response.data?.contacts ?? []
      const count = response.data?.count ?? contacts.length
      setContacts(contacts)
      setContactCount(count)
    } catch (error: any) {
      // API wrapper now never throws, but just in case
      console.error("Failed to load contacts:", error)
      setContacts([])
      setContactCount(0)
    }
  }

  const handleCategoryClick = (categoryId: number) => {
    setSelectedCategory(categoryId)
    setSelectedSubcategory(null)
    setIsContactsExpanded(true)
    loadSubcategories(categoryId)
  }

  const loadSubcategories = async (categoryId: number) => {
    if (!categoryId || isNaN(categoryId)) {
      console.error("Invalid category ID:", categoryId)
      return
    }
    try {
      const response = await categoriesAPI.detail(categoryId)
      const category = categories.find((c) => c.id === categoryId)
      if (category) {
        category.subcategories = response.data?.subcategories || []
        setCategories([...categories])
      }
    } catch (error) {
      console.error("Failed to load subcategories:", error)
    }
  }

  const handleSubcategoryClick = (subcategoryId: number) => {
    setSelectedSubcategory(subcategoryId)
  }

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!categoryName.trim()) {
      toast.error("Category name is required")
      return
    }

    try {
      const formData = new FormData()
      formData.append("category_name", categoryName.trim())
      if (subcategoryName.trim()) {
        formData.append("subcategory_name", subcategoryName.trim())
      }
      if (selectedCategory) {
        formData.append("parent_id", selectedCategory.toString())
      }

      const response = await categoriesAPI.create(formData)

      if (response.data?.success !== false) {
        toast.success("Category created successfully!")
        setCategoryName("")
        setSubcategoryName("")
        await loadCategories()
      } else {
        toast.error("Failed to create category")
      }
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Failed to create category"
      toast.error(errorMsg)
      console.error("Category creation error:", error)
    }
  }

  const handleDeleteCategory = async (categoryId: number, categoryName: string) => {
    // Directly attempt deletion to check for cascade requirements
    await executeDeleteCategory(categoryId, categoryName);
  }

  const handleDeleteContact = (contactId: number, contactName: string) => {
    setDeleteConf({ isOpen: true, type: 'contact', id: contactId, title: contactName });
  }

  const handleConfirmDelete = async () => {
    if (!deleteConf.id) return;

    if (deleteConf.type === 'category') {
      await executeDeleteCategory(deleteConf.id, deleteConf.title || "");
    } else {
      await executeDeleteContact(deleteConf.id);
    }
    setDeleteConf({ ...deleteConf, isOpen: false });
  }

  const executeDeleteCategory = async (categoryId: number, categoryName: string) => {
    try {
      const response = await categoriesAPI.delete(categoryId, {})

      // Check if cascade delete is required
      if (response.data.requires_cascade) {
        setShowCascadeDeleteModal({
          show: true,
          categoryId,
          categoryName,
          imagesCount: response.data.images_count || 0,
          contactsCount: response.data.contacts_count || 0,
          leadsCount: response.data.leads_count || 0,
          subcategoriesCount: response.data.subcategories_count || 0,
        })
        return
      }

      if (response.data.success) {
        toast.success(response.data.message || "Category deleted successfully!")
        await loadCategories()
        if (selectedCategory === categoryId) {
          setSelectedCategory(null)
          setSelectedSubcategory(null)
        }
      } else {
        toast.error(response.data.error || "Failed to delete category")
      }
    } catch (error: any) {
      let errorData = error.response?.data
      if (typeof errorData === "string") {
        try {
          errorData = JSON.parse(errorData)
        } catch {
          errorData = { error: errorData }
        }
      }

      if (errorData?.requires_cascade) {
        setShowCascadeDeleteModal({
          show: true,
          categoryId,
          categoryName,
          imagesCount: errorData.images_count || 0,
          contactsCount: errorData.contacts_count || 0,
          leadsCount: errorData.leads_count || 0,
          subcategoriesCount: errorData.subcategories_count || 0,
        })
      } else {
        toast.error(errorData?.error || "Failed to delete category")
      }
    }
  }

  const handleConfirmCascadeDelete = async () => {
    if (!cascadeDeleteModal) return

    const deleteOptions = {
      delete_subcategories:
        cascadeDeleteModal.subcategoriesCount > 0 &&
        (document.getElementById("deleteSubcategories") as HTMLInputElement)?.checked,
      delete_gallery:
        cascadeDeleteModal.imagesCount > 0 &&
        (document.getElementById("deleteGallery") as HTMLInputElement)?.checked,
      delete_contacts:
        cascadeDeleteModal.contactsCount > 0 &&
        (document.getElementById("deleteContacts") as HTMLInputElement)?.checked,
      delete_leads:
        cascadeDeleteModal.leadsCount > 0 &&
        (document.getElementById("deleteLeads") as HTMLInputElement)?.checked,
    }

    const hasData =
      cascadeDeleteModal.imagesCount > 0 ||
      cascadeDeleteModal.contactsCount > 0 ||
      cascadeDeleteModal.leadsCount > 0 ||
      cascadeDeleteModal.subcategoriesCount > 0

    if (hasData && !Object.values(deleteOptions).some((v) => v)) {
      toast.error("Please select at least one deletion option")
      return
    }

    try {
      const response = await categoriesAPI.delete(cascadeDeleteModal.categoryId, deleteOptions)
      if (response.data.success) {
        toast.success(response.data.message || "Category deleted successfully!")
        setShowCascadeDeleteModal(null)
        await loadCategories()
        if (selectedCategory === cascadeDeleteModal.categoryId) {
          setSelectedCategory(null)
          setSelectedSubcategory(null)
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to delete category")
    }
  }

  const executeDeleteContact = async (contactId: number) => {
    try {
      await categoriesAPI.deleteContact(contactId)
      toast.success("Contact deleted successfully!")
      await loadContactDetails()
      await loadContactCount()
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to delete contact")
    }
  }

  const handleUpdateContactStatus = async (contactId: number, status: string) => {
    try {
      const formData = new FormData()
      formData.append("status", status)

      const response = await categoriesAPI.updateContact(contactId, formData)

      if (response.data?.success !== false) {
        toast.success("Contact updated successfully!")
        await loadContactDetails()
        await loadContactCount()
      } else {
        toast.error("Failed to update contact")
      }
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Failed to update contact"
      toast.error(errorMsg)
      console.error("Contact update error:", error)
    }
  }





  const selectedCategoryData = categories.find((c) => c.id === selectedCategory)
  const subcategories = selectedCategoryData?.subcategories || []

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg md:text-xl font-semibold text-foreground">
              Category & Contact Management
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage categories, subcategories, and contacts
            </p>
          </div>
        </div>

        {/* Breadcrumb */}
        {/* {(selectedCategory || selectedSubcategory) && (
          <div className="bg-secondary/50 border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => {
                  setSelectedCategory(null)
                  setSelectedSubcategory(null)
                }}
                className="text-primary hover:underline font-medium"
              >
                Categories
              </button>
              {selectedCategory && (
                <>
                  <span className="text-muted-foreground">/</span>
                  <button
                    onClick={() => setSelectedSubcategory(null)}
                    className="text-primary hover:underline font-medium"
                  >
                    {selectedCategoryData?.name}
                  </button>
                </>
              )}
              {selectedSubcategory && (
                <>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-foreground font-medium">
                    {subcategories.find((s) => s.id === selectedSubcategory)?.name}
                  </span>
                </>
              )}
            </div>
          </div>
        )} */}

        {/* Category Management */}
        <Card className="bg-card border-border">
          <CardHeader>
            <h3 className="text-lg font-semibold text-foreground">Category Management</h3>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateCategory} className="mb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative category-combobox-container">
                  <label htmlFor="category_name" className="text-sm font-medium text-foreground block mb-2">
                    Category Name
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    id="category_name"
                    value={categoryName}
                    onChange={(e) => {
                      setCategoryName(e.target.value)
                      setIsCategoryDropdownOpen(true)
                    }}
                    onFocus={() => setIsCategoryDropdownOpen(true)}
                    required
                    autoComplete="off"
                    placeholder="Create a Category"
                  />
                  {/* Combobox Dropdown */}
                  {isCategoryDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-60 overflow-auto">
                      {filteredCategories.length > 0 ? (
                        filteredCategories.map((cat) => (
                          <div
                            key={cat.id}
                            className="px-4 py-2 text-sm cursor-pointer hover:bg-muted text-popover-foreground transition-colors"
                            onClick={() => {
                              setCategoryName(cat.name)
                              setIsCategoryDropdownOpen(false)
                            }}
                          >
                            {cat.name}
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-2 text-sm text-muted-foreground">
                          Type to create new category
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="subcategory_name"
                    className="text-sm font-medium text-foreground block mb-2"
                  >
                    Sub-Category Name (Optional)
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    id="subcategory_name"
                    value={subcategoryName}
                    onChange={(e) => setSubcategoryName(e.target.value)}
                    placeholder="Create a Sub-category"
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Category
                  </Button>
                </div>
              </div>
            </form>

            {/* Category List */}
            {categories.length > 0 && (
              <div className="border-t border-border pt-4">
                <h6 className="mb-3 text-sm font-semibold text-foreground">Existing Categories</h6>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.map((cat) => (
                    <div key={cat.id} className="p-4 border border-border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="w-5 h-5 text-primary" />
                          <h6 className="font-semibold text-foreground">{cat.name}</h6>
                        </div>
                        <div className="flex gap-1">
                          <button
                            className="p-1 hover:bg-secondary rounded transition-colors"
                            onClick={() => {
                              setEditingCategory(cat)
                              setCategoryName(cat.name)
                              setShowEditModal(true)
                            }}
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <button
                            className="p-1 hover:bg-destructive/10 rounded transition-colors"
                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {cat.get_subcategories_count || cat.subcategories?.length || 0} subcategories
                      </p>
                      {cat.subcategories && cat.subcategories.length > 0 && (
                        <div className="mt-2">
                          <small className="text-muted-foreground text-xs block mb-1">
                            Subcategories:
                          </small>
                          <div className="flex flex-wrap gap-1">
                            {cat.subcategories.map((subcat) => (
                              <Badge
                                key={subcat.id}
                                variant="outline"
                                className="text-xs bg-secondary/50 border-border flex items-center gap-1"
                              >
                                {subcat.name}
                                <button
                                  className="p-0.5 hover:bg-secondary rounded"
                                  onClick={() => {
                                    setEditingCategory(subcat)
                                    setCategoryName(subcat.name)
                                    setShowEditModal(true)
                                  }}
                                  title="Edit"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  className="p-0.5 hover:bg-destructive/20 rounded"
                                  onClick={() => handleDeleteCategory(subcat.id, subcat.name)}
                                  title="Delete"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>



        {/* Contacts Section */}
        <Card className="bg-card border-border">
          <CardHeader
            className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer hover:bg-secondary/50 transition-colors"
            onClick={() => setIsContactsExpanded(!isContactsExpanded)}
          >
            <div className="flex flex-col">
              <h3 className="text-lg font-semibold text-foreground">Contacts</h3>
              {!isContactsExpanded && (
                <p className="text-xs text-muted-foreground mt-1">
                  Expand to view and manage contacts
                </p>
              )}
            </div>
            <div className="p-2 rounded-lg text-muted-foreground">
              {isContactsExpanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </div>
          </CardHeader>

          {isContactsExpanded && (
            <CardContent>
              {/* Filter by Category */}
              {categories.length > 0 && (
                <div className="mb-6 p-4 bg-card border border-border rounded-lg">
                  <label className="text-sm font-medium text-foreground block mb-3">
                    Filter by Category:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        className={`px-4 py-2 rounded text-sm transition-colors ${selectedCategory === cat.id
                          ? "bg-primary text-white"
                          : "bg-secondary text-foreground hover:bg-primary/20"
                          }`}
                        onClick={() => {
                          // Toggle: if already selected, deselect it
                          if (selectedCategory === cat.id) {
                            setSelectedCategory(null)
                            setSelectedSubcategory(null)
                            setContacts([])
                            setContactCount(0)
                          } else {
                            handleCategoryClick(cat.id)
                          }
                        }}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>

                  {/* Subcategories - Always visible */}
                  <div className="mt-4 pt-4 border-t border-border">
                    <label className="text-sm font-medium text-foreground block mb-3">
                      Sub-Category
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setSelectedSubcategory(null)}
                        disabled={!selectedCategory}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${!selectedSubcategory
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
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${selectedSubcategory === subcat.id
                            ? "bg-primary text-white shadow-md"
                            : "bg-secondary border border-border text-foreground hover:bg-muted/70"
                            }`}
                          onClick={() => {
                            // Toggle: if already selected, deselect it
                            if (selectedSubcategory === subcat.id) {
                              setSelectedSubcategory(null)
                            } else {
                              handleSubcategoryClick(subcat.id)
                            }
                          }}
                        >
                          <span>•</span>
                          {subcat.name}
                        </button>
                      ))}
                      {selectedCategory && subcategories.length === 0 && (
                        <span className="text-xs text-muted-foreground self-center ml-2">No subcategories</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Contact Count, Search, and Filters - Always show */}
              <div className="space-y-4 mb-6">
                {/* Total Count and Search Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-card border border-border rounded-lg">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <strong className="text-foreground">
                        {selectedCategory || selectedSubcategory ? "Filtered" : "Total"} Contacts:
                      </strong>
                      <span className="text-primary font-semibold text-2xl">{contactCount}</span>
                    </div>
                    {selectedCategoryData && (selectedCategory || selectedSubcategory) && (
                      <small className="text-muted-foreground block mt-1">
                        in {selectedCategoryData.name}
                        {selectedSubcategory &&
                          ` > ${subcategories.find((s) => s.id === selectedSubcategory)?.name}`}
                      </small>
                    )}
                    {!selectedCategory && !selectedSubcategory && (
                      <small className="text-muted-foreground block mt-1">
                        Across all categories
                      </small>
                    )}
                  </div>

                  {/* Search */}
                  <div className="relative flex-1 max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search contacts..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                  </div>
                </div>

                {/* Sort and Clear Filters */}
                <div className="flex flex-wrap gap-2 items-center">
                  {/* Sort */}
                  <div className="w-[200px]">
                    <Select
                      value={`${sortBy}:${sortOrder}`}
                      onChange={(e) => {
                        const [field, order] = e.target.value.split(":")
                        setSortBy(field)
                        setSortOrder(order as "asc" | "desc")
                      }}
                    >
                      <SelectOption value="created_at:desc">Sort: Latest First</SelectOption>
                      <SelectOption value="created_at:asc">Sort: Oldest First</SelectOption>
                      <SelectOption value="company_name:asc">Sort: Name (A-Z)</SelectOption>
                      <SelectOption value="company_name:desc">Sort: Name (Z-A)</SelectOption>
                      <SelectOption value="category_name:asc">Sort: Category (A-Z)</SelectOption>
                      <SelectOption value="category_name:desc">Sort: Category (Z-A)</SelectOption>
                      <SelectOption value="status:asc">Sort: Status (A-Z)</SelectOption>
                      <SelectOption value="status:desc">Sort: Status (Z-A)</SelectOption>
                    </Select>
                  </div>

                  {/* Clear Search */}
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery("")
                        setCurrentPage(1)
                      }}
                      className="text-xs text-destructive hover:underline px-3 py-2 bg-destructive/10 rounded-lg"
                    >
                      Clear Search
                    </button>
                  )}
                </div>
              </div>

              {/* Contacts Table - Always visible */}
              {(() => {
                // Filter contacts
                let filteredContacts = [...contacts]

                // Search filter
                if (searchQuery.trim()) {
                  const query = searchQuery.toLowerCase()
                  filteredContacts = filteredContacts.filter(
                    (contact) =>
                      contact.company_name?.toLowerCase().includes(query) ||
                      contact.mobile_number?.toString().includes(query) ||
                      contact.category_name?.toLowerCase().includes(query) ||
                      contact.sub_category_name?.toLowerCase().includes(query) ||
                      contact.sales_person_name?.toLowerCase().includes(query)
                  )
                }

                // Sort contacts
                filteredContacts.sort((a: any, b: any) => {
                  const aValue = a[sortBy] || ""
                  const bValue = b[sortBy] || ""

                  // Handle date sorting for created_at
                  if (sortBy === "created_at") {
                    const aDate = aValue ? new Date(aValue).getTime() : 0
                    const bDate = bValue ? new Date(bValue).getTime() : 0
                    return sortOrder === "asc" ? aDate - bDate : bDate - aDate
                  }

                  // Handle string sorting
                  if (typeof aValue === "string" && typeof bValue === "string") {
                    return sortOrder === "asc"
                      ? aValue.localeCompare(bValue)
                      : bValue.localeCompare(aValue)
                  }

                  // Handle numeric sorting
                  return sortOrder === "asc" ? aValue - bValue : bValue - aValue
                })

                // Pagination
                const totalPages = Math.ceil(filteredContacts.length / itemsPerPage)
                const startIndex = (currentPage - 1) * itemsPerPage
                const paginatedContacts = filteredContacts.slice(startIndex, startIndex + itemsPerPage)

                return (
                  <div className="mt-4">
                    <div className="overflow-x-auto">
                      <table className="text-sm w-full bg-card">
                        <thead>
                          <tr className="border-b border-border bg-secondary/30">
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">
                              Company Name
                            </th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">
                              Mobile Number
                            </th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell whitespace-nowrap">
                              Category
                            </th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell whitespace-nowrap">
                              Sub-Category
                            </th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell whitespace-nowrap">
                              Sales Person
                            </th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                            <th className="text-right py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedContacts && paginatedContacts.length > 0 ? (
                            paginatedContacts.map((contact: any) => (
                              <tr key={contact.id || `${contact.mobile_number}-${contact.company_name}`} className="border-b border-border hover:bg-muted/30">
                                <td className="py-3 px-4">
                                  <CoolTooltip content={contact.company_name}>
                                    <div className="truncate max-w-[150px] text-foreground">
                                      {contact.company_name || "--"}
                                    </div>
                                  </CoolTooltip>
                                </td>
                                <td className="py-3 px-4">
                                  <CoolTooltip content={contact.mobile_number}>
                                    <div className="truncate max-w-[150px] text-muted-foreground">
                                      {contact.mobile_number || "--"}
                                    </div>
                                  </CoolTooltip>
                                </td>
                                <td className="py-3 px-4 hidden md:table-cell">
                                  <CoolTooltip content={contact.category_name}>
                                    <div className="truncate max-w-[150px] text-foreground">
                                      {contact.category_name || "--"}
                                    </div>
                                  </CoolTooltip>
                                </td>
                                <td className="py-3 px-4 hidden md:table-cell">
                                  <CoolTooltip content={contact.sub_category_name}>
                                    <div className="truncate max-w-[150px] text-foreground">
                                      {contact.sub_category_name || "--"}
                                    </div>
                                  </CoolTooltip>
                                </td>
                                <td className="py-3 px-4 hidden md:table-cell">
                                  <CoolTooltip content={contact.sales_person_name}>
                                    <div className="truncate max-w-[150px] text-foreground">
                                      {contact.sales_person_name || "--"}
                                    </div>
                                  </CoolTooltip>
                                </td>
                                <td className="py-3 px-4">
                                  <StatusBadge status={contact.status || (contact.is_lead ? "new" : "pending")} isLead={contact.is_lead} />
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex justify-end gap-2">
                                    {contact.is_lead ? (
                                      <span className="text-xs text-muted-foreground px-2 py-1 bg-blue-500/10 rounded">
                                        Lead
                                      </span>
                                    ) : (
                                      <button
                                        className="p-1 hover:bg-destructive/10 rounded transition-colors"
                                        onClick={() => {
                                          if (contact.id) {
                                            handleDeleteContact(contact.id, contact.company_name || "contact")
                                          } else {
                                            toast.error("Cannot delete lead from here. Please use the Leads page.")
                                          }
                                        }}
                                        title="Delete"
                                      >
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={7} className="text-center py-6 text-muted-foreground">
                                {searchQuery
                                  ? "No contacts match your search"
                                  : "No contacts found for this category" + (selectedSubcategory ? " / subcategory" : "")}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {totalPages > 0 && (
                      <div className="flex flex-wrap justify-center items-center gap-3 mt-6 pt-4 border-t border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="bg-secondary border-border text-foreground hover:bg-muted"
                        >
                          ← Previous
                        </Button>

                        <div className="flex gap-2">
                          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            let pageNum
                            if (totalPages <= 5) {
                              pageNum = i + 1
                            } else if (currentPage <= 3) {
                              pageNum = i + 1
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i
                            } else {
                              pageNum = currentPage - 2 + i
                            }

                            return (
                              <Button
                                key={pageNum}
                                size="sm"
                                onClick={() => setCurrentPage(pageNum)}
                                className={`min-w-10 ${pageNum === currentPage
                                  ? "bg-primary hover:bg-primary/90 text-white"
                                  : "bg-secondary border-border text-foreground hover:bg-muted"
                                  }`}
                              >
                                {pageNum}
                              </Button>
                            )
                          })}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          className="bg-secondary border-border text-foreground hover:bg-muted"
                        >
                          Next →
                        </Button>

                        <div className="flex items-center gap-2 ml-4 pl-4 border-l border-border">
                          <span className="text-sm text-muted-foreground">Rows:</span>
                          <div className="w-[70px]">
                            <Select
                              value={itemsPerPage.toString()}
                              onChange={(e) => {
                                setItemsPerPage(Number(e.target.value))
                                setCurrentPage(1)
                              }}
                            >
                              <SelectOption value="10">10</SelectOption>
                              <SelectOption value="20">20</SelectOption>
                              <SelectOption value="30">30</SelectOption>
                              <SelectOption value="50">50</SelectOption>
                            </Select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

            </CardContent>
          )}
        </Card>
      </div>

      {/* Edit Category Modal */}
      {
        showEditModal && editingCategory && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <h2 className="text-xl font-semibold text-foreground">Edit Category</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingCategory(null)
                    setCategoryName("")
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()

                    if (!categoryName.trim()) {
                      toast.error("Category name is required")
                      return
                    }

                    try {
                      const formData = new FormData()
                      formData.append("name", categoryName.trim())

                      const response = await categoriesAPI.update(editingCategory.id, formData)

                      if (response.data?.success !== false) {
                        toast.success("Category updated successfully!")
                        setShowEditModal(false)
                        setEditingCategory(null)
                        setCategoryName("")
                        await loadCategories()
                      } else {
                        toast.error("Failed to update category")
                      }
                    } catch (error: any) {
                      const errorMsg =
                        error.response?.data?.error ||
                        error.response?.data?.message ||
                        error.message ||
                        "Failed to update category"
                      toast.error(errorMsg)
                      console.error("Category update error:", error)
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Category Name</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
                      Update Category
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 bg-secondary border-border text-foreground hover:bg-muted"
                      onClick={() => {
                        setShowEditModal(false)
                        setEditingCategory(null)
                        setCategoryName("")
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

      {/* Cascade Delete Modal */}
      {
        cascadeDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <h2 className="text-xl font-semibold text-foreground">Delete Category Options</h2>
                <button
                  onClick={() => setShowCascadeDeleteModal(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-foreground">
                    Category "{cascadeDeleteModal.categoryName}" has:
                    {cascadeDeleteModal.subcategoriesCount > 0 && (
                      <>
                        <br />- {cascadeDeleteModal.subcategoriesCount} subcategory(ies)
                      </>
                    )}
                    {cascadeDeleteModal.imagesCount > 0 && (
                      <>
                        <br />- {cascadeDeleteModal.imagesCount} image(s)
                      </>
                    )}
                    {cascadeDeleteModal.contactsCount > 0 && (
                      <>
                        <br />- {cascadeDeleteModal.contactsCount} contact(s)
                      </>
                    )}
                    {cascadeDeleteModal.leadsCount > 0 && (
                      <>
                        <br />- {cascadeDeleteModal.leadsCount} lead(s)
                      </>
                    )}
                    <br />
                    <br />
                    What would you like to delete?
                    <br />
                    <br />
                    <strong className="text-destructive">⚠️ WARNING: This action cannot be undone!</strong>
                  </p>
                  <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        id="deleteSubcategories"
                        className="cascade-checkbox"
                        disabled={cascadeDeleteModal.subcategoriesCount === 0}
                      />
                      <span className="text-sm text-foreground">
                        Delete {cascadeDeleteModal.subcategoriesCount} subcategory(ies)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        id="deleteGallery"
                        className="cascade-checkbox"
                        disabled={cascadeDeleteModal.imagesCount === 0}
                      />
                      <span className="text-sm text-foreground">
                        Delete {cascadeDeleteModal.imagesCount} image(s)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        id="deleteContacts"
                        className="cascade-checkbox"
                        disabled={cascadeDeleteModal.contactsCount === 0}
                      />
                      <span className="text-sm text-foreground">
                        Delete {cascadeDeleteModal.contactsCount} contact(s)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        id="deleteLeads"
                        className="cascade-checkbox"
                        disabled={cascadeDeleteModal.leadsCount === 0}
                      />
                      <span className="text-sm text-foreground">
                        Delete {cascadeDeleteModal.leadsCount} lead(s)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-semibold pt-2 border-t border-border">
                      <Checkbox
                        onChange={(e) => {
                          const checked = e.target.checked;
                          // Target the inputs INSIDE the wrapper divs that have the class
                          const checkboxes = document.querySelectorAll('.cascade-checkbox input[type="checkbox"]');
                          checkboxes.forEach((cb: any) => {
                            // Only check if enabled
                            if (!cb.disabled) cb.checked = checked;
                          });
                        }}
                      />
                      <span className="text-sm text-foreground">Select All</span>
                    </label>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 bg-secondary border-border text-foreground hover:bg-muted"
                      onClick={() => setShowCascadeDeleteModal(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 bg-destructive hover:bg-destructive/90"
                      onClick={handleConfirmCascadeDelete}
                    >
                      Delete Category
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      }


      {/* Confirmation Modal */}
      {deleteConf.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                <h2 className="text-xl font-semibold text-foreground">Confirm Deletion</h2>
              </div>
              <button
                onClick={() => setDeleteConf({ ...deleteConf, isOpen: false })}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent>
              <p className="text-foreground mb-6">
                Are you sure you want to delete {deleteConf.type === 'category' ? 'category' : 'contact'} "{deleteConf.title}"?
                <br />
                <span className="text-sm text-muted-foreground mt-2 block">This action cannot be undone.</span>
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 bg-secondary border-border text-foreground hover:bg-muted"
                  onClick={() => setDeleteConf({ ...deleteConf, isOpen: false })}
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
      )}
    </div >
  )
}


