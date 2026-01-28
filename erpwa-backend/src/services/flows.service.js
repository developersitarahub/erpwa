import axios from 'axios';
import FormData from 'form-data';
import { Readable } from 'stream';

/**
 * WhatsApp Flows API Service
 * Handles all interactions with Meta's WhatsApp Flows API
 */
class FlowsService {
    constructor() {
        this.baseUrl = 'https://graph.facebook.com/v21.0';
    }

    /**
     * Create a new Flow in Meta's system
     * @param {string} wabaId - WhatsApp Business Account ID
     * @param {string} name - Flow name
     * @param {string[]} categories - Flow categories (e.g., ['LEAD_GENERATION'])
     * @param {string} accessToken - Meta access token
     * @returns {Promise<{id: string}>} Flow ID
     */
    async createFlow(wabaId, name, categories, accessToken) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/${wabaId}/flows`,
                {
                    name,
                    categories
                },
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Error creating Flow:', error.response?.data || error.message);
            // Propagate specific Meta errors (like name not unique)
            if (error.response?.data?.error) {
                throw new Error(JSON.stringify(error.response.data.error));
            }
            throw new Error(error.response?.data?.error?.message || 'Failed to create Flow');
        }
    }

    /**
     * Update Flow Metadata (categories, endpoint_uri, etc.)
     * @param {string} flowId - Meta Flow ID
     * @param {object} updates - Fields to update { endpoint_uri, categories }
     * @param {string} accessToken - Meta access token
     * @returns {Promise<{success: boolean}>}
     */
    async updateFlowMetadata(flowId, updates, accessToken) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/${flowId}`,
                updates,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return { success: true, data: response.data };
        } catch (error) {
            console.error('Error updating Flow metadata:', error.response?.data || error.message);
            throw new Error(error.response?.data?.error?.message || 'Failed to update Flow metadata');
        }
    }

    /**

    /**
     * Update Flow JSON (screens, components, routing)
     * @param {string} flowId - Meta Flow ID
     * @param {object} flowJson - Flow JSON definition
     * @param {string} accessToken - Meta access token
     * @returns {Promise<{success: boolean}>}
     */
    async updateFlowJSON(flowId, flowJson, accessToken) {
        try {
            // Create a FormData instance to send the file
            const form = new FormData();
            form.append('name', 'flow.json');
            form.append('asset_type', 'FLOW_JSON');

            // Convert JSON object to string and buffer for upload
            // Handle both string (if pre-stringified) and object inputs
            const jsonString = typeof flowJson === 'string' ? flowJson : JSON.stringify(flowJson);
            const buffer = Buffer.from(jsonString, 'utf-8');

            form.append('file', buffer, {
                filename: 'flow.json',
                contentType: 'application/json',
            });

            const response = await axios.post(
                `${this.baseUrl}/${flowId}/assets`,
                form,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        ...form.getHeaders()
                    }
                }
            );

            return { success: true, data: response.data };
        } catch (error) {
            console.error('Error updating Flow JSON:', error.response?.data || error.message);
            if (error.response?.data?.error) {
                throw new Error(JSON.stringify(error.response.data.error));
            }
            throw new Error(error.response?.data?.error?.message || 'Failed to update Flow JSON');
        }
    }

    /**
     * Get Flow Validation Errors
     * @param {string} flowId 
     * @param {string} accessToken 
     */
    async getValidationErrors(flowId, accessToken) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/${flowId}?fields=validation_errors`,
                {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                }
            );
            return response.data.validation_errors || [];
        } catch (error) {
            console.error('Error fetching validation errors:', error);
            return [];
        }
    }

    /**
     * Publish a Flow (make it live)
     * @param {string} flowId - Meta Flow ID
     * @param {string} accessToken - Meta access token
     * @returns {Promise<{success: boolean}>}
     */
    async publishFlow(flowId, accessToken) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/${flowId}/publish`,
                {},
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return { success: true, data: response.data };
        } catch (error) {
            console.error('Error publishing Flow:', error.response?.data || error.message);
            const metaError = error.response?.data?.error;
            const message = metaError?.error_user_msg || metaError?.message || 'Failed to publish Flow';
            throw new Error(message);
        }
    }

    /**
     * Deprecate a Flow (prevent new sends)
     * @param {string} flowId - Meta Flow ID
     * @param {string} accessToken - Meta access token
     * @returns {Promise<{success: boolean}>}
     */
    async deprecateFlow(flowId, accessToken) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/${flowId}/deprecate`,
                {},
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return { success: true, data: response.data };
        } catch (error) {
            console.error('Error deprecating Flow:', error.response?.data || error.message);
            throw new Error(error.response?.data?.error?.message || 'Failed to deprecate Flow');
        }
    }

    /**
     * Delete a Flow
     * @param {string} flowId - Meta Flow ID
     * @param {string} accessToken - Meta access token
     * @returns {Promise<{success: boolean}>}
     */
    async deleteFlow(flowId, accessToken) {
        try {
            const response = await axios.delete(
                `${this.baseUrl}/${flowId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            );

            return { success: true, data: response.data };
        } catch (error) {
            console.error('Error deleting Flow:', error.response?.data || error.message);
            throw new Error(error.response?.data?.error?.message || 'Failed to delete Flow');
        }
    }

    /**
     * Get Flow details
     * @param {string} flowId - Meta Flow ID
     * @param {string} accessToken - Meta access token
     * @returns {Promise<object>} Flow details
     */
    async getFlow(flowId, accessToken) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/${flowId}?fields=id,name,status,categories,validation_errors,json_version,data_api_version,endpoint_uri,preview`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Error getting Flow:', error.response?.data || error.message);
            throw new Error(error.response?.data?.error?.message || 'Failed to get Flow');
        }
    }

    /**
     * Get Flow JSON
     * @param {string} flowId - Meta Flow ID
     * @param {string} accessToken - Meta access token
     * @returns {Promise<object>} Flow JSON
     */
    async getFlowJSON(flowId, accessToken) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/${flowId}/assets/flow.json`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Error getting Flow JSON:', error.response?.data || error.message);
            throw new Error(error.response?.data?.error?.message || 'Failed to get Flow JSON');
        }
    }

    /**
     * List all Flows for a WABA
     * @param {string} wabaId - WhatsApp Business Account ID
     * @param {string} accessToken - Meta access token
     * @returns {Promise<Array>} List of Flows
     */
    async listFlows(wabaId, accessToken) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/${wabaId}/flows?fields=id,name,status,categories`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            );

            return response.data.data || [];
        } catch (error) {
            console.error('Error listing Flows:', error.response?.data || error.message);
            throw new Error(error.response?.data?.error?.message || 'Failed to list Flows');
        }
    }

    /**
     * Get Flow metrics/analytics
     * @param {string} flowId - Meta Flow ID
     * @param {string} accessToken - Meta access token
     * @returns {Promise<object>} Flow metrics
     */
    async getFlowMetrics(flowId, accessToken) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/${flowId}/metrics`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Error getting Flow metrics:', error.response?.data || error.message);
            // Metrics might not be available for all Flows
            return null;
        }
    }
    /**
     * Upload Public Key for Flows Encryption (to Phone Number)
     * @param {string} phoneNumberId - WhatsApp Phone Number ID
     * @param {string} publicKey - PEM encoded public key
     * @param {string} accessToken - Meta access token
     * @returns {Promise<{success: boolean}>}
     */
    async updatePublicKey(phoneNumberId, publicKey, accessToken) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/${phoneNumberId}/whatsapp_business_encryption`,
                {
                    business_public_key: publicKey
                },
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return { success: true, data: response.data };
        } catch (error) {
            console.error('Error uploading Public Key:', error.response?.data || error.message);
            throw new Error(error.response?.data?.error?.message || 'Failed to upload Public Key');
        }
    }
}

export default new FlowsService();
