import prisma from "../prisma.js";
import { sendMessage } from "./whatsappMessage.service.js"; // You might need to check if this exists or use a generic sender

// Helper to delay execution (natural pause)
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ============================================================
   CORE WORKFLOW ENGINE
   ============================================================ */

/**
 * Check if the incoming message triggers any workflow
 */
export async function checkAndStartWorkflow(
  vendorId,
  conversationId,
  incomingText,
) {
  if (!incomingText) return false;

  const text = incomingText.trim().toLowerCase();

  // 1. Fetch all active workflows for this vendor
  const workflows = await prisma.workflow.findMany({
    where: { vendorId, isActive: true },
  });

  console.log(
    `🔍 Checking ${workflows.length} workflows for vendor ${vendorId} against text: "${text}"`,
  );

  // 2. Find matching workflow (handling comma-separated keywords)
  const matchedWorkflow = workflows.find((wf) => {
    if (!wf.triggerKeyword) return false;
    const keywords = wf.triggerKeyword
      .split(",")
      .map((k) => k.trim().toLowerCase());
    const isMatch = keywords.includes(text);
    if (isMatch) {
      console.log(
        `✅ MATCHED WF "${wf.name}" with keywords: [${keywords.join(", ")}]`,
      );
    }
    return isMatch;
  });

  if (!matchedWorkflow) {
    console.log(`❌ No matching workflow found for text: "${text}"`);
    return false;
  }

  console.log(
    `🚀 Starting workflow "${matchedWorkflow.name}" for conversation ${conversationId}`,
  );

  // 3. Create Session
  // First, deactivate any existing sessions for this conversation
  await prisma.workflowSession.updateMany({
    where: { conversationId, status: "active" },
    data: { status: "dropped" },
  });

  // Find start node
  const nodes = matchedWorkflow.nodes;
  const edges = matchedWorkflow.edges;
  const startNode = nodes.find((n) => n.type === "start");

  if (!startNode) {
    console.error("❌ Workflow has no start node!");
    return false;
  }

  // Find the node connected to Start
  // FILTER for edges that actually point to existing nodes to avoid ghost connections (which caused the stuck flow)
  const validEdges = edges.filter(
    (e) => e.source === startNode.id && nodes.some((n) => n.id === e.target),
  );

  if (validEdges.length === 0) {
    console.warn("⚠️ Start node is not connected to any VALID node.");
    return true; // We matched, but flow ends immediately
  }

  // Use the first valid connection found
  const nextNodeId = validEdges[0].target;
  console.log(`✅ Found valid start connection to node: ${nextNodeId}`);

  const session = await prisma.workflowSession.create({
    data: {
      workflowId: matchedWorkflow.id,
      conversationId,
      currentNodeId: nextNodeId,
      status: "active",
      state: {},
    },
  });

  // 4. Process the first real node
  await processNode(session, nextNodeId, nodes, edges, vendorId);
  return true;
}

/**
 * Handle user response when already in a session
 */
