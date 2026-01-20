"use client";

import { motion } from "framer-motion";
import { Smile, Paperclip, Mic, Send } from "lucide-react";
import type { Message, Conversation } from "@/lib/types";

interface Props {
  conversation: Conversation;
  inputValue: string;
  setInputValue: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  replyTo: Message | null;
  onCancelReply: () => void;
  onSend: () => void;
  onToggleAttach: () => void;
  onSendTemplate: () => void;
  isSessionActive: boolean;
}

export default function ChatFooter({
  conversation,
  inputValue,
  setInputValue,
  inputRef,
  replyTo,
  onCancelReply,
  onSend,
  onToggleAttach,
  onSendTemplate,
  isSessionActive,
}: Props) {
  return (
    <div className="relative z-10 flex-shrink-0 bg-card border-t border-border">
      {/* REPLY PREVIEW */}
      {replyTo && (
        <div className="px-4 py-2 bg-muted/50 border-l-4 border-primary flex items-center justify-between">
          <div className="text-xs min-w-0">
            <div className="font-medium">
              {replyTo.sender === "executive"
                ? "You"
                : conversation.companyName}
            </div>
            <div className="truncate max-w-xs text-muted-foreground">
              {replyTo.text || "Media message"}
            </div>
          </div>

          <button
            onClick={onCancelReply}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* INPUT ROW */}
      <div className="px-3 sm:px-4 py-2.5 sm:py-3">
        <div className="flex items-center gap-2">
          {/* LEFT ICONS */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              className="p-1.5 sm:p-2 rounded-full hover:bg-muted"
            >
              <Smile className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={onToggleAttach}
              className="p-1.5 sm:p-2 rounded-full hover:bg-muted"
            >
              <Paperclip className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            </motion.button>
          </div>

          {/* TEXT INPUT */}
          <div className="flex-1 bg-muted/50 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5">
            <input
              ref={inputRef}
              type="text"
              disabled={!isSessionActive}
              placeholder={
                isSessionActive ? "Type a message" : "Template message required"
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.nativeEvent.isComposing &&
                  isSessionActive
                ) {
                  e.preventDefault();
                  onSend();
                }
              }}
              className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
            />
          </div>

          {/* RIGHT ACTION */}
          {!isSessionActive ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={onSendTemplate}
              className="bg-primary text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap"
            >
              <span className="hidden sm:inline">Send Template</span>
              <span className="sm:hidden">Template</span>
            </motion.button>
          ) : inputValue.trim() ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={onSend}
              className="bg-primary text-white p-2 sm:p-2.5 rounded-full"
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            </motion.button>
          ) : (
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              className="p-1.5 sm:p-2 rounded-full hover:bg-muted"
            >
              <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
