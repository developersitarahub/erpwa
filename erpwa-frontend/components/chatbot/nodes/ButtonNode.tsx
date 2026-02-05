import React, { memo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import { Handle, Position, NodeProps, useReactFlow } from "reactflow";
import {
  Trash2,
  Check,
  Plus,
  GripVertical,
  Disc,
  Phone,
  SquareArrowOutUpRight,
  AlertTriangle,
  X,
  Copy,
  Reply,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/card";
import { Button } from "@/components/button";

interface ButtonData {
  id?: string;
  text: string;
  type?: "reply" | "url" | "phone_number";
  value?: string;
}

interface ButtonNodeData {
  label?: string;
  buttons?: ButtonData[];
}

const ButtonNode = ({ id, data, selected }: NodeProps<ButtonNodeData>) => {
  const { setNodes, getNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [localData, setLocalData] = useState<{
    label: string;
    buttons: ButtonData[];
  }>({
    label: data.label || "Buttons Message",
    buttons: data.buttons || [],
  });

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    setNodes((nds) => nds.filter((node) => node.id !== id));
    setShowDeleteModal(false);
    toast.success("Button node deleted");
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
        label: localData.label,
        buttons: localData.buttons.map((btn) => ({
          ...btn,
          id: Date.now().toString() + Math.random(),
        })),
      },
      selected: false,
    };

    setNodes((nds) => [...nds, newNode]);
    toast.success("Button node copied");
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

  const addButton = () => {
    if (localData.buttons.length >= 3) return;
    setLocalData({
      ...localData,
      buttons: [
        ...localData.buttons,
        {
          id: Date.now().toString(),
          text: "New Button",
          type: "reply",
          value: "",
        },
      ],
    });
  };

  const removeButton = (idx: number) => {
    const newButtons = [...localData.buttons];
    newButtons.splice(idx, 1);
    setLocalData({ ...localData, buttons: newButtons });
  };

  const updateButtonText = (idx: number, text: string) => {
    const newButtons = [...localData.buttons];
    newButtons[idx].text = text;
    setLocalData({ ...localData, buttons: newButtons });
  };

  const updateButtonType = (
    idx: number,
    type: "reply" | "url" | "phone_number",
  ) => {
    const newButtons = [...localData.buttons];
    newButtons[idx].type = type;
    // Ensure value is initialized when type changes if it doesn't exist
    if (newButtons[idx].value === undefined) {
      newButtons[idx].value = "";
    }
    setLocalData({ ...localData, buttons: newButtons });
  };

  const updateButtonValue = (idx: number, value: string) => {
    const newButtons = [...localData.buttons];
    newButtons[idx].value = value;
    setLocalData({ ...localData, buttons: newButtons });
  };

  return (
    <>
      <div
        className={`relative shadow-xl rounded-xl bg-white dark:bg-slate-800 transition-all duration-200 min-w-[280px]`}
      >
        <div
          className={`absolute inset-0 rounded-xl border-2 transition-all duration-300 pointer-events-none z-10 ${
            selected
              ? "border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.5)] bg-orange-500/5"
              : "border-orange-500/30 shadow-[0_0_5px_rgba(249,115,22,0.1)] hover:border-orange-500/60 hover:shadow-[0_0_10px_rgba(249,115,22,0.2)]"
          }`}
        />
        {/* Node Header */}
        {/* Node Header */}
        <div className="bg-gray-50/80 dark:bg-slate-900/80 px-3 py-2 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-orange-500 flex items-center justify-center text-white">
              <Disc size={12} />
            </div>
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Interactive
            </span>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <button
              onClick={handleCopy}
              className="p-1 px-2 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
              title="Copy node"
            >
              <Copy size={14} />
            </button>
            <button
              onClick={handleDeleteClick}
              className="p-1 px-2 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
              title="Delete node"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="p-3 space-y-3">
          {isEditing ? (
            <div className="space-y-3 nodrag">
              <input
                type="text"
                className="w-full text-xs font-bold border-none bg-gray-50 dark:bg-slate-900 dark:text-gray-200 p-2 rounded-md focus:ring-1 focus:ring-orange-500 outline-none"
                value={localData.label}
                onChange={(e) =>
                  setLocalData({ ...localData, label: e.target.value })
                }
                placeholder="Message body..."
              />

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-gray-400 uppercase">
                  Buttons ({localData.buttons.length}/3)
                </label>
                {localData.buttons.map((btn, idx) => (
                  <div
                    key={idx}
                    className="space-y-2 bg-gray-50 dark:bg-slate-900 p-2 rounded-md border border-gray-100 dark:border-slate-700"
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical size={12} className="text-gray-300" />
                      <select
                        value={btn.type || "reply"}
                        onChange={(e) =>
                          updateButtonType(
                            idx,
                            e.target.value as "reply" | "url" | "phone_number",
                          )
                        }
                        className="text-[10px] bg-white dark:bg-slate-800 dark:text-gray-200 border border-gray-200 dark:border-slate-600 rounded px-1 py-1 focus:ring-1 focus:ring-orange-500 outline-none"
                      >
                        <option value="reply">Reply</option>
                        <option value="url">Link</option>
                        <option value="phone_number">Phone</option>
                      </select>
                      <button
                        onClick={() => removeButton(idx)}
                        className="ml-auto p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <input
                      value={btn.text}
                      onChange={(e) => updateButtonText(idx, e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 dark:text-gray-200 border border-gray-200 dark:border-slate-600 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-orange-500 outline-none"
                      placeholder="Button text"
                    />

                    {btn.type === "url" && (
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded px-2 py-1">
                        <SquareArrowOutUpRight
                          size={10}
                          className="text-gray-400"
                        />
                        <input
                          value={btn.value || ""}
                          onChange={(e) =>
                            updateButtonValue(idx, e.target.value)
                          }
                          className="flex-1 bg-transparent border-none text-[10px] dark:text-gray-200 p-0 focus:ring-0 outline-none"
                          placeholder="https://example.com"
                        />
                      </div>
                    )}

                    {btn.type === "phone_number" && (
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded px-2 py-1">
                        <Phone size={10} className="text-gray-400" />
                        <input
                          value={btn.value || ""}
                          onChange={(e) =>
                            updateButtonValue(idx, e.target.value)
                          }
                          className="flex-1 bg-transparent border-none text-[10px] dark:text-gray-200 p-0 focus:ring-0 outline-none"
                          placeholder="+1234567890"
                        />
                      </div>
                    )}
                  </div>
                ))}
                {localData.buttons.length < 3 && (
                  <button
                    onClick={addButton}
                    className="w-full py-1.5 border border-dashed border-gray-300 dark:border-slate-600 text-gray-400 dark:text-slate-500 text-[10px] font-bold rounded-md flex items-center justify-center gap-1 hover:border-orange-500 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all"
                  >
                    <Plus size={12} /> ADD BUTTON
                  </button>
                )}
              </div>

              <button
                onClick={handleSave}
                className="w-full py-1.5 bg-orange-500 text-white text-[10px] font-bold rounded-md flex items-center justify-center gap-1 hover:bg-orange-600 transition-all active:scale-95"
              >
                <Check size={12} /> SAVE CHANGES
              </button>
            </div>
          ) : (
            <div
              className="cursor-text group"
              onDoubleClick={() => setIsEditing(true)}
            >
              <div className="text-[11px] font-bold text-gray-800 dark:text-gray-200 mb-2 truncate group-hover:text-orange-600 transition-colors">
                {data.label || "Click to add text..."}
              </div>

              <div className="space-y-1.5 mt-2">
                {data.buttons?.map((btn, idx) => {
                  const isUrl = btn.type === "url";
                  const isPhone = btn.type === "phone_number";
                  const LinkComponent = isUrl || isPhone ? "a" : "div";
                  const href = isUrl
                    ? btn.value
                    : isPhone
                      ? `tel:${btn.value}`
                      : undefined;

                  return (
                    <LinkComponent
                      key={idx}
                      href={href}
                      target={isUrl ? "_blank" : undefined}
                      rel={isUrl ? "noopener noreferrer" : undefined}
                      className={`border text-xs py-1.5 px-3 rounded-md text-center shadow-sm text-gray-600 font-medium relative group/item transition-colors flex items-center justify-center gap-2 nodrag ${
                        isUrl || isPhone
                          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 cursor-pointer"
                          : "bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 hover:border-orange-200 text-gray-600 dark:text-gray-300"
                      }`}
                      onClick={(e) => {
                        if (isUrl || isPhone) {
                          e.stopPropagation();
                        }
                      }}
                    >
                      {isUrl && (
                        <SquareArrowOutUpRight
                          size={14}
                          className="text-blue-500"
                        />
                      )}
                      {isPhone && (
                        <Phone size={14} className="text-green-500" />
                      )}
                      {(!btn.type || btn.type === "reply") && (
                        <Reply size={14} className="text-gray-400" />
                      )}
                      <span>{btn.text}</span>

                      {(!btn.type || btn.type === "reply") && (
                        <Handle
                          type="source"
                          position={Position.Right}
                          id={`handle-${idx}`}
                          style={{
                            top: "50%",
                            right: "-5px",
                            transform: "translateY(-50%)",
                          }}
                          className="w-2.5 h-2.5 bg-orange-500 border-2 border-white dark:border-slate-800 shadow-sm transition-transform group-hover/item:scale-125 z-20"
                        />
                      )}
                    </LinkComponent>
                  );
                })}
                {(!data.buttons || data.buttons.length === 0) && (
                  <div className="text-[10px] text-gray-400 italic text-center border-2 border-dashed border-gray-100 rounded-md py-2">
                    No buttons added
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 bg-gray-400 border-2 border-white dark:border-slate-900 shadow-sm z-20"
        />

        {(!data.buttons || data.buttons.length === 0) && (
          <Handle
            type="source"
            position={Position.Bottom}
            className="w-3 h-3 bg-orange-500 border-2 border-white dark:border-slate-900 shadow-sm z-20"
          />
        )}
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
                  Are you sure you want to delete this button node?
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

export default memo(ButtonNode);
