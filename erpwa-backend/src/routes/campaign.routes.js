import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import CampaignController from "../controllers/campaign.controller.js";

const router = express.Router();

router.use(authenticate);

// Template campaign
router.post("/template", CampaignController.createTemplateCampaign);

// Image campaign
router.post("/image", CampaignController.createImageCampaign);

export default router;
