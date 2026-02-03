import prisma from '../prisma.js';
import flowsService from '../services/flows.service.js';
import { decrypt, encrypt } from '../utils/encryption.js';
import crypto from 'crypto';

/**
 * WhatsApp Flows Controller
 * Handles all Flow management operations
 */

/**
 * Get all Flows for a vendor
 */
export const getFlows = async (req, res) => {
    try {
        const { vendorId } = req.user;

        const flows = await prisma.whatsAppFlow.findMany({
            where: { vendorId },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: {
                        responses: true
                    }
                }
            }
        });

        // Calculate template usage counts for each flow
        const enrichedFlows = await Promise.all(flows.map(async (flow) => {
            const templateCount = await prisma.templateButton.count({
                where: { flowId: flow.id }
            });
            return {
                ...flow,
                _count: {
                    ...flow._count,
                    templates: templateCount
                }
            };
        }));

        res.json({ success: true, flows: enrichedFlows });
    } catch (error) {
        console.error('Error fetching Flows:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get a single Flow by ID
 */
export const getFlowById = async (req, res) => {
    try {
        const { vendorId } = req.user;
        const { id } = req.params;

        const flow = await prisma.whatsAppFlow.findFirst({
            where: { id, vendorId },
            include: {
                _count: {
                    select: {
                        responses: true
                    }
                }
            }
        });

        if (!flow) {
            return res.status(404).json({ success: false, message: 'Flow not found' });
        }

        // Count templates using this flow via buttons
        const templateCount = await prisma.templateButton.count({
            where: { flowId: id }
        });

        const flowWithCount = {
            ...flow,
            validationErrors: [], // Placeholder, populated below if possible
            _count: {
                ...flow._count,
                templates: templateCount
            }
        };

        // Try to fetch validation errors from Meta
        try {
            const vendor = await prisma.vendor.findUnique({
                where: { id: vendorId },
                select: { whatsappAccessToken: true }
            });
            if (vendor) {
                const accessToken = decrypt(vendor.whatsappAccessToken);
                // We use our service to get errors
                // Note: This adds latency, but vital for debugging
                const errors = await flowsService.getValidationErrors(flow.metaFlowId, accessToken);
                flowWithCount.validationErrors = errors;
            }
        } catch (err) {
            // Ignore token errors, just return flow
        }

        res.json({ success: true, flow: flowWithCount });
    } catch (error) {
        console.error('Error fetching Flow:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Create a new Flow
 */
export const createFlow = async (req, res) => {
    try {
        const { vendorId } = req.user;
        const { name, category, flowJson, endpointUri } = req.body;

        // Validate required fields
        if (!name || !category) {
            return res.status(400).json({
                success: false,
                message: 'Name and category are required'
            });
        }

        // Get vendor's WhatsApp credentials
        const vendor = await prisma.vendor.findUnique({
            where: { id: vendorId },
            select: {
                whatsappBusinessId: true,
                whatsappAccessToken: true
            }
        });

        if (!vendor.whatsappBusinessId || !vendor.whatsappAccessToken) {
            return res.status(400).json({
                success: false,
                message: 'WhatsApp Business Account not configured'
            });
        }

        // Decrypt the access token
        const accessToken = decrypt(vendor.whatsappAccessToken);

        // Create Flow in Meta's system
        const metaFlow = await flowsService.createFlow(
            vendor.whatsappBusinessId,
            name,
            [category.toUpperCase()],
            accessToken
        );

        // If Flow JSON is provided, update it
        if (flowJson) {
            await flowsService.updateFlowJSON(
                metaFlow.id,
                flowJson,
                accessToken
            );
        }

        // Save to database
        const flow = await prisma.whatsAppFlow.create({
            data: {
                vendorId,
                metaFlowId: metaFlow.id,
                name,
                category,
                status: 'DRAFT',
                flowJson: flowJson || {},
                endpointUri
            }
        });

        res.json({ success: true, flow });
    } catch (error) {
        console.error('Error creating Flow:', error);

        let message = error.message;
        try {
            // Try to parse Meta error message
            const metaError = JSON.parse(error.message);
            if (metaError.error_user_msg) {
                message = metaError.error_user_msg;
            } else if (metaError.message) {
                message = metaError.message;
            }
        } catch (e) {
            // Not a JSON error, use original message
        }

        res.status(500).json({ success: false, message });
    }
};

/**
 * Update a Flow
 */
export const updateFlow = async (req, res) => {
    try {
        const { vendorId } = req.user;
        const { id } = req.params;
        const { name, category, flowJson, endpointUri } = req.body;

        // Check if Flow exists and belongs to vendor
        const existingFlow = await prisma.whatsAppFlow.findFirst({
            where: { id, vendorId }
        });

        if (!existingFlow) {
            return res.status(404).json({ success: false, message: 'Flow not found' });
        }

        // Get vendor credentials
        const vendor = await prisma.vendor.findUnique({
            where: { id: vendorId },
            select: { whatsappAccessToken: true }
        });

        const accessToken = decrypt(vendor.whatsappAccessToken);

        // Update Flow JSON in Meta if provided
        if (flowJson) {
            const screenCount = flowJson.screens ? flowJson.screens.length : 0;
            console.log(`📝 Updating Flow JSON with ${screenCount} screens`);
            console.log(`Screen IDs:`, flowJson.screens?.map(s => s.id) || []);

            await flowsService.updateFlowJSON(
                existingFlow.metaFlowId,
                flowJson,
                accessToken
            );
        }

        // Update Flow Metadata (Endpoint URI, Categories) in Meta if provided
        if (endpointUri !== undefined || category) {
            const updates = {};
            if (endpointUri !== undefined) updates.endpoint_uri = endpointUri;

            // Meta expects categories as array
            if (category) updates.categories = [category.toUpperCase()]; // Ensure format

            if (Object.keys(updates).length > 0) {
                await flowsService.updateFlowMetadata(
                    existingFlow.metaFlowId,
                    updates,
                    accessToken
                );
            }
        }

        // Update in database
        const flow = await prisma.whatsAppFlow.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(category && { category }),
                ...(flowJson && { flowJson }),
                ...(endpointUri !== undefined && { endpointUri })
            }
        });

        res.json({ success: true, flow });
    } catch (error) {
        console.error('Error updating Flow:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Publish a Flow
 */
export const publishFlow = async (req, res) => {
    try {
        const { vendorId } = req.user;
        const { id } = req.params;

        // Check if Flow exists
        const flow = await prisma.whatsAppFlow.findFirst({
            where: { id, vendorId }
        });

        if (!flow) {
            return res.status(404).json({ success: false, message: 'Flow not found' });
        }

        if (flow.status === 'PUBLISHED') {
            return res.status(400).json({
                success: false,
                message: 'Flow is already published'
            });
        }

        // Get vendor credentials
        const vendor = await prisma.vendor.findUnique({
            where: { id: vendorId },
            select: { whatsappAccessToken: true }
        });

        const accessToken = decrypt(vendor.whatsappAccessToken);

        // Ensure 'endpoint_uri' is set on Meta before publishing
        if (flow.endpointUri) {
            try {
                await flowsService.updateFlowMetadata(
                    flow.metaFlowId,
                    { endpoint_uri: flow.endpointUri },
                    accessToken
                );
            } catch (metaUpdateErr) {
                console.warn("Failed to sync endpoint_uri before publish:", metaUpdateErr.message);
                // Proceeding might fail, but let's try or return error?
                // Usually if this fails, publish will also fail, so we can let it slide or stop.
            }
        } else {
            // If it's a v3 flow (Data Exchange), it MUST have an endpoint.
            // We can't easily distinguish v2 vs v3 here without parsing JSON, but most are v3.
            return res.status(400).json({
                success: false,
                message: 'Endpoint URI is missing. Please Edit the Flow and set the "Endpoint URI" before publishing.'
            });
        }

        // Publish in Meta
        await flowsService.publishFlow(flow.metaFlowId, accessToken);

        // Update status in database
        const updatedFlow = await prisma.whatsAppFlow.update({
            where: { id },
            data: {
                status: 'PUBLISHED',
                publishedAt: new Date()
            }
        });

        res.json({ success: true, flow: updatedFlow });
    } catch (error) {
        console.error('Error publishing Flow:', error);

        // Fetch detailed validation errors if it's a validation issue
        let validationErrors = [];
        try {
            // Need to get access token again
            const { vendorId } = req.user;
            const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { whatsappAccessToken: true } });
            if (vendor) {
                const accessToken = decrypt(vendor.whatsappAccessToken);
                const existingFlow = await prisma.whatsAppFlow.findFirst({ where: { id: req.params.id } });
                if (existingFlow) {
                    validationErrors = await flowsService.getValidationErrors(existingFlow.metaFlowId, accessToken);
                }
            }
        } catch (err) { console.error('Failed to get validation errors:', err); }

        res.status(500).json({
            success: false,
            message: error.message,
            validationErrors
        });
    }
};

/**
 * Deprecate a Flow
 */
export const deprecateFlow = async (req, res) => {
    try {
        const { vendorId } = req.user;
        const { id } = req.params;

        // Check if Flow exists
        const flow = await prisma.whatsAppFlow.findFirst({
            where: { id, vendorId }
        });

        if (!flow) {
            return res.status(404).json({ success: false, message: 'Flow not found' });
        }

        // Get vendor credentials
        const vendor = await prisma.vendor.findUnique({
            where: { id: vendorId },
            select: { whatsappAccessToken: true }
        });

        const accessToken = decrypt(vendor.whatsappAccessToken);

        // Deprecate in Meta
        await flowsService.deprecateFlow(flow.metaFlowId, accessToken);

        // Update status in database
        const updatedFlow = await prisma.whatsAppFlow.update({
            where: { id },
            data: {
                status: 'DEPRECATED',
                deprecatedAt: new Date()
            }
        });

        res.json({ success: true, flow: updatedFlow });
    } catch (error) {
        console.error('Error deprecating Flow:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Delete a Flow
 */
export const deleteFlow = async (req, res) => {
    try {
        const { vendorId } = req.user;
        const { id } = req.params;

        // Check if Flow exists
        const flow = await prisma.whatsAppFlow.findFirst({
            where: { id, vendorId }
        });

        if (!flow) {
            return res.status(404).json({ success: false, message: 'Flow not found' });
        }

        // Get vendor credentials
        const vendor = await prisma.vendor.findUnique({
            where: { id: vendorId },
            select: { whatsappAccessToken: true }
        });

        const accessToken = decrypt(vendor.whatsappAccessToken);

        // Delete from Meta
        try {
            await flowsService.deleteFlow(flow.metaFlowId, accessToken);
        } catch (error) {
            console.warn('Warning: Failed to delete Flow from Meta, but will remove from database:', error.message);
        }

        // Delete from database
        await prisma.whatsAppFlow.delete({
            where: { id }
        });

        res.json({ success: true, message: 'Flow deleted successfully' });
    } catch (error) {
        console.error('Error deleting Flow:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get Flow Responses
 */
export const getFlowResponses = async (req, res) => {
    try {
        const { vendorId } = req.user;
        const { id: flowId } = req.params;
        const { page = 1, limit = 20, status } = req.query;

        // Verify Flow belongs to vendor
        const flow = await prisma.whatsAppFlow.findFirst({
            where: { id: flowId, vendorId }
        });

        if (!flow) {
            return res.status(404).json({ success: false, message: 'Flow not found' });
        }

        // Build query
        const where = {
            flowId,
            conversation: {
                vendorId
            }
        };

        if (status && status !== 'all') {
            where.status = status;
        }

        // Get total count
        const total = await prisma.flowResponse.count({ where });

        // Get responses with pagination
        const responses = await prisma.flowResponse.findMany({
            where,
            include: {
                conversation: {
                    include: {
                        lead: {
                            select: {
                                companyName: true,
                                phoneNumber: true,
                                email: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip: (parseInt(page) - 1) * parseInt(limit),
            take: parseInt(limit)
        });

        res.json({
            success: true,
            responses,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching Flow responses:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Delete a Flow Response
 */
export const deleteFlowResponse = async (req, res) => {
    try {
        const { vendorId } = req.user;
        const { id: flowId, responseId } = req.params;

        // Verify Flow Response belongs to vendor (via Flow -> Vendor)
        const response = await prisma.flowResponse.findFirst({
            where: {
                id: responseId,
                flowId: flowId,
                conversation: {
                    vendorId
                }
            }
        });

        if (!response) {
            return res.status(404).json({ success: false, message: 'Response not found or access denied' });
        }

        // Delete response
        await prisma.flowResponse.delete({
            where: { id: responseId }
        });

        res.json({ success: true, message: 'Response deleted successfully' });
    } catch (error) {
        console.error('Error deleting Flow response:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};



/**
 * Get Flow metrics/analytics
 */
export const getFlowMetrics = async (req, res) => {
    try {
        const { vendorId } = req.user;
        const { id } = req.params;

        // Check if Flow exists
        const flow = await prisma.whatsAppFlow.findFirst({
            where: { id, vendorId }
        });

        if (!flow) {
            return res.status(404).json({ success: false, message: 'Flow not found' });
        }

        // Get local metrics from database
        const responses = await prisma.flowResponse.groupBy({
            by: ['status'],
            where: { flowId: id },
            _count: true
        });

        const totalResponses = await prisma.flowResponse.count({
            where: { flowId: id }
        });

        const completedResponses = await prisma.flowResponse.count({
            where: { flowId: id, status: 'completed' }
        });

        const metrics = {
            totalResponses,
            completedResponses,
            abandonedResponses: totalResponses - completedResponses,
            completionRate: totalResponses > 0 ? (completedResponses / totalResponses) * 100 : 0,
            statusBreakdown: responses
        };

        // Try to get Meta metrics (if available)
        try {
            const vendor = await prisma.vendor.findUnique({
                where: { id: vendorId },
                select: { whatsappAccessToken: true }
            });

            const accessToken = decrypt(vendor.whatsappAccessToken);

            // const metaMetrics = await flowsService.getFlowMetrics(
            //     flow.metaFlowId,
            //     accessToken
            // );

            // if (metaMetrics) {
            //     metrics.meta = metaMetrics;
            // }
        } catch (error) {
            console.warn('Could not fetch Meta metrics:', error.message);
        }

        res.json({ success: true, metrics });
    } catch (error) {
        console.error('Error fetching Flow metrics:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get Flow responses (user submissions)
 */

/**
 * Setup Flow Encryption (Generate Keys and Upload to Meta)
 */
export const setupFlowsEncryption = async (req, res) => {
    try {
        const { vendorId } = req.user;

        // Get vendor credentials
        const vendor = await prisma.vendor.findUnique({
            where: { id: vendorId },
            select: {
                whatsappBusinessId: true,
                whatsappPhoneNumberId: true,
                whatsappAccessToken: true
            }
        });

        if (!vendor.whatsappBusinessId || !vendor.whatsappAccessToken || !vendor.whatsappPhoneNumberId) {
            return res.status(400).json({ success: false, message: 'WhatsApp not configured fully' });
        }

        const accessToken = decrypt(vendor.whatsappAccessToken);

        // 1. Generate RSA Key Pair (2048 bit)
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });

        // 2. Upload Public Key to Meta

        await flowsService.updatePublicKey(
            vendor.whatsappPhoneNumberId,
            publicKey,
            accessToken
        );

        // 3. Save to Database
        await prisma.vendor.update({
            where: { id: vendorId },
            data: {
                whatsappFlowsPublicKey: publicKey,
                whatsappFlowsPrivateKey: encrypt(privateKey)
            }
        });

        res.json({ success: true, message: 'Flow encryption keys generated and uploaded successfully' });
    } catch (error) {
        console.error('Error setting up Flow encryption:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

import { decryptRequest, encryptResponse } from '../utils/flowsCrypto.js';

/**
 * Handle Flow Data Exchange Endpoint
 * Receives encrypted payload from Meta, decrypts it, processes request, and returns encrypted response.
 */
export const handleFlowEndpoint = async (req, res) => {
    try {
        const { encrypted_flow_data, encrypted_aes_key, initial_vector } = req.body;
        console.log("📨 RAW FLOW REQUEST RECEIVED:", JSON.stringify({ ...req.body, encrypted_flow_data: "..." }));

        if (!encrypted_flow_data || !encrypted_aes_key || !initial_vector) {
            return res.status(400).send('Missing required encrypted fields');
        }

        // 1. Get Vendor Private Key
        // In a multi-tenant system, the URL should ideally be /api/flows/:vendorId/endpoint
        // For now, we'll try to find the vendor who owns this Flow (if Flow ID is separate?) 
        // OR simply fetch the first vendor with a configured key (assuming single tenant context for now)
        const vendor = await prisma.vendor.findFirst({
            where: {
                whatsappFlowsPrivateKey: { not: null }
            }
        });

        if (!vendor) {
            console.error('No vendor found with configured Flow Private Key');
            return res.status(404).send('Flow configuration not found');
        }

        // 2. Decrypt Private Key (stored encrypted in DB)
        const privateKeyPem = decrypt(vendor.whatsappFlowsPrivateKey);

        // 3. Decrypt Request
        const { decryptedData, aesKey, iv } = decryptRequest(
            encrypted_aes_key,
            initial_vector,
            encrypted_flow_data,
            privateKeyPem
        );

        console.log('Flow Request:', decryptedData);

        const { action, screen, data } = decryptedData;
        let responsePayload = {};

        // 4. Handle Actions
        // Meta sends 'ping' for health checks
        // 4. Handle Actions
        // Meta sends 'ping' for health checks
        if (action === 'ping') {
            responsePayload = {
                data: {
                    status: 'active'
                }
            };
        } else if (action === 'INIT') {
            let startScreenId = "WELCOME"; // Fallback

            try {
                const flowToken = decryptedData.flow_token;
                if (flowToken) {
                    const parts = flowToken.split('_');
                    // Format: FLOWID_PHONE_TIMESTAMP
                    if (parts.length >= 1) {
                        const flowId = parts[0];
                        // Validate format (e.g., UUID-like or shorter ID)
                        if (flowId.length > 5) {
                            const flow = await prisma.whatsAppFlow.findUnique({
                                where: { id: flowId },
                                select: { flowJson: true }
                            });

                            if (flow && flow.flowJson) {
                                // Try to get start screen from preview or first screen in list
                                const json = typeof flow.flowJson === 'string' ? JSON.parse(flow.flowJson) : flow.flowJson;

                                if (json.screens && json.screens.length > 0) {
                                    // Default to first screen in the array
                                    startScreenId = json.screens[0].id;
                                    console.log(`✅ Dynamically resolved start screen: ${startScreenId} for Flow: ${flowId}`);
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Error fetching start screen:", err);
            }

            responsePayload = {
                screen: startScreenId,
                data: {
                    // Return any initial data needed by the form
                }
            };
        } else if (action === 'data_exchange') {
            console.log('📝 Flow Data Received:', JSON.stringify(decryptedData, null, 2));

            const submissionData = { ...(decryptedData.data || {}) };
            // Remove internal navigation fields from stored data
            delete submissionData.next_screen_id;

            let waId = decryptedData.user?.wa_id;
            const flowToken = decryptedData.flow_token;

            // Fallback: Extract waId from flow_token (Format: flowId_waId_timestamp)
            if (!waId && flowToken) {
                const parts = flowToken.split('_');
                if (parts.length >= 2) {
                    waId = parts[1];
                }
            }

            if (waId && vendor) {
                // Determine next screen EARLY to set status correctly
                const currentScreen = decryptedData.screen || "START";
                let nextScreen = "SUCCESS"; // Default fallback

                // 1. Check if next_screen_id was sent in payload
                if (decryptedData.data?.next_screen_id) {
                    nextScreen = decryptedData.data.next_screen_id;
                    console.log(`🧭 Using UI-defined next screen: ${nextScreen}`);
                }
                // 2. Fallback logic
                else {
                    if (currentScreen === "START") {
                        nextScreen = "Q";
                    } else if (currentScreen === "Q") {
                        nextScreen = "SUCCESS";
                    }
                }
                // 3. Determine Status by checking if nextScreen is TERMINAL
                let status = "in_progress";

                try {
                    // Extract Flow ID from Token (Format: FLOWID_WAID_TIMESTAMP)
                    const flowId = flowToken ? flowToken.split('_')[0] : null;

                    if (flowId) {
                        const flow = await prisma.whatsAppFlow.findUnique({
                            where: { id: flowId },
                            select: { flowJson: true }
                        });

                        if (flow && flow.flowJson) {
                            const json = typeof flow.flowJson === 'string' ? JSON.parse(flow.flowJson) : flow.flowJson;
                            const targetScreenNode = json.screens?.find(s => s.id === nextScreen);

                            if (targetScreenNode?.terminal) {
                                status = "completed";
                            }
                        }
                    } else if (nextScreen === "SUCCESS" || nextScreen === "success") {
                        // Fallback for legacy
                        status = "completed";
                    }
                } catch (err) {
                    console.error("Error determining terminal status:", err);
                    // Fallback
                    if (nextScreen === "SUCCESS") status = "completed";
                }

                console.log(`📍 Current Screen: ${currentScreen} → Next Screen: ${nextScreen} [Status: ${status}]`);

                try {
                    // Normalize Phone Numbers (Check both + and non-+)
                    let lead = await prisma.lead.findFirst({
                        where: {
                            vendorId: vendor.id,
                            OR: [
                                { phoneNumber: waId },
                                { phoneNumber: `+${waId}` },
                                { phoneNumber: waId.replace('+', '') }
                            ]
                        }
                    });

                    // Log the attempt (Visible in Dashboard)
                    await prisma.activityLog.create({
                        data: {
                            vendorId: vendor.id,
                            type: 'flow_endpoint_hit',
                            status: 'received',
                            phoneNumber: waId,
                            event: 'data_exchange',
                            payload: { flowToken, ...submissionData },
                            whatsappBusinessId: vendor.whatsappBusinessId
                        }
                    });

                    if (lead) {
                        let conversation = await prisma.conversation.findFirst({
                            where: { vendorId: vendor.id, leadId: lead.id }
                        });

                        if (!conversation) {
                            conversation = await prisma.conversation.create({
                                data: { vendorId: vendor.id, leadId: lead.id, channel: 'whatsapp' }
                            });
                        }

                        // Save Response
                        let flowId = null;
                        if (flowToken) {
                            const parts = flowToken.split('_');
                            // If UUID format (simple check: length > 20)
                            if (parts[0] && parts[0].length > 10) {
                                flowId = parts[0];
                            }
                        }

                        // Check if response already exists for this token
                        const existingResponse = await prisma.flowResponse.findFirst({
                            where: { flowToken }
                        });

                        if (existingResponse) {
                            // Merge new data with existing data
                            const mergedData = {
                                ...(existingResponse.responseData || {}),
                                ...submissionData
                            };

                            await prisma.flowResponse.update({
                                where: { id: existingResponse.id },
                                data: {
                                    responseData: mergedData,
                                    status: status,
                                    // Set completedAt if finishing
                                    ...(status === 'completed' && { completedAt: new Date() })
                                }
                            });
                            console.log('✅ Flow Response UPDATED in DB');
                        } else {
                            // Create new response
                            await prisma.flowResponse.create({
                                data: {
                                    conversationId: conversation.id,
                                    responseData: submissionData,
                                    flowToken: flowToken,
                                    responseData: submissionData,
                                    flowToken: flowToken,
                                    status: status,
                                    ...(flowId && { flowId })
                                }
                            });
                            console.log('✅ Flow Response CREATED in DB');
                        }
                        console.log('✅ Flow Response Saved to DB');
                    } else {
                        console.warn(`⚠️ Lead not found for number: ${waId}. Flow data logged but not linked to lead.`);
                    }
                } catch (e) {
                    console.error("Save Error", e);
                }
            }

            // Determine next screen based on current screen
            const currentScreen = decryptedData.screen || "START";
            let nextScreen = "SUCCESS"; // Default fallback

            // 1. Check if next_screen_id was sent in payload (from Visual Builder)
            if (decryptedData.data?.next_screen_id) {
                nextScreen = decryptedData.data.next_screen_id;
                console.log(`🧭 Using UI-defined next screen: ${nextScreen}`);
            }
            // 2. Fallback to hardcoded logic if no target screen defined
            else {
                if (currentScreen === "START") {
                    nextScreen = "Q"; // Go to question screen
                } else if (currentScreen === "Q") {
                    nextScreen = "SUCCESS"; // Go to success screen
                }
            }

            console.log(`📍 Current Screen: ${currentScreen} → Next Screen: ${nextScreen}`);

            const responseData = {};

            // Only include flow_token/params if this is the SUCCESS screen (Terminal)
            if (nextScreen === "SUCCESS") {
                responseData.extension_message_response = {
                    params: { flow_token: flowToken }
                };
            }

            responsePayload = {
                screen: nextScreen,
                data: responseData
            };
        } else if (action === 'navigate') {
            // Client error report or state change?
            // Meta sends this when an error occurs like 'invalid-screen-transition'
            // We should just acknowledge it to prevent 'Something went wrong' generic error
            console.warn('⚠️ Received client validation report:', decryptedData.data);

            // Return empty SUCCESS or similar to appease the client
            responsePayload = {
                data: {
                    acknowledged: true
                }
            };
        } else {
            console.warn('Unknown Flow Action:', action);
            // Return fallback
            responsePayload = { data: {} };
        }

        console.log("📤 Sending Response Payload:", JSON.stringify(responsePayload, null, 2));

        // 5. Encrypt Response
        const encryptedResponse = encryptResponse(responsePayload, aesKey, iv);

        // 6. Return Plain Text String (Base64) as Meta expects
        // Explicitly set text/plain to avoid issues with some clients/Meta validation
        res.status(200).type('text/plain').send(encryptedResponse);

    } catch (error) {
        console.error('Flow Endpoint Error:', error);
        res.status(500).send();
    }
};

export default {
    getFlows,
    getFlowById,
    createFlow,
    updateFlow,
    publishFlow,
    deprecateFlow,
    deleteFlow,
    getFlowMetrics,
    getFlowResponses,
    deleteFlowResponse,
    setupFlowsEncryption,
    handleFlowEndpoint
};

