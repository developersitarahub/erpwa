import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  ChevronDown,
} from "lucide-react";
import type { Conversation } from "@/lib/types";
import { toast } from "react-toastify";

export default function ChatHeader({
  conversation,
  onBack,
  onUpdateLeadStatus,
}: {
  conversation: Conversation;
  onBack?: () => void;
  onUpdateLeadStatus?: (leadId: number, status: string) => Promise<void>;
}) {
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        statusRef.current &&
        !statusRef.current.contains(event.target as Node)
      ) {
        setIsStatusOpen(false);
      }
    }
    if (isStatusOpen)
      document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isStatusOpen]);

  const statusColors: Record<string, string> = {
    new: "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30",
    contacted:
      "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
    qualified:
      "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30",
    converted:
      "bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30",
    lost: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
  };

  const statusLabels: Record<string, string> = {
    new: "New",
    contacted: "Contacted",
    qualified: "Qualified",
    converted: "Converted",
    lost: "Lost",
  };

  const currentStatus = conversation.status || "new";

  return (
    <div className="relative z-50 bg-card px-3 sm:px-4 py-2.5 flex items-center justify-between border-b border-border flex-shrink-0 shadow-sm">
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
        {onBack && (
          <button onClick={onBack} className="md:hidden">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
        )}

        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-semibold flex-shrink-0">
          {conversation.companyName?.charAt(0)?.toUpperCase() || "?"}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-sm sm:text-base text-foreground truncate">
            {conversation.companyName}
          </h3>
          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
            {conversation.phone}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {/* Lead Status Dropdown */}
        {conversation.leadId && onUpdateLeadStatus && (
          <div className="relative block" ref={statusRef}>
            <button
              onClick={() => setIsStatusOpen(!isStatusOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${statusColors[currentStatus] || "bg-secondary text-foreground"}`}
            >
              <div className={`w-2 h-2 rounded-full bg-current opacity-70`} />
              {statusLabels[currentStatus] || currentStatus}
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>

            {isStatusOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-xl py-1 z-[100] overflow-hidden">
                {Object.entries(statusLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      if (key === currentStatus) {
                        setIsStatusOpen(false);
                        return;
                      }

                      setIsStatusOpen(false);

                      toast.info(
                        <div className="flex flex-col gap-3">
                          <p className="font-medium">
                            Change lead status to "{label}"?
                          </p>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => {
                                toast.dismiss();
                              }}
                              className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                onUpdateLeadStatus(conversation.leadId!, key);
                                toast.dismiss();
                                toast.success(`Status updated to ${label}`);
                              }}
                              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
                            >
                              Confirm
                            </button>
                          </div>
                        </div>,
                        {
                          autoClose: false,
                          closeButton: false,
                          position: "top-center",
                        },
                      );
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-muted/80 transition-colors flex items-center gap-3 cursor-pointer ${key === currentStatus ? "bg-muted/50 font-medium" : "text-foreground"}`}
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${statusColors[key]?.match(/text-(\w+-\d+)/)?.[1] ? `bg-${statusColors[key]?.match(/text-(\w+-\d+)/)?.[1]}` : "bg-gray-400"}`}
                    />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <motion.button className="hidden sm:flex p-2 rounded-full hover:bg-muted/50">
          <Video className="w-5 h-5 text-muted-foreground" />
        </motion.button>
        <motion.button className="hidden sm:flex p-2 rounded-full hover:bg-muted/50">
          <Phone className="w-5 h-5 text-muted-foreground" />
        </motion.button>
        <motion.button className="p-1.5 sm:p-2 rounded-full hover:bg-muted/50">
          <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
        </motion.button>
      </div>
    </div>
  );
}
