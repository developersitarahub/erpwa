// Real API wrapper for gallery - connects to backend
import api from './api'
import type { ApiResponse, GalleryImage } from './types'

export const galleryAPI = {
  /**
   * List gallery images with optional filtering and pagination
   */
  list: async (
    categoryId?: number,
    subcategoryId?: number,
    page: number = 1,
    limit: number = 20,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    filterBy?: string,
    filterValue?: string
  ): Promise<ApiResponse<{ images: GalleryImage[]; total: number; page: number; limit: number; hasMore: boolean }>> => {
    const params = new URLSearchParams()
    if (categoryId) params.append('category_id', categoryId.toString())
    if (subcategoryId) params.append('subcategory_id', subcategoryId.toString())
    if (sortBy) params.append('sort_by', sortBy)
    if (sortOrder) params.append('sort_order', sortOrder)
    if (filterBy) params.append('filter_by', filterBy)
    if (filterValue) params.append('filter_value', filterValue)
    params.append('page', page.toString())
    params.append('limit', limit.toString())

    const queryString = params.toString()
    const url = `/gallery${queryString ? `?${queryString}` : ''}`

    const response = await api.get(url)
    return { data: response.data.data || response.data }
  },

  /**
   * Get gallery image by ID
   */
  detail: async (id: number): Promise<ApiResponse<GalleryImage>> => {
    const response = await api.get(`/gallery/${id}`)
    return { data: response.data.data || response.data }
  },

  /**
   * Create a gallery image
   * Note: s3_url should be provided after uploading to S3
   */
  create: async (data: FormData): Promise<ApiResponse<any>> => {
    const body: any = {}
    if (data.get('s3_url')) body.s3_url = data.get('s3_url')
    if (data.get('title')) body.title = data.get('title')
    if (data.get('description')) body.description = data.get('description')
    if (data.get('price')) body.price = data.get('price')
    if (data.get('price_currency')) body.price_currency = data.get('price_currency')
    if (data.get('category_id')) body.category_id = data.get('category_id')
    if (data.get('subcategory_id')) body.subcategory_id = data.get('subcategory_id')

    const response = await api.post('/gallery', body)
    return { data: response.data }
  },

  /**
   * Bulk create gallery images
   */
  bulkCreate: async (images: any[]): Promise<ApiResponse<any>> => {
    const response = await api.post('/gallery/bulk', { images })
    return { data: response.data }
  },

  /**
   * Update a gallery image
   */
  update: async (id: number, data: FormData): Promise<ApiResponse<any>> => {
    const body: any = {}
    if (data.get('title')) body.title = data.get('title')
    if (data.get('description')) body.description = data.get('description')
    if (data.get('price')) body.price = data.get('price')
    if (data.get('price_currency')) body.price_currency = data.get('price_currency')
    if (data.get('category_id')) body.category_id = data.get('category_id')
    if (data.get('subcategory_id')) body.subcategory_id = data.get('subcategory_id')

    const response = await api.put(`/gallery/${id}`, body)
    return { data: response.data }
  },

  /**
   * Delete a gallery image (accepts single ID or array of IDs)
   */
  delete: async (id: number | number[]): Promise<ApiResponse<any>> => {
    if (Array.isArray(id)) {
      // Bulk delete
      const response = await api.delete('/gallery/bulk', {
        data: { image_ids: id },
      })
      return { data: response.data }
    } else {
      // Single delete
      const response = await api.delete(`/gallery/${id}`)
      return { data: response.data }
    }
  },

  /**
   * Bulk delete gallery images
   */
  bulkDelete: async (imageIds: number[]): Promise<ApiResponse<any>> => {
    const response = await api.delete('/gallery/bulk', {
      data: { image_ids: imageIds },
    })
    return { data: response.data }
  },

  /**
   * Upload images with files
   * Sends FormData with images to backend
   */
  upload: async (data: FormData, skipGallery: boolean = false): Promise<ApiResponse<any>> => {
    // Send FormData directly to upload endpoint
    // Don't set Content-Type header - axios will set it automatically with boundary
    const url = `/gallery/upload${skipGallery ? '?skipGallery=true' : ''}`
    const response = await api.post(url, data)
    return { data: response.data }
  },
}
