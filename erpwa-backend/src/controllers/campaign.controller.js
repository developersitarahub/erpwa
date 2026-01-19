import CampaignService from "../services/campaign.service.js";

class CampaignController {
  static async createTemplateCampaign(req, res) {
    try {
      const result = await CampaignService.createTemplateCampaign(
        req.user.vendorId,
        req.body
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  static async createImageCampaign(req, res) {
    try {
      console.log("Creating image campaign with payload:", JSON.stringify(req.body, null, 2));
      const result = await CampaignService.createImageCampaign(
        req.user.vendorId,
        req.body
      );
      res.json(result);
    } catch (err) {
      console.error("Image campaign creation error:", err.message);
      console.error("Stack trace:", err.stack);
      res.status(400).json({ error: err.message });
    }
  }

  static async listCampaigns(req, res) {
    try {
      const result = await CampaignService.listCampaigns(req.user.vendorId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

export default CampaignController;
