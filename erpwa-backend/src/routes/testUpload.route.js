import express from "express";
import { upload } from "../middleware/upload.middleware.js";
import { uploadTemplateMediaToS3 } from "../services/templateMedia.service.js";

const router = express.Router();

router.post(
  "/upload-template-media",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const result = await uploadTemplateMediaToS3({
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        vendorId: "test-vendor",
        templateId: "test-template",
        language: "en_US",
        extension: req.file.originalname.split(".").pop(),
      });

      res.json({
        success: true,
        url: result.url,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

export default router;