export async function handleWorkflowResponse(
  vendorId,
  conversationId,
  inboundMessage,
) {
  // 1. Find active session
  const session = await prisma.workflowSession.findFirst({
    where: { conversationId, status: "active" },
    include: { workflow: true },
  });

  if (!session) return false;

  // 2. Get Current Node
  const nodes = session.workflow.nodes;
  const edges = session.workflow.edges;
  const currentNode = nodes.find((n) => n.id === session.currentNodeId);

  if (!currentNode) {
    await terminateSession(session.id, "error");
    return false;
  }

  console.log(`🔄 Handling response for node type: ${currentNode.type}`);

  // 3. Validate Response & Determine Next Node
  let nextNodeId = null;

  // LOGIC BY NODE TYPE
  if (currentNode.type === "button") {
    // Check if response matches any button
    const buttons = currentNode.data.buttons || [];
    const incomingText = getMessageText(inboundMessage); // Helper needed

    // Find which button was pressed
    const matchedBtnIdx = buttons.findIndex(
      (btn) => btn.text.toLowerCase() === incomingText.toLowerCase(),
    );

    if (matchedBtnIdx !== -1) {
      // Find edge connected to this specific button handle
      const handleId = `handle-${matchedBtnIdx}`;
      const edge = edges.find(
        (e) => e.source === currentNode.id && e.sourceHandle === handleId,
      );
      // Fallback: generic edge
      const genericEdge = edges.find(
        (e) => e.source === currentNode.id && !e.sourceHandle,
      );
      nextNodeId = edge ? edge.target : genericEdge?.target;
    } else {
      console.log(
        `❌ No button match for input "${incomingText}". Buttons: [${buttons.map((b) => b.text).join(", ")}]`,
      );
      // If user typed something that isn't a button option, maybe they want to restart the flow?
      // Return false to let the global trigger check logic run.
      return false;
    }
  } else if (currentNode.type === "list") {
    const items = currentNode.data.items || [];
    const incomingText = getMessageText(inboundMessage);

    const matchedItemIdx = items.findIndex(
      (item) => item.title.toLowerCase() === incomingText.toLowerCase(),
    );

    if (matchedItemIdx !== -1) {
      const handleId = `handle-${matchedItemIdx}`;
      const edge = edges.find(
        (e) => e.source === currentNode.id && e.sourceHandle === handleId,
      );
      nextNodeId = edge ? edge.target : null;
    } else {
      console.log(
        `❌ No list item match for input "${incomingText}". Items: [${items.map((i) => i.title).join(", ")}]`,
      );
      return false;
    }
  } else {
    // For non-interactive nodes (like Message, Image) we shouldn't really be "waiting" here
    // unless they were the last thing sent.
    // But usually we auto-advance from them.
    // If we are here, it means we are "stuck" on a node that should have auto-advanced?
    // Or maybe it's an "Input" node (not implemented yet).

    // Default behavior: just follow the first edge if any
    const edge = edges.find((e) => e.source === currentNode.id);
    nextNodeId = edge?.target;
  }

  // 4. Transition
  if (nextNodeId) {
    await updateSessionNode(session.id, nextNodeId);
    await processNode(session, nextNodeId, nodes, edges, vendorId);
  } else {
    // End of flow
    await terminateSession(session.id, "completed");
  }

  return true;
}

/**
 * Execute logic for a node (Send message, etc.) and auto-advance if non-interactive
 */
