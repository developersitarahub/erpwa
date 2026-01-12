import express from "express";
import multer from "multer";
import { authenticate } from "../middleware/auth.middleware.js";
import GalleryController from "../controllers/gallery.controller.js";

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// All routes require authentication
router.use(authenticate);

// Gallery routes
router.get("/", GalleryController.list);
router.post("/", GalleryController.create);
router.post("/bulk", GalleryController.bulkCreate);
router.post(
  "/upload",
  upload.array("images", 200), // Reduced from 500 to 200 for server stability
  (err, req, res, next) => {
    // Handle multer errors
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File size too large. Maximum 10MB per file." });
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({ error: "Too many files. Maximum 200 files allowed per upload." });
      }
      return res.status(400).json({ error: err.message });
    }
    if (err) {
      return res.status(400).json({ error: err.message || "File upload error" });
    }
    next();
  },
  GalleryController.handleUpload
);
router.delete("/bulk", GalleryController.bulkDelete);
router.get("/:id", GalleryController.getById);
router.put("/:id", GalleryController.update);
router.delete("/:id", GalleryController.delete);
router.post(
  "/send-bulk",
  authenticate,
  GalleryController.sendBulkCampaign
);

export default router;


