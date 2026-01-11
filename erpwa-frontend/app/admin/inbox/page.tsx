"use client";

import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";
import { getSocket, connectSocket } from "@/lib/socket";
import { processMedia } from "@/lib/mediaProcessor";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Phone,
  Video,
  MoreVertical,
  ArrowLeft,
  Smile,
  Paperclip,
  Mic,
  Send,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  MessageSquareIcon,
} from "lucide-react";
import Image from "next/image";
import { toast } from "react-toastify";

/* =======================
   UI MODELS (UNCHANGED)
======================= */

interface Message {
  id: string;
  whatsappMessageId?: string;
  replyToMessageId?: string;

  // 👇 ADD THIS (frontend only)
  replyTo?: {
    sender: "customer" | "executive";
    text?: string;
    mediaUrl?: string;
    mimeType?: string;
    caption?: string;
  };

  text?: string;
  mediaUrl?: string; // image / video
  mimeType?: string; // image/jpeg, video/mp4
  caption?: string;
  sender: "customer" | "executive";
  timestamp: string;
  status?: "sent" | "delivered" | "read" | "failed" | "received";
  template?: {
    footer?: string;
    buttons?: Array<{ text: string; type: string }>;
  };
}

interface Conversation {
  id: string;
  companyName: string;
  phone: string;

  lastMessage: string;
  lastActivity: string;

  lastMessageDirection?: "inbound" | "outbound";
  lastMessageStatus?: "sent" | "delivered" | "read" | "received" | "failed";
  unreadCount?: number;
  hasUnread?: boolean;

  sessionStarted?: boolean; // ✅ ADD
  sessionActive?: boolean; // ✅ ADD
  sessionExpiresAt?: string | null;
  templateRequired?: boolean;
}

/* =======================
   BACKEND MODELS
======================= */

interface ApiConversation {
  id: string;
  lead: {
    companyName: string | null;
    phoneNumber: string;
  };
  messages: {
    content: string;
    direction: "inbound" | "outbound";
    status?: "sent" | "delivered" | "read" | "failed" | "received";
    createdAt: string;
  }[];
  lastMessageAt: string;
  sessionStarted?: boolean;
  sessionActive?: boolean;
  sessionExpiresAt?: string | null;
}

interface ApiMessage {
  id: string;
  whatsappMessageId?: string;
  replyToMessageId?: string;
  content: string;
  direction: "inbound" | "outbound";
  status?: "sent" | "delivered" | "read" | "failed" | "received";
  createdAt: string;
  media?: Array<{
    mediaUrl: string;
    mimeType: string;
    caption?: string;
  }>;
  outboundPayload?: any;
}

interface Template {
  id: string;
  metaTemplateName: string;
  displayName: string;
  category: string;
  status: string;
  languages: {
    language: string;
    body: string;
    headerType: string;
    footerText?: string;
    headerText?: string;
  }[];
}

/* =======================
   CONVERSATION LIST (UI UNCHANGED)
======================= */

const getConversationTick = (
  direction?: "inbound" | "outbound",
  status?: "sent" | "delivered" | "read" | "failed" | "received"
) => {
  // 🔒 HARD RULE: ticks ONLY for outbound
  if (direction !== "outbound") return null;

  switch (status) {
    case "sent":
      return <Check className="w-4 h-4 text-muted-foreground" />;
    case "delivered":
      return <CheckCheck className="w-4 h-4 text-muted-foreground" />;
    case "read":
      return <CheckCheck className="w-4 h-4 text-blue-500" />;
    case "failed":
      return <AlertCircle className="w-4 h-4 text-destructive" />;
    case "received":
      return <CheckCheck className="w-4 h-4 text-muted-foreground" />;
    default:
      return null;
  }
};