async function processNode(session, nodeId, nodes, edges, vendorId) {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return;

  console.log(`▶️ Processing Node: ${node.type} (${node.id})`);

  // DELAY: Add a small thinking delay for realism
  await delay(800);

  // EXECUTE NODE ACTION
  try {
    switch (node.type) {
      case "message":
        await sendMessage(vendorId, session.conversationId, {
          type: "text",
          text: node.data.content,
        });
        // Auto-advance
        await advanceToNextNode(session, node, edges, nodes, vendorId);
        break;

      case "image":
        await sendMessage(vendorId, session.conversationId, {
          type: "image",
          image: {
            link: node.data.imageUrl,
            caption: node.data.content,
          },
        });
        // Auto-advance
        await advanceToNextNode(session, node, edges, nodes, vendorId);
        break;

      case "gallery":
        // Send multiple images. WhatsApp doesn't support "gallery" message type natively like naming it.
        // We typically send multiple media messages or an album if supported (not standard WA API).
        // Let's send them one by one.
        const urls = node.data.imageUrls || [];
        for (const url of urls) {
          await sendMessage(vendorId, session.conversationId, {
            type: "image",
            image: { link: url }, // Caption only on last? or none?
          });
          await delay(500);
        }
        if (node.data.content) {
          await sendMessage(vendorId, session.conversationId, {
            type: "text",
            text: node.data.content,
          });
        }
        // Auto-advance
        await advanceToNextNode(session, node, edges, nodes, vendorId);
        break;

      case "button":
        // ANALYZE BUTTON TYPES
        const buttonsData = node.data.buttons || [];

        // 1. Prepare Content
        let bodyText = node.data.label || "Please select:";
        const validReplyButtons = [];

        for (const [i, b] of buttonsData.entries()) {
          if (b.type === "url") {
            bodyText += `\n\n🔗 ${b.text}: ${b.value}`;
          } else if (b.type === "phone_number") {
            bodyText += `\n\n📞 ${b.text}: ${b.value}`;
          } else if (b.type === "flow") {
            // SPECIFIC HANDLER FOR FLOW BUTTONS
            // Flows must be sent as a specific interactive type, not inside a standard button list
            try {
              await sendMessage(vendorId, session.conversationId, {
                type: "interactive",
                interactive: {
                  type: "flow",
                  header: {
                    type: "text",
                    text: node.data.header || "Open Flow",
                  },
                  body: {
                    text: node.data.label || "Click below to start",
                  },
                  footer: {
                    text: node.data.footer || "Secure & Fast",
                  },
                  action: {
                    name: "flow",
                    parameters: {
                      flow_message_version: "3",
                      flow_token: "unused_token",
                      flow_id: b.flowId,
                      flow_cta: b.text,
                      flow_action: b.flowAction || "navigate",
                      flow_action_payload: {
                        screen: b.value || "START",
                      },
                    },
                  },
                },
              });
              // We sent the flow, now we wait for the nfm_reply (flow completion)
              return;
            } catch (err) {
              console.error("Failed to send Flow button:", err);
              bodyText += `\n\n[Flow Button Error: ${b.text}]`;
            }
          } else {
            // Standard Reply Button
            validReplyButtons.push({
              type: "reply",
              reply: {
                id: `btn_${i}`,
                title: b.text.substring(0, 20),
              },
            });
          }
        }

        // 2. Validate Limits
        // WhatsApp allows max 3 reply buttons
        const textOnlyResponse = validReplyButtons.length === 0;
        const buttonsToSend = validReplyButtons.slice(0, 3);

        if (validReplyButtons.length > 3) {
          console.warn(
            `⚠️ Too many buttons (${validReplyButtons.length}). Truncating to 3.`,
          );
        }

        // 3. Send
        if (!textOnlyResponse) {
          await sendMessage(vendorId, session.conversationId, {
            type: "interactive",
            interactive: {
              type: "button",
              body: { text: bodyText },
              action: { buttons: buttonsToSend },
            },
          });
        } else {
          // If no reply buttons (e.g. only URL buttons), just send text
          await sendMessage(vendorId, session.conversationId, {
            type: "text",
            text: bodyText,
          });
        }

        // Auto-advance is NOT appropriate if we sent reply buttons (we wait for user).
        // BUT if we only sent text (e.g. URL buttons), we should theoretically auto-advance or wait?
        // Usually "Button" nodes are meant to wait.
        // If we converted all buttons to Text (Links), the user has no "Reply" button to click.
        // So the flow might stall here if we don't advance.
        // However, standard behavior for Button node is "Input/Wait".
        // Let's stick to waiting. User can type something to match keywords if setup, or just stuck.
        // Actually, if it was purely informational (Link), maybe we should advance?
        // For now, let's keep the logic consistent: Button Node = Wait.
        break;

      case "list":
        // Send Interactive List Message
        const sectionRows = (node.data.items || []).map((item, i) => ({
          id: `opt_${i}`,
          title: item.title.substring(0, 24), // Max 24 chars
          description: (item.description || "").substring(0, 72),
        }));

        await sendMessage(vendorId, session.conversationId, {
          type: "interactive",
          interactive: {
            type: "list",
            body: { text: node.data.label || "Select an option" },
            action: {
              button: "Menu",
              sections: [
                {
                  title: "Options",
                  rows: sectionRows,
                },
              ],
            },
          },
        });
        // STOP here. Wait for user reply.
        break;

      default:
        console.warn("Unknown node type:", node.type);
        // Try to skip
        await advanceToNextNode(session, node, edges, nodes, vendorId);
        break;
    }
  } catch (err) {
    console.error("Error executing node:", err);
  }
}

// Helper: Auto-advance (recursive)
async function advanceToNextNode(session, currentNode, edges, nodes, vendorId) {
  // Find generic edge (no sourceHandle specific)
  // FILTER for edges that actually point to existing nodes to avoid ghost connections
  const validEdges = edges.filter(
    (e) => e.source === currentNode.id && nodes.some((n) => n.id === e.target),
  );

  if (validEdges.length > 0) {
    const targetId = validEdges[0].target;
    await updateSessionNode(session.id, targetId);
    await processNode(session, targetId, nodes, edges, vendorId);
  } else {
    // Flow complete
    await terminateSession(session.id, "completed");
  }
}

async function updateSessionNode(sessionId, nodeId) {
  await prisma.workflowSession.update({
    where: { id: sessionId },
    data: { currentNodeId: nodeId },
  });
}

async function terminateSession(sessionId, finalStatus) {
  await prisma.workflowSession.update({
    where: { id: sessionId },
    data: { status: finalStatus },
  });
}

function getMessageText(msg) {
  if (msg.messageType === "text") return msg.content;
  if (msg.messageType === "button") return msg.content; // We stored button text in content
  if (msg.messageType === "interactive") {
    // Parse payload if complex
    // This depends on how we store inboundPayload.
    // For now, let's assume content field is reliable.
    return msg.content;
  }
  return "";
}
