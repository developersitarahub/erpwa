"use client";

import { AnimatePresence } from "framer-motion";
import type { Message, Conversation } from "@/lib/types";
import MessageBubble from "./messageBubble";

interface Props {
  messages: Message[];
  conversation: Conversation;
  onOpenMenu: (msg: Message, rect: DOMRect) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onReply: (message: Message) => void;
  setInputValue: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export default function ChatMessages({
  messages,
  conversation,
  onOpenMenu,
  messagesEndRef,
  onReply,
  setInputValue,
  inputRef,
}: Props) {
  const isNewDay = (a: string, b: string) =>
    new Date(a).toDateString() !== new Date(b).toDateString();

  const getDateLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="relative z-10 h-full overflow-y-auto">
      <div className="p-3 sm:p-4 space-y-2">
        <AnimatePresence>
          {messages.map((msg, i) => (
            <div key={msg.id}>
              {(i === 0 ||
                isNewDay(messages[i - 1].timestamp, msg.timestamp)) && (
                <div className="flex justify-center my-4">
                  <span className="px-3 py-1 text-xs rounded-full bg-[#D1D7DB] dark:bg-[#182229] text-[#54656f] dark:text-[#8696a0] shadow-sm font-medium">
                    {getDateLabel(msg.timestamp)}
                  </span>
                </div>
              )}

              <MessageBubble
                message={msg}
                conversation={conversation}
                onOpenMenu={onOpenMenu}
                allMessages={messages}
                onReply={onReply}
                setInputValue={setInputValue}
                inputRef={inputRef}
              />
            </div>
          ))}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
