"use client";

import React, { useCallback, useRef, useState, DragEvent } from "react";
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ReactFlowProvider,
  Node,
  Panel,
  ReactFlowInstance,
  Edge,
} from "reactflow";
import "reactflow/dist/style.css";
import { Save, FolderOpen } from "lucide-react";
import { useTheme } from "@/context/theme-provider";
import api from "@/lib/api";

interface SavedWorkflow {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  triggerKeyword?: string;
  description?: string;
  createdAt?: string;
}

// Components
import Sidebar from "../../../components/chatbot/Sidebar";
import MessageNode from "../../../components/chatbot/nodes/MessageNode";
import ButtonNode from "../../../components/chatbot/nodes/ButtonNode";
import ListNode from "../../../components/chatbot/nodes/ListNode";
import ImageNode from "../../../components/chatbot/nodes/ImageNode";
import GalleryNode from "../../../components/chatbot/nodes/GalleryNode";
import StartNode from "../../../components/chatbot/nodes/StartNode";
import ButtonEdge from "../../../components/chatbot/edges/ButtonEdge";
import WorkflowListModal from "../../../components/chatbot/WorkflowListModal";

// Helper for ID generation
const generateId = () => `node_${Math.random().toString(36).substr(2, 9)}`;

// Register types
const nodeTypes = {
  message: MessageNode,
  button: ButtonNode,
  list: ListNode,
  image: ImageNode,
  gallery: GalleryNode,
  start: StartNode,
};

const edgeTypes = {
  button: ButtonEdge,
};

const initialNodes: Node[] = [
  {
    id: "start-1",
    type: "start",
    data: { label: "Start", triggerKeyword: "hello" },
    position: { x: 250, y: 50 },
  },
];

function FlowBuilderContent() {
  const { theme } = useTheme();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(
    null,
  );

  const isDark = theme === "dark";

  // Connect using custom ButtonEdge
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge({ ...params, type: "button", animated: true }, eds),
      ),
    [setEdges],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (typeof type === "undefined" || !type) return;

      if (!reactFlowInstance || !reactFlowWrapper.current) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode: Node = {
        id: generateId(),
        type,
        position,
        data: { label: `${type} node` }, // Initial data
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes],
  );

  const handleSave = async () => {
    // Validation: needs start node
    const startNode = nodes.find((n) => n.type === "start");
    if (!startNode || !startNode.data.triggerKeyword) {
      alert("⚠️ You must have a 'Start Flow' node with a trigger keyword set!");
      return;
    }

    const payload = {
      id: currentWorkflowId, // Include ID if updating
      name: `Flow: ${startNode.data.triggerKeyword}`,
      nodes,
      edges,
      triggerKeyword: startNode.data.triggerKeyword,
      description: "Auto-saved flow",
    };

    try {
      const res = await api.post("/workflow", payload);
      // Sync ID if created new
      if (res.data && res.data.id) {
        setCurrentWorkflowId(res.data.id);
      }
      alert("✅ Workflow saved successfully!");
    } catch (error) {
      console.error(error);
      alert("❌ Failed to save workflow");
    }
  };

  const handleSelectWorkflow = (workflow: SavedWorkflow) => {
    setCurrentWorkflowId(workflow.id); // Track loaded ID
    if (workflow.nodes) setNodes(workflow.nodes);
    if (workflow.edges) {
      // Ensure edges use our custom component
      setEdges(
        workflow.edges.map((e: Edge) => ({
          ...e,
          type: "button",
          animated: true,
        })),
      );
    }
    setIsListModalOpen(false);
    setTimeout(() => reactFlowInstance?.fitView(), 100);
  };

  return (
    <div className="flex w-full h-[calc(100vh-64px)] overflow-hidden">
      {/* Sidebar for Dragging */}
      <Sidebar />

      {/* Main Canvas */}
      <div
        className="flex-1 h-full bg-gray-50 dark:bg-slate-900 relative"
        ref={reactFlowWrapper}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          fitView
          defaultEdgeOptions={{
            type: "button",
            animated: true,
            style: {
              strokeWidth: 2,
              stroke: isDark ? "#475569" : "#94a3b8",
            },
          }}
          className={isDark ? "dark" : ""}
        >
          <Background
            color={isDark ? "#334155" : "#aaa"}
            gap={16}
            className="dark:bg-slate-900"
          />
          <Controls className="dark:bg-slate-800 dark:border-slate-700 dark:text-gray-200 fill-current" />

          <Panel position="top-right" className="flex gap-2">
            <button
              onClick={() => setIsListModalOpen(true)}
              className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition font-medium border border-gray-200 dark:border-slate-700 flex items-center gap-2 text-sm"
            >
              <FolderOpen size={16} /> Load
            </button>
            <button
              onClick={handleSave}
              className="bg-primary text-white px-3 py-2 rounded-lg shadow-md hover:bg-primary/90 transition font-medium flex items-center gap-2 text-sm"
            >
              <Save size={16} /> Save Workflow
            </button>
          </Panel>
        </ReactFlow>
      </div>

      <WorkflowListModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        onSelect={handleSelectWorkflow}
      />
    </div>
  );
}

export default function FlowBuilder() {
  return (
    <ReactFlowProvider>
      <FlowBuilderContent />
    </ReactFlowProvider>
  );
}
