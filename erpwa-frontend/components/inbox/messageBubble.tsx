"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { MoreVertical, Check, CheckCheck, AlertCircle } from "lucide-react";
import type { Message, Conversation } from "@/lib/types";

interface Props {
  message: Message;
  conversation: Conversation;
  allMessages: Message[];
  onOpenMenu: (message: Message, rect: DOMRect) => void;
  onReply: (message: Message) => void;
  setInputValue: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export default function MessageBubble({
  message: msg,
  conversation,
  allMessages,
  onOpenMenu,
  onReply,
  setInputValue,
  inputRef,
}: Props) {
  const repliedMessage =
    msg.replyTo ??
    allMessages.find((m) => m.whatsappMessageId === msg.replyToMessageId);

  const cleanText =
    (msg.text || "")
      .replace(/^\[(image|video|audio|document)\s+message\]\s*/i, "")
      .trim() || (msg.caption || "").trim();

  const isImage = !!(msg.mediaUrl && msg.mimeType?.startsWith("image/"));
  const isVideo = !!(msg.mediaUrl && msg.mimeType?.startsWith("video/"));
  const isMedia = isImage || isVideo;

  const formattedTime = new Date(msg.timestamp)
    .toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase();

  const getMessageStatusIcon = (status?: Message["status"]) => {
    if (!status) return null;
    if (status === "sent") return <Check className="w-4 h-4" />;
    if (status === "delivered") return <CheckCheck className="w-4 h-4" />;
    if (status === "read")
      return <CheckCheck className="w-4 h-4 text-blue-500" />;
    if (status === "failed")
      return <AlertCircle className="w-4 h-4 text-destructive" />;
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex items-end gap-2 ${
        msg.sender === "executive" ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`group relative shadow-sm overflow-hidden flex flex-col
        ${
          msg.sender === "executive"
            ? "bg-[#DCF8C6] dark:bg-[#005C4B] rounded-br-none"
            : "bg-white dark:bg-[#202C33] rounded-bl-none"
        }
        rounded-lg max-w-[85%] md:max-w-md`}
      >
        {/* MEDIA */}
        {isImage && msg.mediaUrl && (
          <img
            src={msg.mediaUrl}
            className="w-full max-h-[500px] object-cover cursor-pointer"
            onClick={() => window.open(msg.mediaUrl!, "_blank")}
          />
        )}

        {/* REPLY BUBBLE */}
        {msg.replyToMessageId && repliedMessage && (
          <div className="mx-2 mt-2 px-3 py-2 bg-black/5 dark:bg-white/10 border-l-4 border-primary rounded flex gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-primary mb-1">
                {repliedMessage.sender === "executive"
                  ? "You"
                  : conversation.companyName}
              </div>
              <div className="text-xs text-muted-foreground line-clamp-2">
                {/* Show text content first if available */}
                {repliedMessage.text && repliedMessage.text}
                {/* If no text but has caption, show caption */}
                {!repliedMessage.text &&
                  repliedMessage.caption &&
                  repliedMessage.caption}
                {/* If no text/caption but has media, show media type */}
                {!repliedMessage.text &&
                  !repliedMessage.caption &&
                  repliedMessage.mimeType?.startsWith("image/") &&
                  "📷 Photo"}
                {!repliedMessage.text &&
                  !repliedMessage.caption &&
                  repliedMessage.mimeType?.startsWith("video/") &&
                  "🎥 Video"}
                {!repliedMessage.text &&
                  !repliedMessage.caption &&
                  repliedMessage.mimeType?.startsWith("audio/") &&
                  "🎵 Audio"}
                {/* Fallback */}
                {!repliedMessage.text &&
                  !repliedMessage.caption &&
                  !repliedMessage.mimeType &&
                  "Message"}
              </div>
            </div>
            {/* Media Thumbnail */}
            {repliedMessage.mediaUrl && (
              <div className="flex-shrink-0">
                {repliedMessage.mimeType?.startsWith("image/") && (
                  <img
                    src={repliedMessage.mediaUrl}
                    alt="Preview"
                    className="w-12 h-12 rounded object-cover"
                  />
                )}
                {repliedMessage.mimeType?.startsWith("video/") && (
                  <div className="relative w-12 h-12 rounded bg-black/20 flex items-center justify-center">
                    <img
                      src={repliedMessage.mediaUrl}
                      alt="Preview"
                      className="w-full h-full rounded object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center">
                        <svg
                          className="w-3 h-3 text-white"
                          fill="currentColor"
                          viewBox="0 0 16 16"
                        >
                          <path d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TEXT */}
        {cleanText && (
          <div className="px-3 py-2 text-sm break-words whitespace-pre-wrap">
            {cleanText}
          </div>
        )}

        {/* TEMPLATE FOOTER */}
        {msg.template?.footer && (
          <div className="px-3 pb-2 text-xs text-muted-foreground italic">
            {msg.template.footer}
          </div>
        )}

        {/* TEMPLATE BUTTONS */}
        {msg.template?.buttons && msg.template.buttons.length > 0 && (
          <div className="border-t border-border/30 mt-1">
            {msg.template.buttons.map((btn, idx) => (
              <button
                key={idx}
                className="w-full px-3 py-2.5 text-sm text-primary hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-center border-b border-border/30 last:border-b-0 font-medium"
                onClick={() => {
                  if (btn.type === "URL" && btn.value) {
                    window.open(btn.value, "_blank");
                  }
                }}
              >
                {btn.type === "URL" && "🔗 "}
                {btn.type === "PHONE_NUMBER" && "📞 "}
                {btn.text}
              </button>
            ))}
          </div>
        )}

        {/* TIME + STATUS */}
        <div className="flex items-center justify-end gap-1 px-2 pb-1">
          <span className="text-[11px] text-muted-foreground">
            {formattedTime}
          </span>
          {msg.sender === "executive" && (
            <span
              className={
                msg.status === "read"
                  ? "text-blue-500"
                  : "text-muted-foreground"
              }
            >
              {getMessageStatusIcon(msg.status)}
            </span>
          )}
        </div>

        {/* MENU */}
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100">
          <button
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              onOpenMenu(msg, rect);
            }}
            className="p-1 rounded-full bg-white/80 shadow"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