function ConversationList({
  conversations,
  selected,
  onSelect,
}: {
  conversations: Conversation[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="w-full md:w-96 bg-card border-r border-border flex flex-col h-full">
      <div className="bg-card p-3 flex items-center justify-between border-b border-border">
        <h2 className="text-xl font-semibold text-foreground">Chats</h2>
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.1, backgroundColor: "rgba(0,0,0,0.05)" }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-full"
          >
            <MoreVertical className="w-5 h-5 text-muted-foreground" />
          </motion.button>
        </div>
      </div>

      <div className="px-3 py-2 bg-card border-b border-border">
        <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-4 py-2">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Search or start new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-sm outline-none w-full text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-background">
        {conversations.map((conv, i) => (
          <motion.button
            key={conv.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => onSelect(conv.id)}
            className={`w-full px-4 py-3 border-b border-border/50 text-left transition-colors hover:bg-muted/50 ${
              selected === conv.id ? "bg-muted" : ""
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-semibold text-lg">
                  {conv.companyName?.charAt(0)?.toUpperCase() || "?"}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p
                    className={`text-base truncate ${
                      conv.hasUnread
                        ? "font-semibold text-foreground"
                        : "font-medium text-foreground"
                    }`}
                  >
                    {conv.companyName}
                  </p>

                  <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                    {conv.lastActivity}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  {/* LEFT: tick + message text */}
                  <div className="flex items-center gap-1 min-w-0">
                    {getConversationTick(
                      conv.lastMessageDirection,
                      conv.lastMessageStatus
                    )}

                    <p
                      className={`text-sm truncate ${
                        conv.hasUnread
                          ? "font-medium text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {conv.lastMessage}
                    </p>
                  </div>

                  {/* RIGHT: unread badge (ONLY if last message is inbound) */}
                  {conv.lastMessageDirection === "inbound" &&
                    conv.unreadCount! > 0 && (
                      <span className="ml-2 min-w-[20px] h-5 px-2 rounded-full bg-primary text-white text-xs flex items-center justify-center">
                        {conv.unreadCount}
                      </span>
                    )}
                </div>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function ChatArea({
  conversation,
  messages,
  setMessages,
  readSentRef,
  onBack,
}: {
  conversation: Conversation;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  readSentRef: React.MutableRefObject<Set<string>>;
  onBack?: () => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [actionMenu, setActionMenu] = useState<{
    message: Message;
    rect: DOMRect;
  } | null>(null);
  const [remainingTime, setRemainingTime] = useState<string | null>(null);

  const [imagePreview, setImagePreview] = useState<{
    files: File[];
    urls: string[];
    caption: string;
  } | null>(null);
  const [sendingPreview, setSendingPreview] = useState(false);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;

    try {
      const processed = await Promise.all(
        Array.from(e.target.files).map((f) => processMedia(f))
      );

      const files = processed.map((p) => p.file);
      const urls = files.map((f) => URL.createObjectURL(f));

      setImagePreview({
        files,
        urls,
        caption: "",
      });

      setMediaModal(null);
      e.target.value = "";
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      alert(message);
    }
  };

  const [copied, setCopied] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  type ImageMode = "single" | "bulk";
  const [imageMode, setImageMode] = useState<ImageMode>("single");

  const [mediaModal, setMediaModal] = useState<{
    type: "image" | "video" | "audio" | "document" | "template";
  } | null>(null);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);
  const [isSendingTemplate, setIsSendingTemplate] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const genericInputRef = useRef<HTMLInputElement | null>(null);
  const isSessionActive = conversation.sessionActive !== false;
  const sessionStarted = conversation.sessionStarted;

  useEffect(() => {
    if (mediaModal?.type === "template") {
      api
        .get("/vendor/templates")
        .then((res) => {
          const approved = res.data.filter((t: any) => t.status === "approved");
          setTemplates(approved);
        })
        .catch((err) => console.error("Failed to load templates", err));
    }
  }, [mediaModal?.type]);

  const handleSendTemplate = async () => {
    if (!selectedTemplate || isSendingTemplate) return;

    setIsSendingTemplate(true);
    try {
      await api.post("/vendor/whatsapp/template/send-template", {
        templateId: selectedTemplate.id,
        recipients: [conversation.phone],
        bodyVariables: templateVariables.map(
          (v) => v.trim() || "Valued Customer"
        ),
      });
      setMediaModal(null);
      setSelectedTemplate(null);
      setTemplateVariables([]);
    } catch (err) {
      console.error("Failed to send template", err);
      toast.error("Failed to send template");
    } finally {
      setIsSendingTemplate(false);
    }
  };

  const copyMessage = async (message: Message): Promise<boolean> => {
    try {
      if (message.text) {
        await navigator.clipboard.writeText(message.text);
        return true;
      }

      if (message.caption) {
        await navigator.clipboard.writeText(message.caption);
        return true;
      }

      if (message.mediaUrl) {
        await navigator.clipboard.writeText(message.mediaUrl);
        return true;
      }

      return false;
    } catch {
      return false;
    }
  };

  const calculateRemainingTime = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();

    if (diff <= 0) return null;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff / (1000 * 60)) % 60);

    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const sendImageFromPreview = async () => {
    if (!imagePreview || sendingPreview) return;

    setSendingPreview(true);

    try {
      for (const file of imagePreview.files) {
        const form = new FormData();
        form.append("conversationId", conversation.id);
        form.append("file", file);

        if (imagePreview.caption) {
          form.append("caption", imagePreview.caption);
        }

        await api.post("/vendor/whatsapp/send-media", form);
      }

      setImagePreview(null);
    } catch (err) {
      console.error("Image send failed", err);
      toast.error("Failed to send image");
    } finally {
      setSendingPreview(false);
    }
  };

  const getMessageStatusIcon = (status?: string) => {
    if (!status) return null;
    if (status === "sent") return <Check className="w-4 h-4" />;
    if (status === "delivered") return <CheckCheck className="w-4 h-4" />;
    if (status === "read")
      return <CheckCheck className="w-4 h-4 text-blue-500" />;
    if (status === "failed")
      return <AlertCircle className="w-4 h-4 text-destructive" />;
    return null;
  };

  useEffect(() => {
    if (!conversation.sessionActive || !conversation.sessionExpiresAt) {
      setRemainingTime(null);
      return;
    }

    const update = () =>
      setRemainingTime(calculateRemainingTime(conversation.sessionExpiresAt!));

    update();
    const id = setInterval(update, 30_000);

    return () => clearInterval(id);
  }, [conversation.sessionActive, conversation.sessionExpiresAt]);

  useEffect(() => {
    if (!conversation?.id) return;
    connectSocket();
    const socket = getSocket();

    const maybeMarkRead = async () => {
      if (document.visibilityState !== "visible") return;
      if (readSentRef.current.has(conversation.id)) return;

      // ✅ ALWAYS notify backend when chat is opened
      readSentRef.current.add(conversation.id);

      try {
        await api.post(`/inbox/${conversation.id}/mark-read`);
      } catch {
        readSentRef.current.delete(conversation.id);
      }
    };

    socket.emit("join-conversation", conversation.id);

    // Run once after render
    requestAnimationFrame(maybeMarkRead);

    // Re-run when tab becomes visible
    document.addEventListener("visibilitychange", maybeMarkRead);

    return () => {
      socket.emit("leave-conversation", conversation.id);
      document.removeEventListener("visibilitychange", maybeMarkRead);
    };
  }, [conversation.id]);

  useEffect(() => {
    if (!conversation?.id) return;
    if (document.visibilityState !== "visible") return;

    if (!readSentRef.current.has(conversation.id)) {
      requestAnimationFrame(async () => {
        try {
          readSentRef.current.add(conversation.id);
          await api.post(`/inbox/${conversation.id}/mark-read`);
        } catch {
          readSentRef.current.delete(conversation.id);
        }
      });
    }
  }, [messages.length, conversation.id]);

  useEffect(() => {
    if (!conversation?.id) return;
    connectSocket();
    const socket = getSocket();

    const handleNewMessage = (msg: Message) => {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === msg.id);
        return exists ? prev : [...prev, msg];
      });

      if (msg.sender === "customer" && document.visibilityState === "visible") {
        // allow read receipt to be sent again
        readSentRef.current.delete(conversation.id);
      }
    };

    const STATUS_PRIORITY = {
      failed: 0,
      sent: 1,
      delivered: 2,
      read: 3,
      received: 2,
    };

    const handleStatusUpdate = ({
      whatsappMessageId,
      status,
    }: {
      whatsappMessageId: string;
      status?: Message["status"];
    }) => {
      if (!status) return; // ✅ HARD GUARD

      setMessages((prev) =>
        prev.map((m) => {
          if (m.whatsappMessageId !== whatsappMessageId) return m;
          if (!m.status) return { ...m, status };

          if (STATUS_PRIORITY[m.status] >= STATUS_PRIORITY[status]) {
            return m; // ⛔ ignore downgrade
          }

          return { ...m, status };
        })
      );
    };

    socket.on("message:new", handleNewMessage);
    socket.on("message:status", handleStatusUpdate);

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("message:status", handleStatusUpdate);
    };
  }, [conversation.id, setMessages]);

  /* ===============================
     SEND MESSAGE → BACKEND
     (NO UI CHANGE)
  =============================== */

  // 👇 AUTO SCROLL TO BOTTOM (WhatsApp behavior)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  useEffect(() => {
    if (replyTo) {
      // small timeout ensures DOM is ready (important with animations)
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [replyTo]);

  const sendMessage = async () => {
    if (!inputValue.trim() || sending) return;

    const text = inputValue.trim();
    setInputValue("");
    setSending(true);

    try {
      await api.post("/vendor/whatsapp/send-message", {
        conversationId: conversation.id,
        text,
        replyToMessageId: replyTo?.whatsappMessageId,
      });

      setReplyTo(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch (err) {
      console.error("Failed to send message", err);
      // optional: toast / snackbar
    } finally {
      setSending(false);
    }
  };

  const getDateLabel = (iso: string) => {
    const msgDate = new Date(iso);
    const today = new Date();
    const yesterday = new Date();

    yesterday.setDate(today.getDate() - 1);

    if (msgDate.toDateString() === today.toDateString()) {
      return "Today";
    }

    if (msgDate.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }

    return msgDate.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const isNewDay = (a: string, b: string) =>
    new Date(a).toDateString() !== new Date(b).toDateString();

  const getReplyPreview = (m?: Message | Message["replyTo"]) => {
    if (!m) return null;

    // TEXT
    if (m.text) {
      return {
        type: "text",
        title: m.sender === "executive" ? "You" : conversation.companyName,
        subtitle: m.text,
      };
    }

    // IMAGE
    if (m.mimeType?.startsWith("image/")) {
      return {
        type: "image",
        title: m.sender === "executive" ? "You" : conversation.companyName,
        subtitle: "Photo",
        thumb: m.mediaUrl,
      };
    }

    // VIDEO
    if (m.mimeType?.startsWith("video/")) {
      return {
        type: "video",
        title: m.sender === "executive" ? "You" : conversation.companyName,
        subtitle: "Video",
        thumb: m.mediaUrl,
      };
    }

    // AUDIO
    if (m.mimeType?.startsWith("audio/")) {
      return {
        type: "audio",
        title: m.sender === "executive" ? "You" : conversation.companyName,
        subtitle: "Voice message",
      };
    }

    // DOCUMENT
    return {
      type: "document",
      title: m.sender === "executive" ? "You" : conversation.companyName,
      subtitle: "Document",
    };
  };

  return (
    <div className="flex-1 flex flex-col bg-muted/20 relative h-full overflow-hidden">
      {/* Header */}
      <div className="relative z-10 bg-card px-4 py-2.5 flex items-center justify-between border-b border-border flex-shrink-0">
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
      {/* SESSION BANNER — ALWAYS VISIBLE */}
      {sessionStarted && (
        <div className="flex-shrink-0 z-30">
          {isSessionActive ? (
            <div className="bg-yellow-50 border-b px-4 py-2.5 flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-600" />
              <span className="text-xs text-yellow-700">
                24-hour message window expires in {remainingTime}
              </span>
            </div>
          ) : (
            <div className="bg-red-50 border-b px-4 py-2.5 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-xs text-red-700">
                24-hour window closed. Send a template message.
              </span>
            </div>
          )}
        </div>
      )}
      {/* MESSAGES WRAPPER */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* FIXED WHATSAPP BACKGROUND */}
        <div
          className="
      absolute inset-0
      bg-[#ECE5DD] dark:bg-[#0B141A]
      bg-[url('/chat-bg.png')]
      bg-repeat
      bg-center
      opacity-100 dark:opacity-[0.5]
      pointer-events-none
    "
        />

        {/* SCROLLABLE MESSAGES */}
        <div className="relative z-10 h-full overflow-y-auto">
          <div className="p-4 space-y-2">
            {/* messages go here */}
            <AnimatePresence>
              {messages.map((msg, i) => {
                const showDateSeparator =
                  i === 0 || isNewDay(messages[i - 1].timestamp, msg.timestamp);

                const repliedMessage =
                  msg.replyTo ??
                  messages.find(
                    (m) => m.whatsappMessageId === msg.replyToMessageId
                  );
                return (
                  <div key={msg.id}>
                    {/* 📅 DATE SEPARATOR (WhatsApp style) */}
                    {showDateSeparator && (
                      <div className="flex justify-center my-4">
                        <span className="px-3 py-1 text-xs rounded-full bg-muted text-muted-foreground shadow-sm">
                          {getDateLabel(msg.timestamp)}
                        </span>
                      </div>
                    )}

                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className={`flex items-end gap-2 ${
                        msg.sender === "executive"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`group relative max-w-[85%] md:max-w-md shadow-sm overflow-hidden flex flex-col
                                    ${
                                      msg.sender === "executive"
                                        ? "bg-[#DCF8C6] dark:bg-[#005C4B] text-black dark:text-[#E9EDEF] rounded-lg rounded-br-none self-end"
                                        : "bg-white dark:bg-[#202C33] text-foreground rounded-lg rounded-bl-none self-start"
                                    }
                                  `}
                      >
                        {/* 🖼 MEDIA (IMAGE/VIDEO) */}
                        {msg.mediaUrl &&
                          (msg.mimeType?.startsWith("image/") ||
                            msg.mimeType?.startsWith("video/")) && (
                            <div className="w-full overflow-hidden">
                              {msg.mimeType.startsWith("image/") ? (
                                <div
                                  className="relative w-full aspect-[4/3] cursor-pointer"
                                  onClick={() =>
                                    window.open(msg.mediaUrl, "_blank")
                                  }
                                >
                                  <Image
                                    src={msg.mediaUrl}
                                    alt="Message media"
                                    fill
                                    sizes="(max-width: 768px) 85vw, 450px"
                                    className="object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-full bg-black aspect-video flex items-center">
                                  <video
                                    src={msg.mediaUrl}
                                    controls
                                    className="w-full h-auto"
                                  />
                                </div>
                              )}
                            </div>
                          )}

                        {/* 📄 DOCUMENT */}
                        {msg.mediaUrl &&
                          msg.mimeType &&
                          !msg.mimeType.startsWith("image/") &&
                          !msg.mimeType.startsWith("video/") &&
                          !msg.mimeType.startsWith("audio/") && (
                            <div className="p-2">
                              <a
                                href={msg.mediaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                              >
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                  DOC
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {msg.mediaUrl.split("/").pop()}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground uppercase uppercase">
                                    Document
                                  </p>
                                </div>
                              </a>
                            </div>
                          )}

                        {/* 📝 CONTENT AREA */}
                        <div className="px-3 py-2 flex flex-col">
                          {/* REPLIED MESSAGE PREVIEW (Internal) */}
                          {(() => {
                            const reply = getReplyPreview(
                              msg.replyTo ?? repliedMessage
                            );
                            if (!reply) return null;
                            return (
                              <div className="mb-2 flex gap-2 px-2 py-1.5 border-l-4 border-[#25D366] bg-black/5 dark:bg-white/5 rounded text-[11px]">
                                {reply.thumb && (
                                  <div className="relative w-8 h-8 flex-shrink-0">
                                    <Image
                                      src={reply.thumb}
                                      alt=""
                                      fill
                                      sizes="32px"
                                      className="rounded object-cover"
                                    />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="font-semibold text-[#25D366] truncate">
                                    {reply.title}
                                  </div>
                                  <div className="text-muted-foreground truncate">
                                    {reply.subtitle}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* AUDIO */}
                          {msg.mediaUrl &&
                            msg.mimeType?.startsWith("audio/") && (
                              <div className="mb-2">
                                <audio
                                  src={msg.mediaUrl}
                                  controls
                                  className="w-full h-8"
                                />
                              </div>
                            )}

                          {/* BODY TEXT */}
                          {msg.text && (
                            <p className="text-[14.2px] leading-[1.35] break-words whitespace-pre-wrap text-[#111b21] dark:text-[#e9edef]">
                              {msg.text}
                            </p>
                          )}

                          {/* FOOTER & TIMESTAMP ROW */}
                          <div className="flex items-end justify-between gap-4 mt-1.5">
                            {msg.template?.footer ? (
                              <p className="text-[12px] text-[#667781] dark:text-[#8696a0] leading-none pb-0.5">
                                {msg.template.footer}
                              </p>
                            ) : (
                              <div />
                            )}

                            <div className="flex items-center gap-1 self-end pb-0.5">
                              <span className="text-[11px] text-[#667781] dark:text-[#8696a0]">
                                {new Date(msg.timestamp)
                                  .toLocaleTimeString([], {
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true,
                                  })
                                  .toLowerCase()}
                              </span>
                              {msg.sender === "executive" && (
                                <span
                                  className={
                                    msg.status === "read"
                                      ? "text-[#53bdeb]"
                                      : "text-[#8696a0]"
                                  }
                                >
                                  {getMessageStatusIcon(msg.status)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* BUTTONS - Authentic WhatsApp Style */}
                        {msg.template?.buttons &&
                          msg.template.buttons.length > 0 && (
                            <div className="border-t border-[#0000000d] dark:border-[#ffffff12] divide-y divide-[#0000000d] dark:divide-[#ffffff12]">
                              {msg.template.buttons.map((btn, i) => (
                                <div
                                  key={i}
                                  className="py-2.5 text-center text-[14px] font-medium text-[#00a884] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors active:bg-black/10"
                                  onClick={() => {
                                    if (
                                      btn.type === "URL" &&
                                      (btn as any).value
                                    ) {
                                      window.open((btn as any).value, "_blank");
                                    } else {
                                      setReplyTo(msg);
                                      setInputValue(btn.text);
                                      setTimeout(
                                        () => inputRef.current?.focus(),
                                        50
                                      );
                                    }
                                  }}
                                >
                                  {btn.text}
                                </div>
                              ))}
                            </div>
                          )}

                        {/* REACTION / MENU BUTTON (Floating) */}
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              setActionMenu({ message: msg, rect });
                            }}
                            className="p-1 rounded-full bg-white/80 dark:bg-black/50 shadow-sm hover:bg-white dark:hover:bg-black transition-colors"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </AnimatePresence>

            {/* 👇 Auto-scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 flex-shrink-0 bg-card border-t border-border">
        {replyTo && (
          <div className="px-4 py-2 bg-muted/50 border-l-4 border-primary flex justify-between items-center">
            <div className="text-xs">
              <div className="font-medium">
                {replyTo.sender === "executive"
                  ? "You"
                  : conversation.companyName}
              </div>
              <div className="truncate max-w-xs">{replyTo.text}</div>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
        )}

        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <motion.button className="p-2 rounded-full hover:bg-muted">
                <Smile className="w-5 h-5 text-muted-foreground" />
              </motion.button>
              <motion.button
                onClick={() => setShowAttachMenu((v) => !v)}
                className="p-2 rounded-full hover:bg-muted"
              >
                <Paperclip className="w-5 h-5 text-muted-foreground" />
              </motion.button>
            </div>

            <div className="flex-1 bg-muted/50 rounded-lg px-4 py-2.5">
              <input
                ref={inputRef}
                type="text"
                disabled={!isSessionActive}
                placeholder={
                  !isSessionActive
                    ? "Template message required"
                    : "Type a message"
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
                    sendMessage();
                  }
                }}
                className="bg-transparent text-sm outline-none w-full"
              />
            </div>

            {!isSessionActive ? (
              <motion.button
                className="bg-primary text-white px-4 py-2 rounded-lg"
                onClick={() => {
                  alert("Open template picker");
                }}
              >
                Send Template
              </motion.button>
            ) : inputValue.trim() ? (
              <motion.button
                onClick={sendMessage}
                className="bg-primary text-white p-2.5 rounded-full"
              >
                <Send className="w-5 h-5" />
              </motion.button>
            ) : (
              <motion.button className="p-2 rounded-full hover:bg-muted">
                <Mic className="w-5 h-5 text-muted-foreground" />
              </motion.button>
            )}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {showAttachMenu && (
          <>
            {/* Click outside */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowAttachMenu(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="
              absolute bottom-20 left-4 z-50
              w-48
              rounded-xl
              shadow-2xl
              py-2
            bg-[#1f1f1f]
            "
            >
              <AttachItem
                icon={<span className="text-md">📝</span>}
                label="Template"
                color="#8b5cf6"
                onClick={() => {
                  setShowAttachMenu(false);
                  setMediaModal({ type: "template" });
                }}
              />

              <AttachItem
                icon={<span className="text-md">🖼️</span>}
                label="Photos"
                color="#22c55e"
                onClick={() => {
                  setShowAttachMenu(false);
                  setMediaModal({ type: "image" });
                }}
              />

              <AttachItem
                icon={<span className="text-md">📷</span>}
                label="Videos"
                color="#ef4444"
                onClick={() => {
                  setShowAttachMenu(false);
                  setMediaModal({ type: "video" });
                }}
              />

              <AttachItem
                icon={<span className="text-md">🎧</span>}
                label="Audio"
                color="#f97316"
                onClick={() => {
                  setShowAttachMenu(false);
                  setMediaModal({ type: "audio" });
                }}
              />

              <AttachItem
                icon={<span className="text-md">📄</span>}
                label="Document"
                color="#3b82f6"
                onClick={() => {
                  setShowAttachMenu(false);
                  setMediaModal({ type: "document" });
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {actionMenu && (
          <>
            {/* Click outside */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setActionMenu(null)}
            />

            {(() => {
              const { rect } = actionMenu;

              const menuHeight = 160;
              const menuWidth = 192;

              const isNearBottom =
                rect.bottom + menuHeight > window.innerHeight;

              const top = isNearBottom
                ? rect.top - menuHeight - 8
                : rect.bottom + 8;

              const isIncoming = actionMenu.message.sender === "customer";

              const left = isIncoming
                ? // LEFT-SIDE MESSAGE → open menu on RIGHT
                  Math.min(window.innerWidth - menuWidth - 12, rect.left)
                : // RIGHT-SIDE MESSAGE → open menu on LEFT
                  Math.max(12, rect.right - menuWidth);

              return (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="fixed z-50 w-48 bg-card rounded-xl shadow-lg overflow-hidden"
                  style={{ top, left }}
                >
                  <ActionButton
                    label="Reply"
                    onClick={() => {
                      setReplyTo(actionMenu.message);
                      setActionMenu(null);
                      requestAnimationFrame(() => inputRef.current?.focus());
                    }}
                  />
                  <ActionButton
                    label="Copy"
                    onClick={async () => {
                      const success = await copyMessage(actionMenu.message);

                      setActionMenu(null);

                      if (success) {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1200);
                      }
                    }}
                  />
                  <ActionButton label="Delete" destructive />
                </motion.div>
              );
            })()}
          </>
        )}
      </AnimatePresence>
      {copied && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-30
               bg-black/85 text-white text-sm px-4 py-2
               rounded-full shadow-md"
        >
          Copied
        </motion.div>
      )}
      <AnimatePresence>
        {mediaModal && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-50 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMediaModal(null)}
            />

            {/* Center Modal */}
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="
          fixed z-50
          top-1/2 left-1/2
          -translate-x-1/2 -translate-y-1/2
          w-105 max-w-[90vw]
          bg-card
          rounded-xl
          shadow-2xl
          p-6
        "
            >
              <h3 className="text-lg font-semibold mb-2">
                {mediaModal.type === "template"
                  ? "Send Template"
                  : "Send Media"}
              </h3>

              {/* IMAGE */}
              {mediaModal.type === "image" && (
                <div className="mt-4 space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold">Send Photos</h3>
                    <p className="text-sm text-muted-foreground">
                      Choose how you want to send images
                    </p>
                  </div>

                  {/* SEND MODE */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Send mode
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setImageMode("single")}
                        className={`flex-1 py-2.5 rounded-lg ${
                          imageMode === "single"
                            ? "bg-primary text-white"
                            : "bg-muted"
                        }`}
                      >
                        Single
                      </button>
                      <button
                        onClick={() => setImageMode("bulk")}
                        className={`flex-1 py-2.5 rounded-lg ${
                          imageMode === "bulk"
                            ? "bg-primary text-white"
                            : "bg-muted"
                        }`}
                      >
                        Bulk
                      </button>
                    </div>
                  </div>

                  {/* DEVICE */}
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="rounded-xl border p-5 hover:bg-muted text-left"
                  >
                    <div className="text-3xl mb-2">📁</div>
                    <p className="font-medium text-sm">Device</p>
                  </button>

                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple={imageMode === "bulk"}
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                </div>
              )}

              {/* VIDEO */}
              {mediaModal.type === "video" && (
                <p className="text-sm text-muted-foreground mt-4">
                  Select videos
                </p>
              )}

              {/* AUDIO */}
              {mediaModal.type === "audio" && (
                <p className="text-sm text-muted-foreground mt-4">
                  Select audio files
                </p>
              )}

              {/* DOCUMENT */}
              {mediaModal.type === "document" && (
                <p className="text-sm text-muted-foreground mt-4">
                  Select documents
                </p>
              )}

              {/* TEMPLATE */}
              {mediaModal.type === "template" && (
                <div className="mt-4 flex flex-col h-[400px]">
                  {!selectedTemplate ? (
                    <>
                      <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search templates..."
                          value={templateSearch}
                          onChange={(e) => setTemplateSearch(e.target.value)}
                          className="w-full bg-muted/50 pl-10 pr-4 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {templates
                          .filter((t) =>
                            t.displayName
                              .toLowerCase()
                              .includes(templateSearch.toLowerCase())
                          )
                          .map((t) => (
                            <button
                              key={t.id}
                              onClick={() => {
                                setSelectedTemplate(t);
                                const body = t.languages[0]?.body || "";
                                const match = body.match(/{{\d+}}/g);
                                const count = match ? new Set(match).size : 0;
                                setTemplateVariables(new Array(count).fill(""));
                              }}
                              className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                            >
                              <p className="font-medium text-sm">
                                {t.displayName}
                              </p>
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                                {t.languages[0]?.body}
                              </p>
                            </button>
                          ))}
                        {templates.length === 0 && (
                          <div className="text-center py-8">
                            <p className="text-sm text-muted-foreground">
                              No approved templates found.
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col h-full">
                      <div className="flex items-center gap-2 mb-4">
                        <button
                          onClick={() => setSelectedTemplate(null)}
                          className="p-1 hover:bg-muted rounded-full"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <p className="font-medium">
                          {selectedTemplate.displayName}
                        </p>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                        <div className="p-3 bg-muted rounded-lg border border-border">
                          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                            Preview
                          </p>
                          <p className="text-sm whitespace-pre-wrap">
                            {selectedTemplate.languages[0]?.body}
                          </p>
                        </div>

                        {templateVariables.length > 0 && (
                          <div className="space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">
                              Variables
                            </p>
                            {templateVariables.map((val, idx) => (
                              <div key={idx} className="space-y-1">
                                <label className="text-[10px] text-muted-foreground font-medium">
                                  Variable {"{{" + (idx + 1) + "}}"}
                                </label>
                                <input
                                  type="text"
                                  value={val}
                                  onChange={(e) => {
                                    const next = [...templateVariables];
                                    next[idx] = e.target.value;
                                    setTemplateVariables(next);
                                  }}
                                  placeholder={`Enter value for {{${idx + 1}}}`}
                                  className="w-full bg-muted/50 px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-4 border-t border-border flex gap-3">
                        <button
                          onClick={() => setSelectedTemplate(null)}
                          className="flex-1 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted"
                        >
                          Back
                        </button>
                        <button
                          onClick={handleSendTemplate}
                          disabled={isSendingTemplate}
                          className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                        >
                          {isSendingTemplate ? "Sending..." : "Send Template"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Hidden file input */}
              {mediaModal.type !== "template" && (
                <>
                  <input
                    ref={genericInputRef}
                    type="file"
                    multiple
                    accept={
                      mediaModal.type === "video"
                        ? "video/*"
                        : mediaModal.type === "audio"
                        ? "audio/*"
                        : "*"
                    }
                    className="hidden"
                    onChange={async (e) => {
                      if (!e.target.files?.length) return;

                      try {
                        for (const rawFile of Array.from(e.target.files)) {
                          const { file } = await processMedia(rawFile);

                          const form = new FormData();
                          form.append("conversationId", conversation.id);
                          form.append("file", file);

                          await api.post("/vendor/whatsapp/send-media", form);
                        }

                        setMediaModal(null);
                      } catch (err) {
                        const message =
                          err instanceof Error
                            ? err.message
                            : "An error occurred";
                        toast.error(message);
                      }
                    }}
                  />

                  <button
                    onClick={() => genericInputRef.current?.click()}
                    className="w-full bg-primary text-white py-2 rounded-lg"
                  >
                    Choose Files
                  </button>
                </>
              )}

              {/* Template picker is now integrated above */}
              {mediaModal.type === "template" && null}
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {imagePreview && (
          <>
            {/* BACKDROP – stays inside ChatArea */}
            <motion.div
              className="absolute inset-0 z-40 bg-black/90"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* PREVIEW CONTAINER – limited to ChatArea */}
            <motion.div
              className="absolute inset-0 z-50 flex flex-col bg-black text-white"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
            >
              {/* HEADER */}
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  disabled={sendingPreview}
                  onClick={() => setImagePreview(null)}
                  className={
                    sendingPreview ? "opacity-40 cursor-not-allowed" : ""
                  }
                >
                  ✕
                </button>
                <span className="text-sm">
                  {imagePreview.files.length} photo
                  {imagePreview.files.length > 1 ? "s" : ""}
                </span>
              </div>

              {/* MAIN IMAGE */}
              {/* IMAGE AREA */}
              <div className="flex-1 overflow-y-auto flex items-center justify-center px-4">
                <img
                  src={imagePreview.urls[0]}
                  className="
      max-w-full
      max-h-[65vh]
      object-contain
      rounded-lg
    "
                />
              </div>

              {/* THUMBNAILS */}
              {imagePreview.urls.length > 1 && (
                <div className="flex gap-2 px-4 py-2 overflow-x-auto">
                  {imagePreview.urls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      className="w-16 h-16 rounded object-cover"
                    />
                  ))}
                </div>
              )}

              {/* CAPTION + SEND */}
              <div className="flex items-center gap-3 p-4 border-t border-white/10">
                <input
                  placeholder="Add a caption…"
                  value={imagePreview.caption}
                  onChange={(e) =>
                    setImagePreview((p) =>
                      p ? { ...p, caption: e.target.value } : p
                    )
                  }
                  className="
      flex-1
      bg-white/10
      px-4
      py-2
      rounded-full
      outline-none
      text-sm
    "
                />

                <button
                  disabled={sendingPreview}
                  onClick={sendImageFromPreview}
                  className="
      bg-primary
      w-12 h-12
      rounded-full
      flex items-center justify-center
    "
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>

              {sendingPreview && (
                <div className="absolute inset-0 z-50 bg-black/60 flex flex-col items-center justify-center gap-4">
                  <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="text-sm text-white/90 tracking-wide">
                    Sending…
                  </span>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  destructive,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-colors
        ${destructive ? "text-destructive" : "text-foreground"}
        ${disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-muted"}
      `}
    >
      {label}
    </button>
  );
}
function AttachItem({
  icon,
  label,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="
        w-full flex items-center gap-4
        px-4 py-2
        text-sm
        text-white
        hover:bg-white/10
        transition-colors
      "
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-white"
        style={{ backgroundColor: color }}
      >
        {icon}
      </div>

      <span className="font-normal">{label}</span>
    </button>
  );
}

const mapApiConversation = (c: ApiConversation): Conversation => {
  const lastMsg = c.messages?.[c.messages.length - 1];

  const unreadCount =
    c.messages?.filter((m) => m.direction === "inbound" && m.status !== "read")
      .length ?? 0;

  return {
    id: c.id,
    companyName: c.lead.companyName || c.lead.phoneNumber,
    phone: c.lead.phoneNumber,
    lastMessage: (() => {
      if (!lastMsg) return "";

      if (lastMsg.content?.startsWith("[image")) return "📷 Photo";
      if (lastMsg.content?.startsWith("[video")) return "🎥 Video";
      if (lastMsg.content?.startsWith("[audio")) return "🎵 Audio";
      if (lastMsg.content?.startsWith("[document")) return "📄 Document";

      return lastMsg.content;
    })(),
    lastActivity: new Date(c.lastMessageAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    lastMessageDirection: lastMsg?.direction,
    lastMessageStatus: lastMsg?.status,
    unreadCount,
    hasUnread: unreadCount > 0,
    sessionStarted: c.sessionStarted ?? true,
    sessionActive: c.sessionActive ?? true,
    sessionExpiresAt: c.sessionExpiresAt ?? null,
    templateRequired: c.sessionActive === false,
  };
};

export default function InboxPage() {
  const [selectedConversation, setSelectedConversation] = useState<string>("");
  const [showChat, setShowChat] = useState(false);
  const readSentRef = useRef<Set<string>>(new Set());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const loadInbox = async () => {
      try {
        const res = await api.get<ApiConversation[]>("/inbox");
        setConversations(res.data.map(mapApiConversation));
      } catch (err) {
        console.error("❌ Failed to load inbox", err);
      }
    };

    loadInbox();
  }, []);

  // 🔥 2️⃣ THEN LISTEN FOR INBOX UPDATES
  useEffect(() => {
    connectSocket();
    const socket = getSocket();

    const handleInboxUpdate = async () => {
      try {
        const res = await api.get<ApiConversation[]>("/inbox");

        const mapped = res.data.map(mapApiConversation);

        setConversations(mapped);
      } catch (err) {
        console.error("Inbox refresh failed", err);
      }
    };

    socket.on("inbox:update", handleInboxUpdate);

    return () => {
      socket.off("inbox:update", handleInboxUpdate);
    };
  }, []);

  useEffect(() => {
    connectSocket(); // 🔥 AUTHENTICATED CONNECT

    const socket = getSocket();

    socket.on("connect", async () => {
      const res = await api.get<ApiConversation[]>("/inbox");
      setConversations(res.data.map(mapApiConversation));
      console.log("✅ SOCKET CONNECTED:", socket.id);
    });

    socket.on("connect_error", (err) => {
      console.error("❌ SOCKET CONNECT ERROR:", err.message);
    });

    socket.on("disconnect", (reason) => {
      console.warn("⚠️ SOCKET DISCONNECTED:", reason);
    });

    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("disconnect");
    };
  }, []);

  /* =======================
     SELECT CONVERSATION
  ======================= */
  const handleSelectConversation = async (id: string) => {
    readSentRef.current.delete(id);

    setMessages([]);
    setSelectedConversation(id);
    setShowChat(true);

    try {
      const res = await api.get(`/inbox/${id}`);

      const mappedMessages: Message[] = res.data.messages.map(
        (m: ApiMessage) => {
          const media = m.media?.[0]; // WhatsApp = 1 media per message

          return {
            id: m.id,
            whatsappMessageId: m.whatsappMessageId,
            replyToMessageId: m.replyToMessageId,

            // TEXT & MEDIA
            text: m.content,
            mediaUrl: media?.mediaUrl,
            mimeType: media?.mimeType,
            caption: media?.caption,

            sender: m.direction === "outbound" ? "executive" : "customer",
            timestamp: m.createdAt,
            status: m.status ?? "delivered",

            // TEMPLATE DATA (Look in outboundPayload.template first, then fallback)
            template:
              m.outboundPayload?.template ||
              (m.outboundPayload?.name
                ? {
                    footer: m.outboundPayload.footer,
                    buttons: m.outboundPayload.buttons,
                  }
                : undefined),
          };
        }
      );

      setMessages((prev) => {
        const map = new Map(prev.map((m) => [m.id, m]));
        mappedMessages.forEach((m) => map.set(m.id, m));
        return Array.from(map.values()).sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      });

      setConversations((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                sessionStarted: res.data.sessionStarted,
                sessionActive: res.data.sessionActive,
                sessionExpiresAt: res.data.sessionExpiresAt,
              }
            : c
        )
      );
    } catch (err) {
      console.error("Failed to load conversation", err);
      setMessages([]);
    }
  };

  const currentConversation = conversations.find(
    (c) => c.id === selectedConversation
  );

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      <div
        className={`${
          showChat ? "hidden md:block" : "block"
        } w-full md:w-auto h-full`}
      >
        <ConversationList
          conversations={conversations}
          selected={selectedConversation}
          onSelect={handleSelectConversation}
        />
      </div>
      <div
        className={`${showChat ? "block" : "hidden md:block"} flex-1 h-full`}
      >
        {currentConversation ? (
          <ChatArea
            conversation={currentConversation}
            messages={messages}
            setMessages={setMessages}
            readSentRef={readSentRef}
            onBack={() => setShowChat(false)}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-muted/20">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquareIcon />
              </div>
              <h3 className="text-lg font-medium text-foreground">
                Select a conversation
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Choose a chat from the left to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
