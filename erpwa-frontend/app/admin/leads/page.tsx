"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/card"
import { Badge } from "@/components/badge"
import { Checkbox } from "@/components/checkbox"
import { CoolTooltip } from "@/components/ui/cool-tooltip"
import { Plus, Edit2, Trash2, Upload, X, FileText, Check, Save, Search, Filter, ChevronDown, AlertTriangle } from "lucide-react"
import { categoriesAPI } from "@/lib/categoriesApi"
import { leadsAPI } from "@/lib/leadsApi"
import type { Category, Lead } from "@/lib/types"
import { toast } from "react-toastify"
import { usersAPI, User } from "@/lib/usersApi"

function StatusBadge({ status }: { status: Lead["status"] }) {
  const styles: Record<Lead["status"], string> = {
    new: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
    contacted: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
    qualified: "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30",
    converted: "bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30",
    lost: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
  }

  const labels: Record<Lead["status"], string> = {
    new: "New",
    contacted: "Contacted",
    qualified: "Qualified",
    converted: "Converted",
    lost: "Lost",
  }

  return (
    <Badge className={`${styles[status]} border`} variant="outline">
      {labels[status]}
    </Badge>
  )
}

// Column Filter Dropdown Component
function ColumnFilterDropdown({
  column,
  values,
  selectedValues = new Set(),
  onChange,
  leads = [],
  align,
}: {
  column: string
  values: string[]
  selectedValues: Set<string>
  onChange: (values: Set<string>) => void
  leads?: Lead[]
  align?: "left" | "right"
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const alignment = align || "right"

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  const uniqueValues = Array.from(new Set(values.map((v) => v || "--").filter((v) => v))).sort()

  // Get subcategories for a selected category
  const getSubcategoriesForCategory = (categoryName: string) => {
    if (categoryName === "--" || categoryName === "new" || !categoryName) return []
    const leadsWithCategory = leads.filter((lead: any) => lead.category_name === categoryName)
    const subcats = Array.from(
      new Set(leadsWithCategory.map((lead: any) => lead.sub_category_name || "--"))
    ).sort()
    return subcats
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-secondary border border-border rounded-lg hover:bg-muted/70 transition-all duration-200 ease-in-out"
      >
        <Filter className="w-3 h-3" />
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className={`absolute top-full ${alignment === "left" ? "left-0" : "right-0"} mt-2 bg-secondary border border-border rounded-lg shadow-2xl z-[9999] min-w-56 animate-in fade-in slide-in-from-top-2 duration-200`}>
          <div className="p-2 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-secondary">
            {/* Select All */}
            <label className="flex items-center gap-2 px-3 py-2 hover:bg-muted/60 rounded-md cursor-pointer text-sm border-b border-border pb-2 mb-1 transition-colors duration-150">
              <input
                type="checkbox"
                checked={selectedValues.size === 0 || selectedValues.size === uniqueValues.length}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange(new Set())
                  } else {
                    onChange(new Set(uniqueValues))
                  }
                }}
                className="w-4 h-4 rounded cursor-pointer"
              />
              <span className="text-foreground font-semibold">All</span>
            </label>

            {/* Individual Values */}
            {uniqueValues.map((value) => (
              <div key={value}>
                <label className="flex items-center gap-2 px-3 py-2 hover:bg-muted/60 rounded-md cursor-pointer text-sm transition-colors duration-150">
                  <input
                    type="checkbox"
                    checked={!selectedValues.has(value)}
                    onChange={(e) => {
                      const newValues = new Set(selectedValues)
                      if (e.target.checked) {
                        newValues.delete(value)
                      } else {
                        newValues.add(value)
                      }
                      onChange(newValues)
                    }}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                  <span className="text-foreground">{value}</span>
                </label>

                {/* Show subcategories if this is a category filter and value is selected */}
                {column === "category_name" && !selectedValues.has(value) && (
                  <div className="ml-6 bg-muted/30 rounded p-2 my-1">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Sub-Category :-</p>
                    {getSubcategoriesForCategory(value).map((subcat) => (
                      <div key={subcat} className="text-xs text-muted-foreground py-1 px-2 flex items-center gap-1">
                        <span className="text-primary">•</span>
                        <span>{subcat}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Global Filter Dropdown Component
function GlobalFilterDropdown({
  leads,
  onSelect,
}: {
  leads: any[]
  onSelect: (field: string, value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  const categories = Array.from(new Set(leads.map((l) => l.category_name).filter(Boolean))).sort()
  const subcategories = Array.from(new Set(leads.map((l) => l.sub_category_name).filter(Boolean))).sort()
  const salesPersons = Array.from(new Set(leads.map((l) => l.sales_person_name).filter(Boolean))).sort()
  const statuses = ["new", "contacted", "qualified", "converted", "lost"]

  const renderGroup = (label: string, items: string[], field: string, prefix: string = "") => {
    if (items.length === 0) return null
    return (
      <div className="py-1">
        <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </div>
        {items.map((item) => (
          <button
            key={`${field}-${item}`}
            onClick={() => {
              onSelect(field, item)
              setIsOpen(false)
            }}
            className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
          >
            {prefix} {item}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm min-w-[140px] flex items-center justify-between gap-2"
      >
        <span>Filter By...</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-secondary border border-border rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-secondary">
          <div className="py-1 divide-y divide-border/50">
            {renderGroup("Category", categories, "category_name", "Category:")}
            {renderGroup("Sub-Category", subcategories, "sub_category_name", "Sub-Cat:")}
            {renderGroup("Status", statuses, "status", "Status:")}
            {renderGroup("Sales Person", salesPersons, "sales_person_name", "Sales:")}
          </div>
        </div>
      )}
    </div>
  )
}

// Manual Entry Component
function ManualEntryComponent({
  categories,
  teamMembers,
  onLeadsAdded,
}: {
  categories: Category[]
  teamMembers: any[]
  onLeadsAdded: () => void
}) {
  const [manualForm, setManualForm] = useState({
    category_id: "",
    subcategory_id: "",
    sales_person_name: "",
    leads_text: "",
    separator: "|",
  })
  const [manualSubcategories, setManualSubcategories] = useState<Category[]>([])
  const [actionErrors, setActionErrors] = useState<string[]>([])

  const loadSubcategories = async (categoryId: number) => {
    try {
      const response = await categoriesAPI.detail(categoryId)
      setManualSubcategories(response.data.subcategories || [])
    } catch (error) {
      setManualSubcategories([])
    }
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg">Manual Entry</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side - Dropdowns */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Category <span className="text-destructive">*</span>
              </label>
              <select
                className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                value={manualForm.category_id}
                onChange={(e) => {
                  setManualForm({ ...manualForm, category_id: e.target.value, subcategory_id: "" })
                  if (e.target.value) {
                    loadSubcategories(parseInt(e.target.value))
                  } else {
                    setManualSubcategories([])
                  }
                }}
                required
              >
                <option value="">-- Select Category --</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Sub-Category <span className="text-destructive">*</span>
              </label>
              <select
                className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm disabled:opacity-50"
                value={manualForm.subcategory_id}
                onChange={(e) => setManualForm({ ...manualForm, subcategory_id: e.target.value })}
                disabled={!manualForm.category_id || manualSubcategories.length === 0}
                required
              >
                <option value="">
                  -- {manualForm.category_id ? "Select Sub-Category" : "Select Category First"} --
                </option>
                {manualSubcategories.map((subcat) => (
                  <option key={subcat.id} value={subcat.id}>
                    {subcat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Sales Person (Optional)
              </label>
              <select
                className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                value={manualForm.sales_person_name}
                onChange={(e) => setManualForm({ ...manualForm, sales_person_name: e.target.value })}
              >
                <option value="">-- Select Sales Person --</option>
                {teamMembers.map((member: any) => (
                  <option key={member.id} value={member.name || member.full_name}>
                    {member.name || member.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right Side - Leads Textarea */}
          <div className="space-y-2 flex flex-col">
            <div className="flex-1 flex flex-col" style={{ minHeight: "280px" }}>
              <label className="text-sm font-medium text-foreground block mb-2">
                Leads <span className="text-destructive">*</span>
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Format: Company Name | Phone Number | Email | City (one per line)
              </p>
              <textarea
                placeholder="ABC Corp | 1234567890 | abc@example.com | New York&#10;XYZ Ltd | 9876543210 | xyz@example.com | London"
                value={manualForm.leads_text}
                onChange={(e) => setManualForm({ ...manualForm, leads_text: e.target.value })}
                className="flex-1 px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none overflow-y-auto"
                style={{ minHeight: "200px" }}
                required
              />
            </div>

            {/* Error Actions Box */}
            {actionErrors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 my-2 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <p className="text-sm font-semibold text-destructive">Errors Found ({actionErrors.length})</p>
                </div>
                <div className="max-h-24 overflow-y-auto pr-1">
                  <ul className="text-xs text-destructive/90 list-disc pl-4 space-y-1">
                    {actionErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <Button
              onClick={async () => {
                setActionErrors([])
                if (!manualForm.category_id) {
                  toast.error("Category is required")
                  return
                }
                if (!manualForm.subcategory_id) {
                  toast.error("Sub-category is required")
                  return
                }
                if (!manualForm.leads_text.trim()) {
                  toast.error("Please enter leads data")
                  return
                }

                // Validate leads data format
                const leads = manualForm.leads_text.trim().split("\n")
                const separator = manualForm.separator
                let hasError = false

                for (let i = 0; i < leads.length; i++) {
                  const leadData = leads[i].split(separator).map(s => s.trim())
                  const lineNum = i + 1

                  // Check if there are at least 2 fields (name and phone/email)
                  if (leadData.length < 2) continue

                  // Validate phone number (if present) - should be numeric
                  if (leadData[1]) {
                    if (!/^\d+$/.test(leadData[1].replace(/[\s\-\(\)]/g, ''))) {
                      toast.error(`Line ${lineNum}: Phone number must contain only numbers`)
                      hasError = true
                      break
                    }
                  }

                  // Validate email (if present in 3rd position) - must have @
                  if (leadData[2] && leadData[2].length > 0) {
                    if (!leadData[2].includes('@')) {
                      toast.error(`Line ${lineNum}: Email must contain @ symbol`)
                      hasError = true
                      break
                    }
                  }
                }

                if (hasError) return


                try {
                  const formData = new FormData()
                  formData.append("category_id", manualForm.category_id)
                  formData.append("subcategory_id", manualForm.subcategory_id)
                  formData.append("sales_person_name", manualForm.sales_person_name.trim())
                  formData.append("leads_text", manualForm.leads_text.trim())
                  formData.append("separator", manualForm.separator)

                  const response = await leadsAPI.createManual(formData)

                  const { success, created, failed, errors } = response.data

                  if (success && failed === 0) {
                    toast.success("Leads added successfully!")
                    setManualForm({
                      category_id: "",
                      subcategory_id: "",
                      sales_person_name: "",
                      leads_text: "",
                      separator: "|",
                    })
                    setManualSubcategories([])
                    onLeadsAdded()
                  } else if (success && failed > 0) {
                    if (created > 0) {
                      toast.success(`${created} leads added successfully!`)
                      onLeadsAdded()
                      // Clear form only if we want to force re-entry, but maybe better to keep it? 
                      // For now, let's clear it to match previous behavior but alert on errors.
                      setManualForm({
                        category_id: "",
                        subcategory_id: "",
                        sales_person_name: "",
                        leads_text: "",
                        separator: "|",
                      })
                      setManualSubcategories([])
                    }

                    if (errors && errors.length > 0) {
                      const newErrList: string[] = []
                      errors.forEach((err: any) => {
                        const num = err.data?.mobile_number || 'Lead'
                        let msg = ''
                        if (err.error?.includes('already exists')) {
                          msg = `Lead with number ${num} already exists`
                          toast.error(msg, { autoClose: 5000 })
                        } else {
                          msg = `Failed to add ${num}: ${err.error}`
                          toast.error(msg, { autoClose: 5000 })
                        }
                        newErrList.push(msg)
                      })
                      setActionErrors(newErrList)
                    }
                  } else {
                    toast.error("Failed to add leads")
                  }
                } catch (error: any) {
                  const errorMsg =
                    error.response?.data?.error ||
                    error.response?.data?.message ||
                    error.message ||
                    "Failed to add leads"
                  toast.error(errorMsg)
                }
              }}
              className="w-full bg-primary hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Leads
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Upload File Component (Matching Manual Layout)
function UploadFileComponent({
  categories,
  teamMembers,
  onLeadsAdded,
}: {
  categories: Category[]
  teamMembers: any[]
  onLeadsAdded: () => void
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [previewTotal, setPreviewTotal] = useState(0)
  const [previewForm, setPreviewForm] = useState({
    category_id: "",
    subcategory_id: "",
    sales_person_name: "",
  })
  const [previewSubcategories, setPreviewSubcategories] = useState<Category[]>([])

  const loadSubcategories = async (categoryId: number) => {
    try {
      const response = await categoriesAPI.detail(categoryId)
      setPreviewSubcategories(response.data.subcategories || [])
    } catch (error) {
      setPreviewSubcategories([])
    }
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg">Upload File</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side - File Upload */}
          <div className="space-y-4 flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center">
              <style jsx>{`
                .upload-container {
                  height: 300px;
                  width: 100%;
                  max-width: 300px;
                  border-radius: 10px;
                  box-shadow: 4px 4px 30px rgba(0, 0, 0, 0.2);
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: space-between;
                  padding: 10px;
                  gap: 5px;
                  background-color: rgba(0, 110, 255, 0.041);
                }
                .upload-header {
                  flex: 1;
                  width: 100%;
                  border: 2px dashed royalblue;
                  border-radius: 10px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  flex-direction: column;
                  cursor: pointer;
                  transition: all 0.3s ease;
                }
                .upload-header:hover {
                  background-color: rgba(0, 110, 255, 0.05);
                  border-color: #4169e1;
                }
                .upload-header svg {
                  height: 100px;
                  stroke: #000;
                }
                .upload-header p {
                  text-align: center;
                  color: var(--foreground);
                  margin-top: 10px;
                  font-weight: 500;
                }
                .upload-footer {
                  background-color: rgba(0, 110, 255, 0.075);
                  width: 100%;
                  height: 40px;
                  padding: 8px;
                  border-radius: 10px;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: flex-end;
                  color: var(--foreground);
                  border: none;
                  transition: all 0.3s ease;
                }
                .upload-footer:hover {
                  background-color: rgba(0, 110, 255, 0.15);
                }
                .upload-footer svg {
                  height: 130%;
                  fill: royalblue;
                  background-color: rgba(70, 66, 66, 0.103);
                  border-radius: 50%;
                  padding: 2px;
                  cursor: pointer;
                  box-shadow: 0 2px 30px rgba(0, 0, 0, 0.205);
                  transition: transform 0.2s ease;
                }
                .upload-footer svg:hover {
                  transform: scale(1.1);
                }
                .upload-footer p {
                  flex: 1;
                  text-align: center;
                  font-size: 0.9em;
                }
              `}</style>
              <div className="upload-container">
                <label htmlFor="file-upload" className="upload-header">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g strokeWidth={0} />
                    <g strokeLinecap="round" strokeLinejoin="round" />
                    <g>
                      <path
                        d="M7 10V9C7 6.23858 9.23858 4 12 4C14.7614 4 17 6.23858 17 9V10C19.2091 10 21 11.7909 21 14C21 15.4806 20.1956 16.8084 19 17.5M7 10C4.79086 10 3 11.7909 3 14C3 15.4806 3.8044 16.8084 5 17.5M7 10C7.43285 10 7.84965 10.0688 8.24006 10.1959M12 12V21M12 12L15 15M12 12L9 15"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  </svg>
                  <p>Browse File to upload!</p>
                </label>
                <label htmlFor="file-upload" className="upload-footer">
                  <svg fill="currentColor" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                    <g strokeWidth={0} />
                    <g strokeLinecap="round" strokeLinejoin="round" />
                    <g>
                      <path d="M15.331 6H8.5v20h15V14.154h-8.169z" />
                      <path d="M18.153 6h-.009v5.342H23.5v-.002z" />
                    </g>
                  </svg>
                  <p>{selectedFile ? selectedFile.name : "Not selected file"}</p>
                  {selectedFile && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setSelectedFile(null)
                      }}
                    >
                      <g strokeWidth={0} />
                      <g strokeLinecap="round" strokeLinejoin="round" />
                      <g>
                        <path
                          d="M5.16565 10.1534C5.07629 8.99181 5.99473 8 7.15975 8H16.8402C18.0053 8 18.9237 8.9918 18.8344 10.1534L18.142 19.1534C18.0619 20.1954 17.193 21 16.1479 21H7.85206C6.80699 21 5.93811 20.1954 5.85795 19.1534L5.16565 10.1534Z"
                          stroke="currentColor"
                          strokeWidth={2}
                        />
                        <path d="M19.5 5H4.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                        <path
                          d="M10 3C10 2.44772 10.4477 2 11 2H13C13.5523 2 14 2.44772 14 3V5H10V3Z"
                          stroke="currentColor"
                          strokeWidth={2}
                        />
                      </g>
                    </svg>
                  )}
                </label>
                <input
                  id="file-upload"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  style={{ display: "none" }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-4 text-center">
                CSV or Excel file with columns: Company Name, Mobile Number, Email, City
              </p>
            </div>

            <Button
              onClick={async () => {
                if (!selectedFile) {
                  toast.error("Please select a file")
                  return
                }
                try {
                  const formData = new FormData()
                  formData.append("leads_file", selectedFile)
                  const response = await leadsAPI.uploadFile(formData)
                  if (response.data?.preview) {
                    setPreviewData(response.data.preview)
                    setPreviewTotal(response.data.total_count || 0)
                    toast.success("File uploaded! Preview shown on the right.")
                  } else {
                    toast.success("File uploaded successfully!")
                  }
                } catch (error: any) {
                  toast.error(error.response?.data?.error || "Failed to upload file")
                }
              }}
              className="w-full bg-primary hover:bg-primary/90"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload & Preview
            </Button>
          </div>

          {/* Right Side - Preview */}
          <div className="space-y-4 flex flex-col">
            <p className="text-sm font-medium text-foreground">Preview</p>
            <div className="flex-1 flex flex-col" style={{ minHeight: "280px" }}>
              {previewData.length > 0 ? (
                <div className="border border-border rounded-lg p-3 bg-secondary/30 overflow-y-auto flex-1" style={{ minHeight: "200px" }}>
                  <div className="flex justify-between items-center mb-3 sticky top-0 bg-secondary/50 p-2 -m-3 mb-2">
                    <p className="text-sm font-medium text-foreground">
                      {previewData.length} of {previewTotal} records
                    </p>
                    <button
                      onClick={() => {
                        setPreviewData([])
                        setPreviewTotal(0)
                        setSelectedFile(null)
                      }}
                      className="text-xs text-destructive hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="sticky top-10 bg-secondary border-b border-border">
                      <tr>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Company</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Phone</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Email</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">City</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.slice(0, 10).map((row: any, index: number) => (
                        <tr key={index} className="border-b border-border hover:bg-muted/30">
                          <td className="py-2 px-2 text-foreground">
                            {row["Company Name"] || row["company_name"] || "N/A"}
                          </td>
                          <td className="py-2 px-2 text-foreground">
                            {row["Mobile Number"] || row["mobile_number"] || "N/A"}
                          </td>
                          <td className="py-2 px-2 text-foreground">
                            {row["Email"] || row["email"] || "N/A"}
                          </td>
                          <td className="py-2 px-2 text-foreground">
                            {row["City"] || row["city"] || "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="border border-border rounded-lg p-8 bg-secondary/30 text-center flex-1 flex items-center justify-center" style={{ minHeight: "200px" }}>
                  <p className="text-sm text-muted-foreground">Upload a file to see preview</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Confirmation Form - Below Preview */}
        {previewData.length > 0 && (
          <div className="mt-8 pt-8 border-t border-border">
            <h4 className="text-sm font-semibold text-foreground mb-4">Confirm & Import</h4>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Category <span className="text-destructive">*</span>
                </label>
                <select
                  className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  value={previewForm.category_id}
                  onChange={(e) => {
                    setPreviewForm({
                      ...previewForm,
                      category_id: e.target.value,
                      subcategory_id: "",
                    })
                    if (e.target.value) {
                      loadSubcategories(parseInt(e.target.value))
                    } else {
                      setPreviewSubcategories([])
                    }
                  }}
                  required
                >
                  <option value="">-- Select Category --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Sub-Category <span className="text-destructive">*</span>
                </label>
                <select
                  className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm disabled:opacity-50"
                  value={previewForm.subcategory_id}
                  onChange={(e) => setPreviewForm({ ...previewForm, subcategory_id: e.target.value })}
                  disabled={!previewForm.category_id || previewSubcategories.length === 0}
                  required
                >
                  <option value="">
                    -- {previewForm.category_id ? "Select Sub-Category" : "Select Category First"} --
                  </option>
                  {previewSubcategories.map((subcat) => (
                    <option key={subcat.id} value={subcat.id}>
                      {subcat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-2">
                  Sales Person (Optional)
                </label>
                {teamMembers.length > 0 ? (
                  <select
                    className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    value={previewForm.sales_person_name}
                    onChange={(e) => setPreviewForm({ ...previewForm, sales_person_name: e.target.value })}
                  >
                    <option value="">-- Select Sales Person --</option>
                    {teamMembers.map((member: any) => (
                      <option key={member.id} value={member.name || member.full_name}>
                        {member.name || member.full_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Enter sales person name (optional)"
                    value={previewForm.sales_person_name}
                    onChange={(e) => setPreviewForm({ ...previewForm, sales_person_name: e.target.value })}
                    className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button
                onClick={async () => {
                  if (!previewForm.category_id) {
                    toast.error("Category is required")
                    return
                  }
                  if (!previewForm.subcategory_id) {
                    toast.error("Sub-category is required")
                    return
                  }

                  try {
                    const formData = new FormData()
                    formData.append("category_id", previewForm.category_id)
                    formData.append("subcategory_id", previewForm.subcategory_id)
                    formData.append("sales_person_name", previewForm.sales_person_name.trim())

                    const response = await leadsAPI.confirmImport(formData)

                    if (response.data?.success !== false) {
                      toast.success(`Successfully imported ${previewTotal} leads!`)
                      setPreviewData([])
                      setPreviewTotal(0)
                      setPreviewForm({
                        category_id: "",
                        subcategory_id: "",
                        sales_person_name: "",
                      })
                      setPreviewSubcategories([])
                      setSelectedFile(null)
                      onLeadsAdded()
                    } else {
                      toast.error("Failed to import leads")
                    }
                  } catch (error: any) {
                    const errorMsg =
                      error.response?.data?.error ||
                      error.response?.data?.message ||
                      error.message ||
                      "Failed to import leads"
                    toast.error(errorMsg)
                  }
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="w-4 h-4 mr-2" />
                Import {previewTotal} Leads
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPreviewData([])
                  setPreviewTotal(0)
                  setSelectedFile(null)
                }}
                className="bg-secondary border-border text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function LeadsPage() {
  const [currentMode, setCurrentMode] = useState<"manual" | "upload">("manual")
  const [categories, setCategories] = useState<Category[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [currentPageNum, setCurrentPageNum] = useState(1)
  const [editingLeadId, setEditingLeadId] = useState<number | null>(null)

  // Delete confirm state
  const [deleteConf, setDeleteConf] = useState<{
    isOpen: boolean;
    id?: number;
    title?: string;
  }>({ isOpen: false });
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set())
  const [columnFilters, setColumnFilters] = useState<{ [key: string]: Set<string> }>({
    company_name: new Set(),
    mobile_number: new Set(),
    email: new Set(),
    city: new Set(),
    category_name: new Set(),
    sub_category_name: new Set(),
    status: new Set(),
    sales_person_name: new Set(),
  })
  const [showBulkSalesPerson, setShowBulkSalesPerson] = useState(false)
  const [bulkSalesPersonName, setBulkSalesPersonName] = useState("")
  const [editForm, setEditForm] = useState<{
    [key: number]: {
      company_name?: string
      mobile_number?: string
      email?: string
      city?: string
      status?: string
      sales_person_name?: string
      category_id?: string
      subcategory_id?: string
    }
  }>({})
  const [editLeadSubcategories, setEditLeadSubcategories] = useState<{ [key: number]: Category[] }>({})
  const [sortBy, setSortBy] = useState<string>("created_at")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [showManualEntry, setShowManualEntry] = useState(true)
  const [showUploadFile, setShowUploadFile] = useState(true)

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    filterAndPaginateLeads()
  }, [leads, searchQuery, columnFilters, currentPageNum, itemsPerPage, sortBy, sortOrder])

  const loadInitialData = async () => {
    try {
      await Promise.all([loadCategories(), loadTeamMembers(), loadLeads()])
    } catch (error) {
      console.error("Failed to load initial data:", error)
    }
  }

  const loadCategories = async () => {
    try {
      const response = await categoriesAPI.list()
      setCategories(response.data || [])
    } catch (error: any) {
      toast.error("Failed to load categories")
    }
  }

  const loadTeamMembers = async () => {
    try {
      const res = await usersAPI.list('sales')
      if (res.data) {
        setTeamMembers(res.data)
      }
    } catch (error) {
      console.error("Failed to load sales persons", error)
    }
  }

  const loadLeads = async () => {
    try {
      const response = await leadsAPI.list()

      let leadsData: any[] = []
      let total = 0

      if (response.data) {
        if (Array.isArray(response.data)) {
          leadsData = response.data
          total = response.data.length
        } else if ("leads" in response.data) {
          leadsData = (response.data as any).leads || []
          total = (response.data as any).total || leadsData.length
        } else {
          leadsData = []
          total = 0
        }
      }

      const transformedLeads = leadsData.map((lead: any) => {
        return {
          ...lead,
          category_name: lead.category_name || "--",
          sub_category_name: lead.sub_category_name || "--",
          category: typeof lead.category === "number" ? lead.category : lead.category_id || null,
          sub_category:
            typeof lead.sub_category === "number" ? lead.sub_category : lead.subcategory_id || null,
        }
      })

      setLeads(transformedLeads)
      setTotalCount(total)
      setSelectedLeads(new Set())
    } catch (error: any) {
      console.error("Failed to load leads:", error)
      setLeads([])
      setTotalCount(0)
    }
  }

  const filterAndPaginateLeads = () => {
    let result = [...leads]

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (lead) =>
          lead.company_name?.toLowerCase().includes(query) ||
          lead.mobile_number?.toString().includes(query) ||
          (lead as any).email?.toLowerCase().includes(query) ||
          (lead as any).city?.toLowerCase().includes(query)
      )
    }

    // Column filters (inclusion - show only items that match)
    Object.entries(columnFilters).forEach(([column, includedValues]) => {
      if (includedValues.size > 0) {
        result = result.filter((lead: any) => {
          const leadValue = lead[column]?.toString() || "--"
          return includedValues.has(leadValue)
        })
      }
    })

    // Sorting
    if (sortBy) {
      result.sort((a: any, b: any) => {
        let aValue: any
        let bValue: any

        // Special handling for status to sort by progression
        if (sortBy === "status") {
          const statusOrder = { new: 1, contacted: 2, qualified: 3, converted: 4, lost: 5 }
          aValue = statusOrder[a.status as keyof typeof statusOrder] || 0
          bValue = statusOrder[b.status as keyof typeof statusOrder] || 0
        } else {
          aValue = a[sortBy]
          bValue = b[sortBy]
        }

        // Handle null/undefined values
        if (aValue == null) return 1
        if (bValue == null) return -1

        // String comparison
        if (typeof aValue === "string" && typeof bValue === "string") {
          return sortOrder === "asc"
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue)
        }

        // Number comparison
        return sortOrder === "asc" ? aValue - bValue : bValue - aValue
      })
    }

    setFilteredLeads(result)
  }

  const loadEditLeadSubcategories = async (leadId: number, categoryId: number) => {
    try {
      const response = await categoriesAPI.detail(categoryId)
      setEditLeadSubcategories((prev) => ({
        ...prev,
        [leadId]: response.data.subcategories || [],
      }))
    } catch (error) {
      setEditLeadSubcategories((prev) => ({
        ...prev,
        [leadId]: [],
      }))
    }
  }

  const handleDeleteLead = (leadId: number, companyName: string) => {
    setDeleteConf({ isOpen: true, id: leadId, title: companyName });
  }

  const executeDeleteLead = async (leadId: number) => {
    try {
      await leadsAPI.delete(leadId)
      toast.success("Lead deleted successfully!")
      await loadLeads()
    } catch (error: any) {
      toast.error(
        error.response?.data?.error || "Failed to delete lead"
      )
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteConf.id) return;
    await executeDeleteLead(deleteConf.id);
    setDeleteConf({ ...deleteConf, isOpen: false });
  }

  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage)
  const startIndex = (currentPageNum - 1) * itemsPerPage
  const paginatedLeads = filteredLeads.slice(startIndex, startIndex + itemsPerPage)

  const getColumnValues = (column: string) => {
    return leads.map((lead: any) => lead[column]?.toString() || "--")
  }

  const columns = [
    { key: "company_name", label: "Company", width: "min-w-[200px]" },
    { key: "mobile_number", label: "Phone", width: "min-w-[150px]" },
    { key: "email", label: "Email", width: "min-w-[200px]" },
    { key: "city", label: "City", width: "min-w-[150px]" },
    { key: "category_name", label: "Category", width: "min-w-[150px]" },
    { key: "sub_category_name", label: "Sub-Category", width: "min-w-[150px]" },
    { key: "status", label: "Status", width: "min-w-[120px]" },
    { key: "sales_person_name", label: "Sales Person", width: "min-w-[150px]" },
  ]

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold text-foreground">Leads Management</h2>
          <p className="text-sm text-muted-foreground mt-1">Add, manage, and track sales leads</p>
        </div>

        {/* Mode Toggle Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={() => setCurrentMode("manual")}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${currentMode === "manual"
              ? "bg-primary hover:bg-primary/90 text-white"
              : "bg-secondary border border-border !text-foreground hover:bg-muted"
              }`}
          >
            <FileText className="w-4 h-4 mr-2" />
            Manual Entry
          </Button>
          <Button
            onClick={() => setCurrentMode("upload")}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${currentMode === "upload"
              ? "bg-primary hover:bg-primary/90 text-white"
              : "bg-secondary border border-border !text-foreground hover:bg-muted"
              }`}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload File
          </Button>
        </div>

        {/* Form Section */}
        <div>
          {currentMode === "manual" ? (
            <div>
              <div
                className="flex justify-between items-center mb-4 cursor-pointer bg-card border border-border rounded-lg p-4"
                onClick={() => setShowManualEntry(!showManualEntry)}
              >
                <h3 className="text-lg font-semibold text-foreground">Manual Entry</h3>
                <button className="text-2xl text-muted-foreground hover:text-foreground transition-colors">
                  {showManualEntry ? "−" : "+"}
                </button>
              </div>
              {showManualEntry && (
                <ManualEntryComponent
                  categories={categories}
                  teamMembers={teamMembers}
                  onLeadsAdded={loadLeads}
                />
              )}
            </div>
          ) : (
            <div>
              <div
                className="flex justify-between items-center mb-4 cursor-pointer bg-card border border-border rounded-lg p-4"
                onClick={() => setShowUploadFile(!showUploadFile)}
              >
                <h3 className="text-lg font-semibold text-foreground">Upload File</h3>
                <button className="text-2xl text-muted-foreground hover:text-foreground transition-colors">
                  {showUploadFile ? "−" : "+"}
                </button>
              </div>
              {showUploadFile && (
                <UploadFileComponent
                  categories={categories}
                  teamMembers={teamMembers}
                  onLeadsAdded={loadLeads}
                />
              )}
            </div>
          )}
        </div>

        {/* Leads List Section - Below Forms */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="space-y-3">
              {/* Header Row */}
              <div className="flex justify-between items-start gap-4">
                <div>
                  <CardTitle className="text-lg">All Leads</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Showing: <span className="font-semibold text-primary">{paginatedLeads.length}</span> of{" "}
                    <span className="font-semibold text-primary">{filteredLeads.length}</span>
                  </p>
                </div>
              </div>

              {/* Search and Filter/Sort Bar */}
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search leads..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setCurrentPageNum(1)
                    }}
                    className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>

                {/* Filter By */}
                <div className="flex gap-2">
                  <GlobalFilterDropdown
                    leads={leads}
                    onSelect={(field, value) => {
                      setColumnFilters((prev) => {
                        const newFilters = { ...prev }
                        const currentFilters = new Set(newFilters[field])
                        currentFilters.add(value)
                        newFilters[field] = currentFilters
                        return newFilters
                      })
                      setCurrentPageNum(1)
                    }}
                  />

                  {/* Sort By */}
                  <select
                    className="px-4 py-2 bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm min-w-[180px]"
                    value={`${sortBy}:${sortOrder}`}
                    onChange={(e) => {
                      const [field, order] = e.target.value.split(":")
                      setSortBy(field)
                      setSortOrder(order as "asc" | "desc")
                    }}
                  >
                    <option value="created_at:desc">Sort: Newest First</option>
                    <option value="created_at:asc">Sort: Oldest First</option>
                    <option value="company_name:asc">Sort: Name (A-Z)</option>
                    <option value="company_name:desc">Sort: Name (Z-A)</option>
                    <option value="status:asc">Sort: Status (New → Lost)</option>
                    <option value="status:desc">Sort: Status (Lost → New)</option>
                    <option value="category_name:asc">Sort: Category (A-Z)</option>
                    <option value="category_name:desc">Sort: Category (Z-A)</option>
                  </select>
                </div>
              </div>

              {/* Active Filters Display */}
              {Object.entries(columnFilters).some(([_, values]) => values.size > 0) && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-muted-foreground">Active Filters:</span>
                  {Object.entries(columnFilters).map(([column, values]) =>
                    Array.from(values).map((value) => (
                      <Badge
                        key={`${column}:${value}`}
                        variant="outline"
                        className="bg-primary/10 border-primary/30 text-primary flex items-center gap-1"
                      >
                        {value}
                        <button
                          onClick={() => {
                            setColumnFilters((prev) => {
                              const newFilters = { ...prev }
                              newFilters[column].delete(value)
                              return newFilters
                            })
                          }}
                          className="hover:bg-primary/20 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                  <button
                    onClick={() => {
                      setColumnFilters({
                        company_name: new Set(),
                        mobile_number: new Set(),
                        email: new Set(),
                        city: new Set(),
                        category_name: new Set(),
                        sub_category_name: new Set(),
                        status: new Set(),
                        sales_person_name: new Set(),
                      })
                    }}
                    className="text-xs text-destructive hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              )}

              {/* Bulk Operations - Always Show Space */}
              <div className={`transition-all duration-200 ${selectedLeads.size > 0 ? "opacity-100" : "opacity-0 hidden"}`}>
                <div className="bg-secondary/50 border border-border rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {selectedLeads.size} lead(s) selected
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => setShowBulkSalesPerson(!showBulkSalesPerson)}
                      className="bg-primary hover:bg-primary/90"
                    >
                      Change Sales Person
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (selectedLeads.size === 0) {
                          toast.warning("No leads selected")
                          return
                        }

                        const confirmDelete = window.confirm(
                          `Delete ${selectedLeads.size} lead(s)? This cannot be undone.`
                        )

                        if (!confirmDelete) return

                        try {
                          const deletePromises = Array.from(selectedLeads).map((leadId) =>
                            leadsAPI.delete(leadId)
                          )

                          await Promise.all(deletePromises)

                          toast.success(`Successfully deleted ${selectedLeads.size} lead(s)`)
                          setSelectedLeads(new Set())
                          setShowBulkSalesPerson(false)
                          loadLeads()
                        } catch (error: any) {
                          toast.error(error.response?.data?.error || "Failed to delete leads")
                        }
                      }}
                      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Selected
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedLeads(new Set())
                        setShowBulkSalesPerson(false)
                      }}
                      className="bg-secondary border-border text-foreground hover:bg-muted"
                    >
                      Deselect All
                    </Button>
                  </div>

                  {showBulkSalesPerson && (
                    <div className="flex gap-2 pt-2 border-t border-border mt-2">
                      {teamMembers.length > 0 ? (
                        <>
                          <select
                            className="flex-1 px-3 py-1 bg-secondary border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            value={bulkSalesPersonName}
                            onChange={(e) => setBulkSalesPersonName(e.target.value)}
                          >
                            <option value="">-- Select Sales Person --</option>
                            {teamMembers.map((member: any) => (
                              <option key={member.id} value={member.name || member.full_name}>
                                {member.name || member.full_name}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            onClick={async () => {
                              if (!bulkSalesPersonName) {
                                toast.error("Please select a sales person")
                                return
                              }
                              try {
                                let successCount = 0
                                for (const leadId of selectedLeads) {
                                  try {
                                    const formData = new FormData()
                                    formData.append("sales_person_name", bulkSalesPersonName)
                                    await leadsAPI.update(leadId, formData)
                                    successCount++
                                  } catch {
                                    // Continue with other leads
                                  }
                                }
                                toast.success(`Updated ${successCount} lead(s)`)
                                await loadLeads()
                                setSelectedLeads(new Set())
                                setShowBulkSalesPerson(false)
                                setBulkSalesPersonName("")
                              } catch (error: any) {
                                toast.error("Failed to update leads")
                              }
                            }}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <input
                            type="text"
                            placeholder="Enter sales person name"
                            value={bulkSalesPersonName}
                            onChange={(e) => setBulkSalesPersonName(e.target.value)}
                            className="flex-1 px-3 py-1 bg-secondary border border-border rounded text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <Button
                            size="sm"
                            onClick={async () => {
                              if (!bulkSalesPersonName) {
                                toast.error("Please enter a sales person name")
                                return
                              }
                              try {
                                let successCount = 0
                                for (const leadId of selectedLeads) {
                                  try {
                                    const formData = new FormData()
                                    formData.append("sales_person_name", bulkSalesPersonName)
                                    await leadsAPI.update(leadId, formData)
                                    successCount++
                                  } catch {
                                    // Continue with other leads
                                  }
                                }
                                toast.success(`Updated ${successCount} lead(s)`)
                                await loadLeads()
                                setSelectedLeads(new Set())
                                setShowBulkSalesPerson(false)
                                setBulkSalesPersonName("")
                              } catch (error: any) {
                                toast.error("Failed to update leads")
                              }
                            }}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {paginatedLeads.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="text-sm bg-card w-full">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="text-left py-3 px-3 w-10 pl-10">
                          <input
                            type="checkbox"
                            checked={selectedLeads.size > 0 && selectedLeads.size === paginatedLeads.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLeads(new Set(paginatedLeads.map((l) => l.id)))
                              } else {
                                setSelectedLeads(new Set())
                              }
                            }}
                            className="w-4 h-4"
                          />
                        </th>
                        {columns.map((col) => (
                          <th key={col.key} className={`text-left py-3 px-3 font-medium text-muted-foreground whitespace-nowrap ${col.width}`}>
                            <span>{col.label}</span>
                          </th>
                        ))}
                        <th className="text-center py-3 px-3 font-medium text-muted-foreground w-24">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLeads.map((lead) => (
                        <tr key={lead.id} className="border-b border-border hover:bg-muted/30">
                          <td className="text-left py-3 px-3 w-10 pl-10">
                            <input
                              type="checkbox"
                              checked={selectedLeads.has(lead.id)}
                              onChange={(e) => {
                                const newSelected = new Set(selectedLeads)
                                if (e.target.checked) {
                                  newSelected.add(lead.id)
                                } else {
                                  newSelected.delete(lead.id)
                                }
                                setSelectedLeads(newSelected)
                              }}
                              className="w-4 h-4"
                            />
                          </td>
                          {editingLeadId === lead.id ? (
                            <>
                              <td className="p-1">
                                <input
                                  type="text"
                                  value={editForm[lead.id]?.company_name || lead.company_name || ""}
                                  onChange={(e) =>
                                    setEditForm((prev) => ({
                                      ...prev,
                                      [lead.id]: {
                                        ...prev[lead.id],
                                        company_name: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full h-full px-2 py-1 bg-secondary border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                              </td>
                              <td className="p-1">
                                <input
                                  type="text"
                                  value={editForm[lead.id]?.mobile_number || lead.mobile_number || ""}
                                  onChange={(e) =>
                                    setEditForm((prev) => ({
                                      ...prev,
                                      [lead.id]: {
                                        ...prev[lead.id],
                                        mobile_number: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full h-full px-2 py-1 bg-secondary border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                              </td>
                              <td className="p-1">
                                <input
                                  type="text"
                                  value={editForm[lead.id]?.email || lead.email || ""}
                                  onChange={(e) =>
                                    setEditForm((prev) => ({
                                      ...prev,
                                      [lead.id]: {
                                        ...prev[lead.id],
                                        email: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full h-full px-2 py-1 bg-secondary border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                              </td>
                              <td className="p-1">
                                <input
                                  type="text"
                                  value={editForm[lead.id]?.city || lead.city || ""}
                                  onChange={(e) =>
                                    setEditForm((prev) => ({
                                      ...prev,
                                      [lead.id]: {
                                        ...prev[lead.id],
                                        city: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full h-full px-2 py-1 bg-secondary border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                              </td>
                              <td className="p-1">
                                <select
                                  className="w-full h-full px-2 py-1 bg-secondary border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                  value={editForm[lead.id]?.category_id || lead.category?.toString() || ""}
                                  onChange={(e) => {
                                    const categoryId = e.target.value
                                    setEditForm((prev) => ({
                                      ...prev,
                                      [lead.id]: {
                                        ...prev[lead.id],
                                        category_id: categoryId,
                                        subcategory_id: "",
                                      },
                                    }))
                                    if (categoryId) {
                                      loadEditLeadSubcategories(lead.id, parseInt(categoryId))
                                    }
                                  }}
                                >
                                  <option value="">-- Select --</option>
                                  {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                      {cat.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-1">
                                <select
                                  className="w-full h-full px-2 py-1 bg-secondary border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                  value={editForm[lead.id]?.subcategory_id || lead.sub_category?.toString() || ""}
                                  onChange={(e) =>
                                    setEditForm((prev) => ({
                                      ...prev,
                                      [lead.id]: {
                                        ...prev[lead.id],
                                        subcategory_id: e.target.value,
                                      },
                                    }))
                                  }
                                  disabled={!editForm[lead.id]?.category_id && !lead.category}
                                >
                                  <option value="">-- Select --</option>
                                  {(editLeadSubcategories[lead.id] ||
                                    categories.find((c) => c.id === (editForm[lead.id]?.category_id ? parseInt(editForm[lead.id].category_id!) : lead.category))?.subcategories ||
                                    []
                                  ).map((subcat) => (
                                    <option key={subcat.id} value={subcat.id}>
                                      {subcat.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-1">
                                <select
                                  className="w-full h-full px-2 py-1 bg-secondary border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                  value={editForm[lead.id]?.status || lead.status || "new"}
                                  onChange={(e) =>
                                    setEditForm((prev) => ({
                                      ...prev,
                                      [lead.id]: {
                                        ...prev[lead.id],
                                        status: e.target.value as any,
                                      },
                                    }))
                                  }
                                >
                                  <option value="new">New</option>
                                  <option value="contacted">Contacted</option>
                                  <option value="qualified">Qualified</option>
                                  <option value="converted">Converted</option>
                                  <option value="lost">Lost</option>
                                </select>
                              </td>
                              <td className="p-1">
                                <select
                                  className="w-full h-full px-2 py-1 bg-secondary border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                  value={editForm[lead.id]?.sales_person_name || lead.sales_person_name || ""}
                                  onChange={(e) =>
                                    setEditForm((prev) => ({
                                      ...prev,
                                      [lead.id]: {
                                        ...prev[lead.id],
                                        sales_person_name: e.target.value,
                                      },
                                    }))
                                  }
                                >
                                  <option value="">-- Select --</option>
                                  {teamMembers.map((member: any) => (
                                    <option key={member.id} value={member.name || member.full_name}>
                                      {member.name || member.full_name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <div className="flex justify-center gap-2">
                                  <button
                                    className="p-1 hover:bg-green-500/20 rounded transition-colors"
                                    onClick={async () => {
                                      try {
                                        const formData = new FormData()
                                        // Always send all fields, use editForm value or original lead value
                                        formData.append(
                                          "company_name",
                                          editForm[lead.id]?.company_name ?? lead.company_name ?? ""
                                        )
                                        formData.append(
                                          "mobile_number",
                                          editForm[lead.id]?.mobile_number ?? lead.mobile_number ?? ""
                                        )
                                        formData.append(
                                          "email",
                                          editForm[lead.id]?.email ?? lead.email ?? ""
                                        )
                                        formData.append(
                                          "city",
                                          editForm[lead.id]?.city ?? lead.city ?? ""
                                        )
                                        formData.append(
                                          "sales_person_name",
                                          editForm[lead.id]?.sales_person_name ?? lead.sales_person_name ?? ""
                                        )
                                        formData.append(
                                          "status",
                                          editForm[lead.id]?.status ?? lead.status ?? "new"
                                        )
                                        if (editForm[lead.id]?.category_id || lead.category) {
                                          formData.append(
                                            "category_id",
                                            editForm[lead.id]?.category_id ?? lead.category?.toString() ?? ""
                                          )
                                        }
                                        if (editForm[lead.id]?.subcategory_id || lead.sub_category) {
                                          formData.append(
                                            "subcategory_id",
                                            editForm[lead.id]?.subcategory_id ?? lead.sub_category?.toString() ?? ""
                                          )
                                        }

                                        await leadsAPI.update(lead.id, formData)
                                        toast.success("Lead updated successfully!")
                                        setEditingLeadId(null)
                                        setEditForm((prev) => {
                                          const newForm = { ...prev }
                                          delete newForm[lead.id]
                                          return newForm
                                        })
                                        await loadLeads()
                                      } catch (error: any) {
                                        toast.error(
                                          error.response?.data?.error || "Failed to update lead"
                                        )
                                      }
                                    }}
                                    title="Save"
                                  >
                                    <Save className="w-4 h-4 text-green-500" />
                                  </button>
                                  <button
                                    className="p-1 hover:bg-secondary rounded transition-colors"
                                    onClick={() => setEditingLeadId(null)}
                                    title="Cancel"
                                  >
                                    <X className="w-4 h-4 text-muted-foreground" />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-3 px-3">
                                <CoolTooltip content={lead.company_name}>
                                  <div className="truncate w-full max-w-[120px]">
                                    {lead.company_name || "--"}
                                  </div>
                                </CoolTooltip>
                              </td>
                              <td className="py-3 px-3">
                                <CoolTooltip content={lead.mobile_number}>
                                  <div className="truncate w-full max-w-[120px]">
                                    {lead.mobile_number || "--"}
                                  </div>
                                </CoolTooltip>
                              </td>
                              <td className="py-3 px-3">
                                <CoolTooltip content={lead.email}>
                                  <div className="truncate w-full max-w-[120px]">
                                    {lead.email || "--"}
                                  </div>
                                </CoolTooltip>
                              </td>
                              <td className="py-3 px-3">
                                <CoolTooltip content={lead.city}>
                                  <div className="truncate w-full max-w-[120px]">
                                    {lead.city || "--"}
                                  </div>
                                </CoolTooltip>
                              </td>
                              <td className="py-3 px-3">
                                <CoolTooltip content={lead.category_name}>
                                  <div className="truncate w-full max-w-[120px]">
                                    {lead.category_name || "--"}
                                  </div>
                                </CoolTooltip>
                              </td>
                              <td className="py-3 px-3">
                                <CoolTooltip content={lead.sub_category_name}>
                                  <div className="truncate w-full max-w-[120px]">
                                    {lead.sub_category_name || "--"}
                                  </div>
                                </CoolTooltip>
                              </td>
                              <td className="py-3 px-3">
                                <StatusBadge status={lead.status} />
                              </td>
                              <td className="py-3 px-3">
                                <CoolTooltip content={lead.sales_person_name}>
                                  <div className="truncate w-full max-w-[120px]">
                                    {lead.sales_person_name || "--"}
                                  </div>
                                </CoolTooltip>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <div className="flex justify-center gap-2">
                                  <button
                                    className="p-1 hover:bg-secondary rounded transition-colors"
                                    onClick={() => {
                                      setEditingLeadId(lead.id)
                                      setEditForm((prev) => ({
                                        ...prev,
                                        [lead.id]: {
                                          company_name: lead.company_name,
                                          mobile_number: lead.mobile_number,
                                          email: lead.email,
                                          city: lead.city,
                                          sales_person_name: lead.sales_person_name || "",
                                          status: lead.status,
                                          category_id: lead.category?.toString() || "",
                                          subcategory_id: lead.sub_category?.toString() || "",
                                        },
                                      }))
                                      // Load subcategories if category exists
                                      if (lead.category) {
                                        loadEditLeadSubcategories(lead.id, lead.category)
                                      }
                                    }}
                                    title="Edit"
                                  >
                                    <Edit2 className="w-4 h-4 text-primary" />
                                  </button>
                                  <button
                                    className="p-1 hover:bg-destructive/10 rounded transition-colors"
                                    onClick={() => handleDeleteLead(lead.id, lead.company_name || "Lead")}
                                    title="Delete"
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination - Bottom */}
                {(totalPages > 0 || true) && (
                  <div className="flex justify-center items-center gap-3 mt-8 pt-6 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPageNum((prev) => Math.max(1, prev - 1))}
                      disabled={currentPageNum === 1}
                      className="bg-secondary border-border text-foreground hover:bg-muted transition-all duration-200 font-semibold"
                    >
                      ← Previous
                    </Button>

                    {/* Page Numbers */}
                    <div className="flex gap-2">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((page) => {
                          if (totalPages <= 7) return true
                          if (page === 1 || page === totalPages) return true
                          if (page >= currentPageNum - 1 && page <= currentPageNum + 1) return true
                          return false
                        })
                        .map((page, idx, arr) => {
                          if (idx > 0 && arr[idx - 1] + 1 < page) {
                            return (
                              <span key={`dots-${page}`} className="px-3 text-muted-foreground font-semibold">
                                ...
                              </span>
                            )
                          }
                          return (
                            <Button
                              key={page}
                              size="sm"
                              onClick={() => setCurrentPageNum(page)}
                              variant={page === currentPageNum ? "primary" : "outline"}
                              className={`transition-all duration-200 font-semibold min-w-10 ${page === currentPageNum
                                ? "bg-primary hover:bg-primary/90 text-white shadow-lg"
                                : "bg-secondary border-border text-foreground hover:bg-muted/70"
                                }`}
                            >
                              {page}
                            </Button>
                          )
                        })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPageNum((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPageNum === totalPages}
                      className="bg-secondary border-border text-foreground hover:bg-muted transition-all duration-200 font-semibold"
                    >
                      Next →
                    </Button>

                    {/* Page Info */}
                    <div className="text-center ml-4 pl-4 border-l border-border flex items-center gap-4">
                      <p className="text-sm font-semibold text-foreground">
                        Page <span className="text-primary">{currentPageNum}</span> of{" "}
                        <span className="text-primary">{totalPages}</span>
                      </p>

                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Rows per page:</span>
                        <select
                          className="px-2 py-1 bg-secondary border border-border rounded text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          value={itemsPerPage}
                          onChange={(e) => {
                            setItemsPerPage(Number(e.target.value))
                            setCurrentPageNum(1)
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
                <p className="text-muted-foreground">
                  {searchQuery || Object.values(columnFilters).some((v) => v.size > 0)
                    ? "No leads match your filters"
                    : "No leads yet. Add some to get started!"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
                Are you sure you want to delete lead "{deleteConf.title}"?
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
    </div>
  )
}
