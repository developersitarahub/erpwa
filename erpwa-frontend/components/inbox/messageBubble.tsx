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
        className="shrink-0 w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
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
      <span className="text-xs text-muted-foreground shrink-0">
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
      .replace(/^\[(image|video|audio|document)(?:\s+message)?\]\s*/i, "")
      .trim() ||
    (msg.caption || "").trim() ||
    (msg.template?.body?.text || "").trim();

  // Resolve media from outboundPayload if not present at top level (e.g. Chatbot Image Nodes)
  const outboundMedia =
    msg.outboundPayload?.image ||
    msg.outboundPayload?.video ||
    msg.outboundPayload?.audio ||
    msg.outboundPayload?.document;

  const effectiveMediaUrl =
    msg.mediaUrl || outboundMedia?.link || outboundMedia?.url;
  const effectiveCaption = msg.caption || outboundMedia?.caption;
  let effectiveMimeType = msg.mimeType;

  if (!effectiveMimeType && outboundMedia) {
    if (msg.outboundPayload?.image) effectiveMimeType = "image/jpeg";
    else if (msg.outboundPayload?.video) effectiveMimeType = "video/mp4";
    else if (msg.outboundPayload?.audio) effectiveMimeType = "audio/mpeg";
    else if (msg.outboundPayload?.document)
      effectiveMimeType = "application/pdf";
  }

  const isImage = !!(
    effectiveMediaUrl &&
    effectiveMimeType?.startsWith("image/") &&
    msg.template?.header?.type !== "IMAGE"
  );
  const isVideo = !!(
    effectiveMediaUrl &&
    effectiveMimeType?.startsWith("video/") &&
    msg.template?.header?.type !== "VIDEO"
  );
  const isAudio = !!(
    effectiveMediaUrl && effectiveMimeType?.startsWith("audio/")
  );
  const isDocument = !!(
    effectiveMediaUrl &&
    (effectiveMimeType?.startsWith("application/") ||
      effectiveMimeType?.includes("document")) &&
    msg.template?.header?.type !== "DOCUMENT"
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

  const renderTimestamp = ({
    isOverlay = false,
    customClass = "",
  }: {
    isOverlay?: boolean;
    customClass?: string;
  } = {}) => (
    <div className={`flex items-center gap-0.5 select-none ${customClass}`}>
      <span
        className={`text-[10px] lowercase leading-none ${isOverlay
            ? "text-white drop-shadow-sm font-medium"
            : "text-muted-foreground/60"
          }`}
      >
        {formattedTime}
      </span>
      {msg.sender === "executive" && (
        <span
          className={
            msg.status === "read"
              ? "text-blue-500"
              : isOverlay
                ? "text-white drop-shadow-sm"
                : "text-muted-foreground/60"
          }
        >
          {getMessageStatusIcon(msg.status)}
        </span>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex items-end gap-2 ${msg.sender === "executive" ? "justify-end" : "justify-start"
        }`}
    >
      <div
        className={`flex flex-col gap-1
        max-w-[70%] sm:max-w-[60%] md:max-w-[50%] lg:max-w-[40%] xl:max-w-[35%]
        ${msg.outboundPayload?.interactive || msg.template?.buttons
            ? "min-w-[200px]"
            : "min-w-[120px]"
          }`}
      >
        {/* MAIN TEXT/MEDIA BUBBLE */}
        <div
          className={`group relative shadow-sm overflow-hidden flex flex-col border border-black/5 dark:border-white/5 p-0
          ${msg.sender === "executive"
              ? "bg-wa-outbound rounded-br-none"
              : "bg-wa-inbound rounded-bl-none"
            }
          rounded-lg max-w-full`}
        >
          {/* TEMPLATE HEADER (Rich Media) */}
          {msg.template?.header && (
            <div className="relative">
              {msg.template.header.type === "IMAGE" &&
                msg.template.header.mediaUrl && (
                  <div className="relative">
                    <img
                      src={msg.template.header.mediaUrl}
                      alt="Header"
                      className="w-full h-auto object-cover"
                    />

                    {/* ⏰ TIME OVERLAY */}
                    {!cleanText &&
                      renderTimestamp({
                        isOverlay: true,
                        customClass:
                          "absolute bottom-1.5 right-2 bg-black/20 rounded px-1 py-0.5 backdrop-blur-[2px]",
                      })}
                  </div>
                )}

              {msg.template.header.type === "VIDEO" &&
                msg.template.header.mediaUrl && (
                  <video
                    src={msg.template.header.mediaUrl}
                    controls
                    className="w-full h-[180px] object-cover"
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
                      className="text-sm font-medium underline truncate"
                    >
                      View Document
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

          {/* INNER CONTENT WRAPPER */}
          <div className="p-1 flex flex-col gap-1">
            {/* MEDIA */}
            {isImage && effectiveMediaUrl && (
              <div className="relative">
                <img
                  src={effectiveMediaUrl}
                  alt="Image"
                  className="max-w-[300px] max-h-[300px] w-auto h-auto object-cover rounded-lg cursor-pointer"
                  onClick={() => window.open(effectiveMediaUrl!, "_blank")}
                />
                {!cleanText &&
                  renderTimestamp({
                    isOverlay: true,
                    customClass:
                      "absolute bottom-1.5 right-2 bg-black/20 rounded px-1 py-0.5 backdrop-blur-[2px]",
                  })}
              </div>
            )}

            {isVideo && effectiveMediaUrl && (
              <div className="relative">
                <video
                  src={effectiveMediaUrl}
                  controls
                  className="max-w-[300px] max-h-[300px] w-auto h-auto object-cover rounded-lg"
                />
                {!cleanText &&
                  renderTimestamp({
                    isOverlay: true,
                    customClass:
                      "absolute bottom-6 right-2 bg-black/20 rounded px-1 py-0.5 backdrop-blur-[2px]",
                  })}
              </div>
            )}

            {isAudio && effectiveMediaUrl && (
              <div className="relative">
                <AudioPlayer mediaUrl={effectiveMediaUrl} />
                {!cleanText &&
                  renderTimestamp({ customClass: "absolute bottom-1 right-2" })}
              </div>
            )}

            {isDocument && effectiveMediaUrl && (
              <div className="relative flex items-center gap-3 px-3 py-3 bg-muted/30 dark:bg-muted/10 rounded-lg pb-5">
                <div className="shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
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
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {effectiveCaption || "Document"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {effectiveMimeType?.split("/")[1]?.toUpperCase() || "FILE"}{" "}
                    • {effectiveMediaUrl ? "Tap to view" : "Unknown size"}
                  </p>
                </div>
                <a
                  href={effectiveMediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
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
                {!cleanText &&
                  renderTimestamp({ customClass: "absolute bottom-1 right-2" })}
              </div>
            )}

            {/* REPLY BUBBLE */}
            {msg.replyToMessageId && repliedMessage && (
              <div
                className="mx-1 px-3 py-2 bg-black/5 dark:bg-white/10 border-l-4 border-primary rounded flex gap-2 cursor-pointer"
                onClick={() => onReply?.(repliedMessage)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-primary mb-1">
                    {repliedMessage.sender === "executive"
                      ? "You"
                      : conversation.companyName}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {repliedMessage.text ||
                      repliedMessage.caption ||
                      "Media Message"}
                  </div>
                </div>
                {repliedMessage.mediaUrl && (
                  <div className="shrink-0 w-12 h-12 rounded bg-muted/20 overflow-hidden">
                    {repliedMessage.mimeType?.startsWith("image/") ? (
                      <img
                        src={repliedMessage.mediaUrl}
                        alt="Reply"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-muted-foreground"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                        >
                          <rect
                            x="3"
                            y="3"
                            width="18"
                            height="18"
                            rx="2"
                            ry="2"
                          ></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TEXT */}
            {cleanText && (
              <div className="px-1 text-sm break-words whitespace-pre-wrap">
                {cleanText}
                <span className="float-right ml-2 mt-1 -mb-1">
                  {renderTimestamp()}
                </span>
              </div>
            )}

            {/* TEMPLATE FOOTER */}
            {msg.template?.footer && (
              <div className="px-1 text-xs text-muted-foreground italic opacity-80">
                {msg.template.footer}
              </div>
            )}
          </div>
          {/* END INNER CONTENT WRAPPER */}

          {/* HOVER MENU DOTS */}
          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                onOpenMenu(msg, rect);
              }}
              className="p-1 rounded-full bg-white/80 dark:bg-black/50 shadow hover:bg-white dark:hover:bg-black/70"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* TEMPLATE BUTTONS (External) */}
        {msg.template?.buttons && msg.template.buttons.length > 0 && (
          <div className="w-full flex flex-col gap-1">
            <div
              className={`flex gap-1.5 w-full ${msg.template.buttons.length === 2 ? "flex-row" : "flex-col"
                }`}
            >
              {msg.template.buttons.map((btn, idx) => (
                <button
                  key={idx}
                  className={`flex-1 w-full hover:brightness-95 shadow-sm rounded-lg py-2 px-3 text-[#00a884] dark:text-[#53bdeb] font-semibold text-center text-sm transition-all active:scale-[0.98] border border-black/5 dark:border-white/5 ${msg.sender === "executive"
                      ? "bg-wa-outbound"
                      : "bg-wa-inbound"
                    }`}
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
          </div>
        )}

        {/* CAROUSEL CARDS */}
        {(msg.template?.templateType === "carousel" ||
          (msg.carouselCards && msg.carouselCards.length > 0) ||
          (msg.template?.carouselCards &&
            msg.template.carouselCards.length > 0)) && (
            <div className="flex overflow-x-auto gap-2 px-2 pb-2 mt-2 snap-x scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
              {(msg.carouselCards || msg.template?.carouselCards || []).map(
                (card, idx) => (
                  <div
                    key={idx}
                    className="shrink-0 w-[220px] bg-wa-inbound rounded-2xl shadow-sm border border-border/50 overflow-hidden snap-center flex flex-col"
                  >
                    <div className="p-3">
                      {/* Card Media */}
                      {(card.mediaUrl || card.s3Url) && (
                        <div className="relative h-28 w-full bg-muted mb-3 rounded-lg overflow-hidden">
                          {card.mimeType?.startsWith("video") ? (
                            <video
                              src={card.mediaUrl || card.s3Url}
                              className="w-full h-full object-cover"
                              controls={false}
                            />
                          ) : (
                            <img
                              src={card.mediaUrl || card.s3Url}
                              alt={card.title}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                      )}
                      {/* Card Content */}
                      <div className="flex-1">
                        {card.title && (
                          <p className="font-bold text-sm text-foreground line-clamp-1 mb-1">
                            {idx + 1}. {card.title}
                          </p>
                        )}
                        {card.subtitle && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {card.subtitle}
                          </p>
                        )}
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
                ),
              )}
            </div>
          )}

        {/* LIST MENUS (External) */}
        {msg.outboundPayload?.interactive &&
          msg.outboundPayload.interactive.type === "list" && (
            <div className="w-full">
              <button
                className={`w-full hover:brightness-95 shadow-sm rounded-lg py-2 px-3 text-[#00a884] dark:text-[#53bdeb] font-semibold text-center text-sm transition-all active:scale-[0.98] border border-black/5 dark:border-white/5 flex items-center justify-center gap-2 ${msg.sender === "executive"
                    ? "bg-wa-outbound"
                    : "bg-wa-inbound"
                  }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
                {msg.outboundPayload.interactive.action?.button || "Menu"}
              </button>
            </div>
          )}

        {/* EXTERNAL REPLY BUTTONS */}
        {msg.outboundPayload?.interactive &&
          msg.outboundPayload.interactive.type === "button" && (
            <div className="w-full flex flex-col gap-1">
              <div
                className={`flex gap-1.5 w-full ${msg.outboundPayload.interactive.action?.buttons?.length === 2
                    ? "flex-row"
                    : "flex-col"
                  }`}
              >
                {msg.outboundPayload.interactive.action?.buttons?.map(
                  (btn: any, idx: number) => (
                    <button
                      key={idx}
                      className={`flex-1 w-full hover:brightness-95 shadow-sm rounded-lg py-2 px-3 text-[#00a884] dark:text-[#53bdeb] font-semibold text-center text-sm transition-all active:scale-[0.98] border border-black/5 dark:border-white/5 ${msg.sender === "executive"
                          ? "bg-wa-outbound"
                          : "bg-wa-inbound"
                        }`}
                    >
                      {btn.reply?.title}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}

        {/* CTA URL (External) */}
        {msg.outboundPayload?.interactive &&
          msg.outboundPayload.interactive.type === "cta_url" && (
            <div className="w-full">
              <button
                className={`w-full hover:brightness-95 shadow-sm rounded-lg py-2 px-3 text-[#00a884] dark:text-[#53bdeb] font-semibold text-center text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 border border-black/5 dark:border-white/5 ${msg.sender === "executive"
                    ? "bg-wa-outbound"
                    : "bg-wa-inbound"
                  }`}
                onClick={() => {
                  const url =
                    msg.outboundPayload?.interactive?.action?.parameters?.url;
                  if (url) window.open(url, "_blank");
                }}
              >
                🔗{" "}
                {msg.outboundPayload.interactive.action?.parameters
                  ?.display_text || "Click Here"}
              </button>
            </div>
          )}
      </div>
    </motion.div>
  );
}
