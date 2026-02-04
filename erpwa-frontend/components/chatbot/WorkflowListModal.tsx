"use client";

import React, { useEffect, useState } from "react";
import { X, Search, Trash2, Calendar } from "lucide-react";
import api from "@/lib/api";

interface WorkflowListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (workflow: any) => void;
}

export default function WorkflowListModal({
  isOpen,
  onClose,
  onSelect,
}: WorkflowListModalProps) {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadWorkflows();
    }
  }, [isOpen]);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const res = await api.get("/workflow");
      setWorkflows(res.data);
    } catch (error) {
      console.error("Failed to load workflows", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteWorkflow = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this workflow?")) return;

    try {
      await api.delete(`/workflow/${id}`);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
    } catch (error) {
      console.error("Failed to delete", error);
    }
  };

  if (!isOpen) return null;

  const filtered = workflows.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.triggerKeyword?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between bg-gray-50 dark:bg-slate-900">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            My Workflows
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-4 border-b border-gray-100 dark:border-slate-700">
          <div className="relative">
            <Search
              className="absolute left-3 top-2.5 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search workflows..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400">
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-400 italic">
              No workflows found
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((w) => (
                <div
                  key={w.id}
                  onClick={() => onSelect(w)}
                  className="group p-4 border border-gray-100 dark:border-slate-700 rounded-lg hover:border-primary/50 hover:bg-blue-50/30 dark:hover:bg-slate-700/50 transition-all cursor-pointer flex justify-between items-center"
                >
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-gray-200">
                      {w.name}
                    </h3>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                        Trigger:{" "}
                        <span className="font-mono text-gray-700 dark:text-gray-300 font-semibold">
                          {w.triggerKeyword || "N/A"}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />{" "}
                        {new Date(w.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => deleteWorkflow(e, w.id)}
                    className="p-2 text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete Workflow"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
