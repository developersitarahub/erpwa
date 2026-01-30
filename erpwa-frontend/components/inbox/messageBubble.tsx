"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { MoreVertical, Check, CheckCheck, AlertCircle } from "lucide-react";
import type { Message, Conversation } from "@/lib/types";
import { useState, useRef } from "react";

interface Props {
  message: Message;
  conversation: Conversation;
  allMessages: Message[];
  onOpenMenu: (message: Message, rect: DOMRect) => void;
  onReply: (message: Message) => void;
  setInputValue: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

// Audio Player Component
function AudioPlayer({ mediaUrl }: { mediaUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Calculate remaining time and progress percentage
  const remainingTime = duration - currentTime;
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Handle seeking
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 min-w-[250px]">
      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
      >
        {isPlaying ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="text-primary"
          >
            <rect x="4" y="3" width="3" height="10" />
            <rect x="9" y="3" width="3" height="10" />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="text-primary ml-0.5"
          >
            <path d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" />
          </svg>
        )}
      </button>

      {/* Progress Bar & Audio */}
      <div className="flex-1 flex items-center gap-2">
        {/* Interactive Waveform Progress Bar */}
        <div
          className="flex-1 h-8 flex items-center gap-0.5 cursor-pointer"
          onClick={handleSeek}
        >
          {[3, 5, 4, 6, 3, 7, 4, 5, 3, 6, 4, 5, 3, 4, 6, 3, 5, 4].map(
            (height, i) => {
              // Calculate if this bar should be filled based on progress
              const barPercentage = ((i + 1) / 18) * 100;
              const isFilled = barPercentage <= progressPercentage;

              return (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-all ${isFilled
                    ? "bg-primary"
                    : "bg-primary/30 hover:bg-primary/40"
                    }`}
                  style={{ height: `${height * 3}px`, minWidth: "2px" }}
                />
              );
            },
          )}
        </div>

        {/* Hidden Audio Element */}
        <audio
          ref={audioRef}
          src={mediaUrl}
          onEnded={() => setIsPlaying(false)}
          onLoadedMetadata={(e) => {
            const audio = e.currentTarget;
            setDuration(audio.duration);
          }}
          onTimeUpdate={(e) => {
            const audio = e.currentTarget;
            setCurrentTime(audio.currentTime);
          }}
        />
      </div>

      {/* Remaining Time */}
      <span className="text-xs text-muted-foreground flex-shrink-0">
        {formatTime(remainingTime)}
      </span>
    </div>
  );
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
      .trim() ||
    (msg.caption || "").trim() ||
    (msg.template?.body?.text || "").trim();

  const isImage = !!(msg.mediaUrl && msg.mimeType?.startsWith("image/"));
  const isVideo = !!(msg.mediaUrl && msg.mimeType?.startsWith("video/"));
  const isAudio = !!(msg.mediaUrl && msg.mimeType?.startsWith("audio/"));
  const isDocument = !!(
    msg.mediaUrl &&
    (msg.mimeType?.startsWith("application/") ||
      msg.mimeType?.includes("document"))
  );
  const isMedia = isImage || isVideo || isAudio || isDocument;

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
      className={`flex items-end gap-2 ${msg.sender === "executive" ? "justify-end" : "justify-start"
        }`}
    >
      <div
        className={`group relative shadow-sm overflow-hidden flex flex-col
        ${msg.sender === "executive"
            ? "bg-wa-outbound rounded-br-none"
            : "bg-wa-inbound rounded-bl-none"
          }
        rounded-lg max-w-[50%] sm:max-w-[40%] md:max-w-[35%] lg:max-w-[30%] xl:max-w-[25%]`}
      >
        {/* TEMPLATE HEADER (Rich Media) */}
        {msg.template?.header && (
          <div className="rounded-t-lg overflow-hidden">
            {msg.template.header.type === "IMAGE" &&
              msg.template.header.mediaUrl && (
                <div className="relative w-full h-auto">
                  <Image
                    src={msg.template.header.mediaUrl}
                    alt="Header"
                    width={500}
                    height={300}
                    className="w-full h-auto object-cover max-h-[300px]"
                  />
                </div>
              )}
            {msg.template.header.type === "VIDEO" &&
              msg.template.header.mediaUrl && (
                <video
                  src={msg.template.header.mediaUrl}
                  controls
                  className="w-full h-auto max-h-[300px]"
                />
              )}
            {msg.template.header.type === "DOCUMENT" &&
              msg.template.header.mediaUrl && (
                <div className="flex items-center gap-2 p-3 bg-muted/20 border-b border-border/10">
                  <div className="p-2 bg-red-100 rounded text-red-600">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                  </div>
                  <a
                    href={msg.template.header.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline truncate"
                  >
                    Document
                  </a>
                </div>
              )}
            {msg.template.header.type === "TEXT" &&
              msg.template.header.text && (
                <div className="px-3 pt-3 pb-1 font-bold text-sm">
                  {msg.template.header.text}
                </div>
              )}
          </div>
        )}
        {/* MEDIA */}
        {isImage && msg.mediaUrl && (
          <img
            src={msg.mediaUrl}
            alt="Image"
            className="w-full max-h-[500px] object-cover cursor-pointer"
            onClick={() => window.open(msg.mediaUrl!, "_blank")}
          />
        )}

        {isVideo && msg.mediaUrl && (
          <video
            src={msg.mediaUrl}
            controls
            className="w-full max-h-[500px] object-cover"
          />
        )}

        {isAudio && msg.mediaUrl && <AudioPlayer mediaUrl={msg.mediaUrl} />}

        {isDocument && msg.mediaUrl && (
          <div className="flex items-center gap-3 px-3 py-3 bg-muted/30 dark:bg-muted/10 rounded-lg mx-2 my-1">
            {/* Document Icon */}
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-primary"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>

            {/* File Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {msg.caption || "Document"}
              </p>
              <p className="text-xs text-muted-foreground">
                {msg.mimeType?.split("/")[1]?.toUpperCase() || "FILE"} •{" "}
                {msg.mediaUrl ? "Tap to view" : "Unknown size"}
              </p>
            </div>

            {/* Download Button */}
            <a
              href={msg.mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-primary"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </a>
          </div>
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

        {/* CAROUSEL CARDS */}
        {(msg.template?.templateType === "carousel" || (msg.carouselCards && msg.carouselCards.length > 0) || (msg.template?.carouselCards && msg.template.carouselCards.length > 0)) && (
          <div className="flex overflow-x-auto gap-2 px-2 pb-2 mt-2 snap-x scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
            {((msg.carouselCards || msg.template?.carouselCards) || []).map((card, idx) => (
              <div
                key={idx}
                className="flex-shrink-0 w-[220px] bg-wa-inbound rounded-2xl shadow-sm border border-border/50 overflow-hidden snap-center flex flex-col"
              >
                <div className="p-3">
                  {/* Card Media */}
                  {(card.mediaUrl || card.s3Url) && (
                    <div className="relative h-28 w-full bg-muted mb-3 rounded-lg overflow-hidden">
                      {card.mimeType?.startsWith("video") ? (
                        <video src={card.mediaUrl || card.s3Url} className="w-full h-full object-cover" controls={false} />
                      ) : (
                        <img src={card.mediaUrl || card.s3Url} alt={card.title} className="w-full h-full object-cover" />
                      )}
                    </div>
                  )}
                  {/* Card Content */}
                  <div className="flex-1">
                    {card.title && <p className="font-bold text-sm text-foreground line-clamp-1 mb-1">{idx + 1}. {card.title}</p>}
                    {card.subtitle && <p className="text-xs text-muted-foreground line-clamp-2">{card.subtitle}</p>}
                  </div>
                </div>

                {/* Card Button */}
                {card.buttonText && (
                  <button
                    className="w-full py-2.5 text-sm text-[#0084ff] dark:text-[#53bdeb] font-semibold border-t border-border/30 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    onClick={() => {
                      if (card.buttonType === "URL" && card.buttonValue) {
                        window.open(card.buttonValue, "_blank");
                      }
                    }}
                  >
                    {card.buttonText}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TEMPLATE BUTTONS (Standard) */}
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
