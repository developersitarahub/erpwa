import prisma from '../prisma.js';
import { getIO } from '../socket.js';

/**
 * Handle WhatsApp Flow responses from webhook
 * Called when user completes a Flow
 */
export async function handleFlowResponse(msg, vendor, conversation) {
    try {
        // Check if this is a Flow response (interactive nfm_reply)
        if (msg.type !== 'interactive' || msg.interactive?.type !== 'nfm_reply') {
            return false; // Not a Flow response
        }

        const flowResponse = msg.interactive.nfm_reply;
        const responseData = flowResponse.response_json
            ? JSON.parse(flowResponse.response_json)
            : {};

        console.log('📋 Flow Response Received:', {
            flowToken: flowResponse.flow_token,
            name: flowResponse.name,
            hasData: !!responseData
        });

        // Try to find the Flow by metaFlowId from response
        let flow = null;
        if (responseData.flow_id) {
            flow = await prisma.whatsAppFlow.findFirst({
                where: {
                    metaFlowId: responseData.flow_id,
                    vendorId: vendor.id
                }
            });
        }

        // Fallback: Try to find Flow by token (extract ID from "FLOWID_PHONE_TIMESTAMP")
        if (!flow && flowResponse.flow_token) {
            const possibleId = flowResponse.flow_token.split('_')[0];

            flow = await prisma.whatsAppFlow.findFirst({
                where: {
                    vendorId: vendor.id,
                    OR: [
                        { id: possibleId }, // UUID match logic
                        { id: flowResponse.flow_token } // Legacy/Direct match
                    ]
                }
            });
        }

        // Save Flow response to database
        const savedResponse = await prisma.flowResponse.create({
            data: {
                flowId: flow ? flow.id : null,
                conversationId: conversation.id,
                responseData: responseData,
                flowToken: flowResponse.flow_token,
                status: 'completed',
                completedAt: new Date()
            }
        });

        console.log('✅ Flow response saved successfully:', savedResponse.id);

        // Emit Flow response event via socket
        try {
            const io = getIO();
            io.to(`vendor:${vendor.id}`).emit('flow:response', {
                conversationId: conversation.id,
                flowId: flow?.id,
                flowName: flow?.name,
                responseData,
                responseId: savedResponse.id
            });
        } catch (socketErr) {
            console.warn('Socket emit failed for Flow response:', socketErr);
        }

        return true; // Successfully handled
    } catch (error) {
        console.error('❌ Flow response processing failed:', error);
        // Don't throw - webhook must always return 200
        return false;
    }
}
