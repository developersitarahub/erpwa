import { Router } from "express";
import {
  getAllRecipients,
  getSessionActiveRecipients,
} from "../controllers/recipient.controller.js";

const router = Router();

router.get("/all", getAllRecipients);
router.get("/session-active", getSessionActiveRecipients);

export default router;
