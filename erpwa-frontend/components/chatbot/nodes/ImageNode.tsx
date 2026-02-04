import React, { memo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { Handle, Position, NodeProps, useReactFlow } from "reactflow";
import { Trash2, Check, ImageIcon, AlertTriangle, X, Copy } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/card";
import { Button } from "@/components/button";
import GalleryModal from "../GalleryModal";

const ImageNode = ({ id, data, selected }: NodeProps) => {
  const { setNodes, getNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [localData, setLocalData] = useState({
    label: data.label || "Image Message",
    content: data.content || "",
    imageUrl: data.imageUrl || "",
  });

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    setNodes((nds) => nds.filter((node) => node.id !== id));
    setShowDeleteModal(false);
    toast.success("Image node deleted");
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
    toast.success("Image node copied");
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

  const onSelectImage = (url: string | string[]) => {
    const imageUrl = Array.isArray(url) ? url[0] : url;
    setLocalData({ ...localData, imageUrl });
    setIsGalleryOpen(false);
  };

  return (
    <>
      <div className="relative w-[200px]">
        <div
          className={`shadow-xl rounded-xl overflow-hidden bg-white dark:bg-slate-800 border-2 transition-all duration-300 ${
            selected
              ? "border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.5)] bg-pink-500/5"
              : "border-pink-500/30 shadow-[0_0_5px_rgba(236,72,153,0.1)] hover:border-pink-500/60 hover:shadow-[0_0_10px_rgba(236,72,153,0.2)]"
          }`}
        >
          {/* Node Header */}
          <div className="bg-gray-50/80 dark:bg-slate-900/80 px-3 py-2 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between rounded-t-xl">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-pink-500 flex items-center justify-center text-white">
                <ImageIcon size={12} />
              </div>
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Image
              </span>
            </div>
            <div className="flex items-center gap-1 text-gray-400">
              <button
                onClick={handleCopy}
                className="p-1 px-2 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                title="Copy Node"
              >
                <Copy size={14} />
              </button>
              <button
                onClick={handleDeleteClick}
                className="p-1 px-2 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                title="Delete Node"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-slate-800 space-y-3">
            {isEditing ? (
              <div className="space-y-3 nodrag">
                <input
                  type="text"
                  className="w-full text-xs font-bold border-none bg-gray-50 dark:bg-slate-900 dark:text-gray-200 p-2 rounded-md focus:ring-1 focus:ring-pink-500 outline-none"
                  value={localData.label}
                  onChange={(e) =>
                    setLocalData({ ...localData, label: e.target.value })
                  }
                  placeholder="Label..."
                />

                <div
                  onClick={() => setIsGalleryOpen(true)}
                  className="relative aspect-video w-full rounded-md overflow-hidden bg-gray-100 dark:bg-slate-900 border-2 border-dashed border-gray-200 dark:border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors group"
                >
                  {localData.imageUrl ? (
                    <>
                      <img
                        src={localData.imageUrl}
                        className="w-full h-full object-cover"
                        alt="Preview"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold">
                        CHANGE IMAGE
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-gray-400">
                      <ImageIcon size={20} />
                      <span className="text-[10px] font-medium">
                        SELECT IMAGE
                      </span>
                    </div>
                  )}
                </div>

                <textarea
                  className="w-full text-xs border-none bg-gray-50 dark:bg-slate-900 dark:text-gray-200 p-2 rounded-md focus:ring-1 focus:ring-pink-500 outline-none min-h-[40px] resize-none"
                  value={localData.content}
                  onChange={(e) =>
                    setLocalData({ ...localData, content: e.target.value })
                  }
                  placeholder="Add caption (optional)..."
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
                className="cursor-text group"
                onDoubleClick={() => setIsEditing(true)}
              >
                <div className="text-[11px] font-bold text-gray-800 dark:text-gray-200 mb-2 truncate group-hover:text-primary transition-colors">
                  {data.label || "Image Step"}
                </div>

                {data.imageUrl ? (
                  <div className="relative aspect-video w-full rounded-md overflow-hidden bg-gray-100 dark:bg-slate-900 border border-gray-100 dark:border-slate-700">
                    <img
                      src={data.imageUrl}
                      className="w-full h-full object-cover"
                      alt="Workflow"
                    />
                  </div>
                ) : (
                  <div className="aspect-video w-full rounded-md border-2 border-dashed border-gray-200 dark:border-slate-700 flex items-center justify-center bg-gray-50 dark:bg-slate-900 text-[10px] text-gray-400 italic">
                    No image selected
                  </div>
                )}

                {data.content && (
                  <div className="mt-2 text-[10px] text-gray-500 dark:text-gray-400 leading-snug italic line-clamp-2">
                    &quot;{data.content}&quot;
                  </div>
                )}
              </div>
            )}
          </div>

          <GalleryModal
            isOpen={isGalleryOpen}
            onClose={() => setIsGalleryOpen(false)}
            onSelect={onSelectImage}
          />
        </div>
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 bg-gray-400 border-2 border-white dark:border-slate-900 shadow-sm"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 bg-pink-500 border-2 border-white dark:border-slate-900 shadow-sm"
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
                  Are you sure you want to delete this image node?
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

export default memo(ImageNode);
