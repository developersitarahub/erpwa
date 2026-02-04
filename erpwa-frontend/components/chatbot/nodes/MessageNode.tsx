import React, { memo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { Handle, Position, NodeProps, useReactFlow } from "reactflow";
import {
  Trash2,
  Check,
  MessageSquare,
  AlertTriangle,
  X,
  Copy,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/card";
import { Button } from "@/components/button";

const MessageNode = ({ id, data, selected }: NodeProps) => {
  const { setNodes, getNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [localData, setLocalData] = useState({
    label: data.label || "Send Message",
    content: data.content || "",
  });

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    setNodes((nds) => nds.filter((node) => node.id !== id));
    setShowDeleteModal(false);
    toast.success("Message node deleted");
  };

  const handleCopy = () => {
    const currentNode = getNodes().find((node) => node.id === id);

    if (!currentNode) return;

    const newNode = {
      ...currentNode,
      id: `node_${Math.random().toString(36).substr(2, 9)}`,
      position: {
        x: currentNode.position.x + 50,
        y: currentNode.position.y + 50,
      },
      data: {
        ...currentNode.data,
        ...localData,
      },
      selected: false,
    };

    setNodes((nds) => [...nds, newNode]);
    toast.success("Message node copied");
  };

  const handleSave = () => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, ...localData } };
        }
        return node;
      }),
    );
    setIsEditing(false);
  };

  return (
    <>
      <div className="relative min-w-[220px]">
        <div
          className={`shadow-xl rounded-xl overflow-hidden bg-white dark:bg-slate-800 border-2 transition-all duration-300 ${
            selected
              ? "border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.5)] bg-cyan-500/5"
              : "border-cyan-500/30 shadow-[0_0_5px_rgba(6,182,212,0.1)] hover:border-cyan-500/60 hover:shadow-[0_0_10px_rgba(6,182,212,0.2)]"
          }`}
        >
          {/* Node Header */}
          <div className="bg-gray-50/80 dark:bg-slate-900/80 px-3 py-2 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between rounded-t-xl">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center text-white">
                <MessageSquare size={12} />
              </div>
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Message
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                className="p-1 px-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                title="Copy Node"
              >
                <Copy size={14} />
              </button>
              <button
                onClick={handleDeleteClick}
                className="p-1 px-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                title="Delete Node"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Node Body */}
          <div className="p-3 bg-white dark:bg-slate-800 space-y-3">
            {isEditing ? (
              <div className="space-y-2 nodrag">
                <input
                  type="text"
                  className="w-full text-xs font-bold border-none bg-gray-50 dark:bg-slate-900 dark:text-gray-200 p-2 rounded-md focus:ring-1 focus:ring-primary outline-none"
                  value={localData.label}
                  onChange={(e) =>
                    setLocalData({ ...localData, label: e.target.value })
                  }
                  placeholder="Label..."
                  autoFocus
                />
                <textarea
                  className="w-full text-xs border-none bg-gray-50 dark:bg-slate-900 dark:text-gray-200 p-2 rounded-md focus:ring-1 focus:ring-primary outline-none min-h-[60px] resize-none"
                  value={localData.content}
                  onChange={(e) =>
                    setLocalData({ ...localData, content: e.target.value })
                  }
                  placeholder="Type message here..."
                />
                <button
                  onClick={handleSave}
                  className="w-full py-1.5 bg-primary text-white text-[10px] font-bold rounded-md flex items-center justify-center gap-1 hover:bg-primary/90 transition-all active:scale-95"
                >
                  <Check size={12} /> SAVE CHANGES
                </button>
              </div>
            ) : (
              <div
                className="cursor-text group min-h-[40px]"
                onDoubleClick={() => setIsEditing(true)}
              >
                <div className="text-[11px] font-bold text-gray-800 dark:text-gray-200 mb-1 group-hover:text-primary transition-colors">
                  {data.label || "Click to edit label"}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed italic">
                  {data.content
                    ? `"${data.content}"`
                    : "Double click to add message content..."}
                </div>
              </div>
            )}
          </div>
        </div>
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 bg-gray-400 border-2 border-white dark:border-slate-900 shadow-sm"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 bg-cyan-500 border-2 border-white dark:border-slate-900 shadow-sm"
        />
      </div>

      {showDeleteModal &&
        createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="flex items-center gap-2 text-red-500">
                  <AlertTriangle className="w-5 h-5" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Confirm Deletion
                  </h2>
                </div>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Are you sure you want to delete this message node?
                  <br />
                  <span className="text-sm text-gray-500 mt-2 block">
                    This action cannot be undone.
                  </span>
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowDeleteModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    onClick={confirmDelete}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>,
          document.body,
        )}
    </>
  );
};

export default memo(MessageNode);
