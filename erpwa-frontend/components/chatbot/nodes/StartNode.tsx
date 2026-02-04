import React, { memo, useState } from "react";
import { Handle, Position, NodeProps, useReactFlow } from "reactflow";
import { Check, Rocket, PlayCircle } from "lucide-react";

const StartNode = ({ id, data, selected }: NodeProps) => {
  const { setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [localData, setLocalData] = useState({
    triggerKeyword: data?.triggerKeyword || "",
  });

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
    <div className="relative min-w-[200px]">
      <div
        className={`shadow-xl rounded-xl overflow-hidden bg-white dark:bg-slate-800 border-2 transition-all duration-300 ${
          selected
            ? "border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.5)] bg-purple-500/5"
            : "border-purple-500/30 shadow-[0_0_5px_rgba(168,85,247,0.1)] hover:border-purple-500/60 hover:shadow-[0_0_10px_rgba(168,85,247,0.2)]"
        }`}
      >
        {/* Node Header */}
        <div className="bg-gray-50/80 dark:bg-slate-900/80 px-3 py-2 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-purple-500 flex items-center justify-center text-white">
              <Rocket size={12} />
            </div>
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Start Flow
            </span>
          </div>
        </div>

        <div className="p-3 bg-white dark:bg-slate-800 space-y-3">
          {isEditing ? (
            <div className="space-y-3 nodrag">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">
                  Trigger Keywords
                </label>
                <input
                  type="text"
                  className="w-full text-xs font-bold border-none bg-gray-50 dark:bg-slate-900 dark:text-gray-200 p-2 rounded-md focus:ring-1 focus:ring-purple-500 outline-none"
                  value={localData.triggerKeyword}
                  onChange={(e) =>
                    setLocalData({
                      ...localData,
                      triggerKeyword: e.target.value,
                    })
                  }
                  placeholder="e.g. hello, hi, start"
                  autoFocus
                />
              </div>

              <button
                onClick={handleSave}
                className="w-full py-1.5 bg-purple-500 text-white text-[10px] font-bold rounded-md flex items-center justify-center gap-1 hover:bg-purple-600 transition-all active:scale-95"
              >
                <Check size={12} /> SAVE CHANGES
              </button>
            </div>
          ) : (
            <div
              className="cursor-text group"
              onDoubleClick={() => setIsEditing(true)}
            >
              <div className="text-[11px] font-bold text-gray-800 dark:text-gray-200 mb-1 flex items-center gap-1 group-hover:text-purple-600 transition-colors">
                <PlayCircle size={12} className="text-purple-500" />
                {data.triggerKeyword
                  ? `"${data.triggerKeyword}"`
                  : "Double click to set Triggers"}
              </div>

              <div className="text-[10px] text-gray-400 dark:text-gray-500 italic leading-snug">
                These keywords will start the flow (comma separated).
              </div>
            </div>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-purple-500 border-2 border-white dark:border-slate-900 shadow-sm"
      />
    </div>
  );
};

export default memo(StartNode);
