"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Phone, Video, MoreVertical } from "lucide-react";
import type { Conversation } from "@/lib/types";

export default function ChatHeader({
  conversation,
  onBack,
}: {
  conversation: Conversation;
  onBack?: () => void;
}) {
  return (
    <div className="relative z-10 bg-card px-4 py-2.5 flex items-center justify-between border-b border-border flex-shrink-0">
      <div className="flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="md:hidden">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
        )}

        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-semibold">
          {conversation.companyName?.charAt(0)?.toUpperCase() || "?"}
        </div>

        <div>
          <h3 className="font-medium text-foreground">
            {conversation.companyName}
          </h3>
          <p className="text-xs text-muted-foreground">{conversation.phone}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <motion.button className="p-2 rounded-full">
          <Video className="w-5 h-5 text-muted-foreground" />
        </motion.button>
        <motion.button className="p-2 rounded-full">
          <Phone className="w-5 h-5 text-muted-foreground" />
        </motion.button>
        <motion.button className="p-2 rounded-full">
          <MoreVertical className="w-5 h-5 text-muted-foreground" />
        </motion.button>
      </div>
    </div>
  );
}
