import GalleryService from "../services/gallery.service.js";
import CampaignService from "../services/campaign.service.js";

class GalleryController {
  /**
   * List gallery images with optional filtering and pagination
   * GET /api/gallery
   */
  static async list(req, res) {
    try {
      const filters = {
        category_id: req.query.category_id,
        subcategory_id: req.query.subcategory_id,
        sort_by: req.query.sort_by,
        sort_order: req.query.sort_order,
        filter_by: req.query.filter_by,
        filter_value: req.query.filter_value,
      };

      const pagination = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
      };

      const result = await GalleryService.list(
        req.user.vendorId,
        filters,
        pagination
      );
      res.json({ data: result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * Get gallery image by ID
   * GET /api/gallery/:id
   */
  static async getById(req, res) {
    try {
      const image = await GalleryService.getById(
        req.user.vendorId,
        req.params.id
      );

      if (!image) {
        return res.status(404).json({ error: "Gallery image not found" });
      }

      res.json({ data: image });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * Create a gallery image
   * POST /api/gallery
   */
  static async create(req, res) {
    try {
      const result = await GalleryService.create(req.user.vendorId, req.body);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * Bulk create gallery images
   * POST /api/gallery/bulk
   */
  static async bulkCreate(req, res) {
    try {
      const { images } = req.body;

      if (!Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: "Images array is required" });
      }

      const result = await GalleryService.bulkCreate(req.user.vendorId, images);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * Update a gallery image
   * PUT /api/gallery/:id
   */
  static async update(req, res) {
    try {
      const result = await GalleryService.update(
        req.user.vendorId,
        req.params.id,
        req.body
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * Delete a gallery image
   * DELETE /api/gallery/:id
   */
  static async delete(req, res) {
    try {
      const result = await GalleryService.delete(
        req.user.vendorId,
        req.params.id
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * Bulk delete gallery images
   * DELETE /api/gallery/bulk
   */
  static async bulkDelete(req, res) {
    try {
      const { image_ids } = req.body;

      if (!Array.isArray(image_ids) || image_ids.length === 0) {
        return res.status(400).json({ error: "Image IDs array is required" });
      }

      const result = await GalleryService.bulkDelete(
        req.user.vendorId,
        image_ids
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * Upload gallery images (multipart/form-data)
   * POST /api/gallery/upload
   */
  static async handleUpload(req, res) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No images provided" });
      }

      const category_id = req.body.category_id;
      const subcategory_id = req.body.subcategory_id;

      console.log(`📤 Uploading ${req.files.length} images to S3...`);

      // Upload files to S3
      const { uploadMultipleToS3 } = await import("../utils/s3.util.js");

      const filesToUpload = req.files.map((file) => ({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
      }));

      const uploadResults = await uploadMultipleToS3(filesToUpload, "gallery");

      // Create image entries with S3 URLs
      const imageEntries = uploadResults.map((result) => ({
        s3_url: result.cloudfrontUrl, // Use CloudFront URL for faster delivery
        s3_key: result.s3Key, // Store S3 key for deletion
        title: result.originalName.replace(/\.[^/.]+$/, ""), // Remove extension
        category_id: category_id,
        subcategory_id: subcategory_id || undefined,
      }));

      console.log(
        `✅ Successfully uploaded ${uploadResults.length} images to S3`
      );

      // If skipGallery is true, don't save to DB (use for direct device uploads)
      if (req.query.skipGallery === 'true') {
        return res.json({
          success: true,
          images: imageEntries.map(e => ({
            url: e.s3_url,
            s3_url: e.s3_url,
            title: e.title,
            id: Math.floor(Math.random() * -1000000).toString() // Return negative IDs for temp images
          })),
          message: `Successfully uploaded ${uploadResults.length} images (temporary)`
        });
      }

      // Use bulk create to save images
      const dbResult = await GalleryService.bulkCreate(
        req.user.vendorId,
        imageEntries
      );

      res.json({
        ...dbResult,
        message: `Successfully uploaded ${uploadResults.length} images`,
      });
    } catch (err) {
      console.error("Gallery upload error:", err);
      res.status(400).json({ error: err.message || "Failed to upload images" });
    }
  }

  static async sendBulkCampaign(req, res) {
    try {
      const vendorId = req.user.vendorId;

      const { categoryId, subCategoryId, captionMode, conversationIds, name } =
        req.body;

      const result = await CampaignService.createImageCampaign(vendorId, {
        name: name || `Gallery Campaign – ${new Date().toLocaleDateString()}`,
        categoryId,
        subCategoryId,
        captionMode,
        conversationIds,
      });

      res.json({
        success: true,
        message: "Campaign created and started",
        campaignId: result.campaignId,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
}

export default GalleryController;
