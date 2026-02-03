import express from 'express';
import flowsController from '../controllers/flows.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * WhatsApp Flows Routes
 * All routes require authentication
 */

// Data Exchange Endpoint (Real) - Must be public for Meta
router.post('/endpoint', flowsController.handleFlowEndpoint);

// Apply authentication to all routes below
router.use(authenticate);

// Get all Flows for the vendor
router.get('/', flowsController.getFlows);

// Get a single Flow by ID
router.get('/:id', flowsController.getFlowById);

// Create a new Flow
router.post('/', flowsController.createFlow);

// Setup Encryption Keys
router.post('/setup-key', flowsController.setupFlowsEncryption);



// Update a Flow
router.put('/:id', flowsController.updateFlow);

// Publish a Flow (make it live)
router.post('/:id/publish', flowsController.publishFlow);

// Deprecate a Flow (prevent new sends)
router.post('/:id/deprecate', flowsController.deprecateFlow);

// Delete a Flow
router.delete('/:id', flowsController.deleteFlow);

// Get Flow metrics/analytics
router.get('/:id/metrics', flowsController.getFlowMetrics);

// Get Flow responses (user submissions)
router.get('/:id/responses', flowsController.getFlowResponses);

// Delete Flow response
router.delete('/:id/responses/:responseId', flowsController.deleteFlowResponse);

export default router;
