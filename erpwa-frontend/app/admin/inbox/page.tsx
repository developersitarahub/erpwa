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
  ClockFading,
  AlertCircle,
  MessageSquareIcon,
  Globe,
  Loader2,
  Filter,
  Zap,
  X,
  Image as ImageIcon,
} from "lucide-react";
import Image from "next/image";
import { toast } from "react-toastify";
import { galleryAPI } from "@/lib/galleryApi";
import { categoriesAPI } from "@/lib/categoriesApi";
import { leadsAPI } from "@/lib/leadsApi";
import type {
  Category,
  GalleryImage,
  Message,
  Template,
  Conversation,
  Lead,
} from "@/lib/types";
import ChatMessages from "@/components/inbox/chatMessages";
import ConversationList from "@/components/inbox/conversationList";
import ChatHeader from "@/components/inbox/chatHeader";
import SessionBanner from "@/components/inbox/sessionBanner";
import ChatFooter from "@/components/inbox/chatFooter";
import ActionMenu from "@/components/inbox/actionMenu";
import AttachMenu from "@/components/inbox/attachMenu";
import MediaModal from "@/components/inbox/media/modal";
import ImagePreview from "@/components/inbox/imagePreview";
import { useChatSocket } from "@/hooks/useChatSocket";
import { useReadReceipts } from "@/hooks/useReadReceipts";
import { useInboxSocket } from "@/hooks/useInboxSocket";

/* =======================
   BACKEND MODELS
======================= */

interface ApiConversation {
  id: string;
  lead: {
    id: number;
    companyName: string | null;
    phoneNumber: string;
    status?: "new" | "contacted" | "qualified" | "converted" | "lost";
  };
  messages: {
    content: string;
    direction: "inbound" | "outbound";
    status?: "sent" | "delivered" | "read" | "failed" | "received";
    createdAt: string;
  }[];
  lastMessageAt: string;
  unreadCount?: number; // ✅ Backend should provide this
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
  outboundPayload?: Record<string, unknown>;
}
/* =======================
   CONVERSATION LIST (UI UNCHANGED)
======================= */

const getConversationTick = (
  direction?: "inbound" | "outbound",
  status?: "sent" | "delivered" | "read" | "failed" | "received",
) => {
  // 🔒 HARD RULE: ticks ONLY for outbound
  if (direction !== "outbound") return null;

  const iconClass = "w-4 h-4 flex-shrink-0";

  switch (status) {
    case "sent":
      return <Check className={`${iconClass} text-muted-foreground`} />;
    case "delivered":
      return <CheckCheck className={`${iconClass} text-muted-foreground`} />;
    case "read":
      return <CheckCheck className={`${iconClass} text-blue-500`} />;
    case "failed":
      return <AlertCircle className={`${iconClass} text-destructive`} />;
    case "received":
      return <CheckCheck className={`${iconClass} text-muted-foreground`} />;
    default:
      return null;
  }
};

function ChatArea({
  conversation,
  messages,
  setMessages,
  readSentRef,
  onBack,
  onUpdateConversationStatus,
  onMarkAsRead,
  onUpdateLeadStatus,
}: {
  conversation: Conversation;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  readSentRef: React.MutableRefObject<Set<string>>;
  onBack?: () => void;
  onUpdateConversationStatus?: (
    conversationId: string,
    status: Message["status"],
  ) => void;
  onMarkAsRead?: (conversationId: string) => void;
  onUpdateLeadStatus?: (leadId: number, status: string) => Promise<void>;
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
        Array.from(e.target.files).map((f) => processMedia(f)),
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
    type: "image" | "video" | "audio" | "document" | "template" | "gallery";
  } | null>(null);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);
  const [isSendingTemplate, setIsSendingTemplate] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  // Gallery State
  const [galleryCategories, setGalleryCategories] = useState<Category[]>([]);
  const [gallerySubcategories, setGallerySubcategories] = useState<Category[]>(
    [],
  );
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [selectedGalleryCategory, setSelectedGalleryCategory] = useState<
    number | null
  >(null);
  const [selectedGallerySubcategory, setSelectedGallerySubcategory] = useState<
    number | null
  >(null);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [selectedGalleryImages, setSelectedGalleryImages] = useState<
    GalleryImage[]
  >([]);
  const [includeCaption, setIncludeCaption] = useState(false);
  const [isPreparingMedia, setIsPreparingMedia] = useState(false);

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const genericInputRef = useRef<HTMLInputElement | null>(null);
  const isSessionActive = conversation.sessionActive !== false;
  const sessionStarted = conversation.sessionStarted;

  useChatSocket({
    conversationId: conversation.id,
    setMessages,
    onUpdateConversationStatus,
    onCustomerMessage: () => {
      // allow read receipt to be sent again
      if (document.visibilityState === "visible") {
        readSentRef.current.delete(conversation.id);
      }
    },
  });

  useReadReceipts({
    conversationId: conversation.id,
    readSentRef,
    onMarkAsRead,
    messagesLength: messages.length,
  });

  useEffect(() => {
    if (mediaModal?.type === "template") {
      api
        .get("/vendor/templates")
        .then((res) => {
          const approved = res.data.filter(
            (t: Template) => t.status === "approved",
          );
          setTemplates(approved);
        })
        .catch((err) => console.error("Failed to load templates", err));
    }
    // Load categories when opening gallery modal
    if (mediaModal?.type === "gallery") {
      categoriesAPI
        .list()
        .then((res) => {
          setGalleryCategories(res.data || []);
        })
        .catch((err) => console.error("Failed to load categories", err));
      loadGalleryImages();
    }
  }, [mediaModal?.type]);

  const handleGalleryCategoryClick = async (catId: number | null) => {
    setSelectedGalleryCategory(catId);
    setSelectedGallerySubcategory(null);
    // Remove setGallerySubcategories([]) to prevent layout jump/closing

    if (catId) {
      // Run parallel to avoid waiting for subcategories before showing images
      loadGalleryImages(catId);

      try {
        const res = await categoriesAPI.detail(catId);
        setGallerySubcategories(res.data.subcategories || []);
      } catch (err) {
        console.error(err);
      }
    } else {
      loadGalleryImages();
    }
  };

  const loadGalleryImages = async (
    categoryId?: number,
    subCategoryId?: number,
  ) => {
    setGalleryLoading(true);
    try {
      const res = await galleryAPI.list(
        categoryId,
        subCategoryId,
        1,
        50,
        "createdAt",
        "desc",
      );
      setGalleryImages(res.data?.images || []);
    } catch (err) {
      console.error("Failed to load gallery images", err);
    } finally {
      setGalleryLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (galleryImages.length === 0) return;

    // Check if all visible images are selected
    const allVisibleSelected = galleryImages.every((img) =>
      selectedGalleryImages.some((s) => s.id === img.id),
    );

    if (allVisibleSelected) {
      // Deselect all visible
      const visibleIds = new Set(galleryImages.map((i) => i.id));
      setSelectedGalleryImages((prev) =>
        prev.filter((i) => !visibleIds.has(i.id)),
      );
    } else {
      // Select all visible (merging with existing selection)
      const newSelection = [...selectedGalleryImages];
      galleryImages.forEach((img) => {
        if (!newSelection.some((s) => s.id === img.id)) {
          newSelection.push(img);
        }
      });
      setSelectedGalleryImages(newSelection);
    }
  };

  const handleSendGalleryImages = async () => {
    if (!selectedGalleryImages.length) return;

    setIsPreparingMedia(true);

    try {
      const processedFiles: File[] = [];

      for (const img of selectedGalleryImages) {
        const url = img.s3_url || img.url || img.image_url || "";
        if (!url) continue;

        // Fetch blob via proxy
        const blobResp = await fetch(
          `/api/proxy?url=${encodeURIComponent(url)}`,
        );
        const blob = await blobResp.blob();

        // Use title/desc as filename if possible, else generic
        const filename =
          (img.title || `gallery_${img.id}`)
            .replace(/[^a-z0-9]/gi, "_")
            .toLowerCase() + ".jpg";
        const file = new File([blob], filename, { type: blob.type });
        processedFiles.push(file);
      }

      if (processedFiles.length > 0) {
        const urls = processedFiles.map((f) => URL.createObjectURL(f));

        let initialCaption = "";
        if (includeCaption && selectedGalleryImages.length > 0) {
          initialCaption =
            selectedGalleryImages[0].description ||
            selectedGalleryImages[0].title ||
            "";
        }

        setImagePreview({
          files: processedFiles,
          urls,
          caption: initialCaption,
        });

        setMediaModal(null);
        setSelectedGalleryImages([]);
      }
    } catch (err) {
      console.error("Failed to prepare gallery images", err);
      toast.error("Failed to load images for preview");
    } finally {
      setIsPreparingMedia(false);
    }
  };

  const handleSendTemplate = async () => {
    if (!selectedTemplate || isSendingTemplate) return;

    setIsSendingTemplate(true);
    try {
      await api.post("/vendor/whatsapp/template/send-template", {
        templateId: selectedTemplate.id,
        recipients: [conversation.phone],
        bodyVariables: templateVariables.map(
          (v) => v.trim() || "Valued Customer",
        ),
      });
      setMediaModal(null);
      setSelectedTemplate(null);
      setTemplateVariables([]);
      toast.success("Template sent successfully!");
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
    // 1️⃣ Capture values needed for API
    const currentReplyToId = replyTo?.whatsappMessageId;

    // 2️⃣ Reset ALL UI state immediately
    setInputValue("");
    setSending(true);
    setReplyTo(null); // ✅ Clear reply context instantly
    setMediaModal(null);
    setShowAttachMenu(false);
    setImagePreview(null);

    try {
      await api.post("/vendor/whatsapp/send-message", {
        conversationId: conversation.id,
        text,
        replyToMessageId: currentReplyToId,
      });

      requestAnimationFrame(() => inputRef.current?.focus());
    } catch (err) {
      console.error("Failed to send message", err);
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
    <div className="flex-1 flex flex-col relative h-full overflow-hidden">
      <ChatHeader
        conversation={conversation}
        onBack={onBack}
        onUpdateLeadStatus={onUpdateLeadStatus}
      />

      <SessionBanner
        isSessionActive={isSessionActive}
        remainingTime={remainingTime}
      />

      {/* MESSAGES WRAPPER */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* FIXED WHATSAPP BACKGROUND */}
        <div
          className="
      absolute inset-0
      bg-wa-chat-bg
      pointer-events-none
    "
        >
          <div className="absolute inset-0 bg-[url('/chat-bg.png')] bg-repeat bg-center opacity-30 dark:opacity-[0.5]" />
        </div>

        {/* SCROLLABLE MESSAGES */}
        <ChatMessages
          messages={messages}
          conversation={conversation}
          messagesEndRef={messagesEndRef}
          onOpenMenu={(message, rect) => setActionMenu({ message, rect })}
          onReply={(m) => setReplyTo(m)}
          setInputValue={setInputValue}
          inputRef={inputRef}
        />
      </div>

      <ChatFooter
        conversation={conversation}
        inputValue={inputValue}
        setInputValue={setInputValue}
        inputRef={inputRef}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSend={sendMessage}
        onToggleAttach={() => setShowAttachMenu((v) => !v)}
        onSendTemplate={() => setMediaModal({ type: "template" })}
        isSessionActive={isSessionActive}
      />

      <AttachMenu
        open={showAttachMenu}
        onClose={() => setShowAttachMenu(false)}
        onSelect={(type) => {
          setShowAttachMenu(false);
          setMediaModal({ type });
        }}
      />

      <MediaModal
        mediaModal={mediaModal}
        onClose={() => setMediaModal(null)}
        setMediaModal={setMediaModal}
        /* IMAGE */
        imageMode={imageMode}
        setImageMode={setImageMode}
        imageInputRef={imageInputRef}
        handleImageSelect={handleImageSelect}
        /* FILE */
        genericInputRef={genericInputRef}
        handleGenericFiles={async (files) => {
          try {
            for (const rawFile of Array.from(files)) {
              const { file } = await processMedia(rawFile);

              const form = new FormData();
              form.append("conversationId", conversation.id);
              form.append("file", file);

              await api.post("/vendor/whatsapp/send-media", form);
            }

            setMediaModal(null);
            genericInputRef.current && (genericInputRef.current.value = "");
          } catch (err) {
            toast.error("Failed to send media");
          }
        }}
        /* GALLERY */
        galleryCategories={galleryCategories}
        gallerySubcategories={gallerySubcategories}
        galleryImages={galleryImages}
        selectedGalleryImages={selectedGalleryImages}
        galleryLoading={galleryLoading}
        includeCaption={includeCaption}
        isPreparingMedia={isPreparingMedia}
        setSelectedGalleryImages={setSelectedGalleryImages}
        setIncludeCaption={setIncludeCaption}
        handleGalleryCategoryClick={handleGalleryCategoryClick}
        loadGalleryImages={loadGalleryImages}
        toggleSelectAll={toggleSelectAll}
        handleSendGalleryImages={handleSendGalleryImages}
        selectedGalleryCategory={selectedGalleryCategory}
        selectedGallerySubcategory={selectedGallerySubcategory}
        setSelectedGallerySubcategory={setSelectedGallerySubcategory}
        /* TEMPLATE */
        templates={templates}
        selectedTemplate={selectedTemplate}
        setSelectedTemplate={setSelectedTemplate}
        templateVariables={templateVariables}
        setTemplateVariables={setTemplateVariables}
        templateSearch={templateSearch}
        setTemplateSearch={setTemplateSearch}
        isSendingTemplate={isSendingTemplate}
        handleSendTemplate={handleSendTemplate}
      />

      <ActionMenu
        actionMenu={actionMenu}
        onClose={() => setActionMenu(null)}
        onReply={(message) => {
          setReplyTo(message);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        onCopy={async (message) => {
          const success = await copyMessage(message);
          if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }
        }}
      />

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
      <ImagePreview
        preview={imagePreview}
        sending={sendingPreview}
        onClose={() => setImagePreview(null)}
        onChangeCaption={(caption) =>
          setImagePreview((p) => (p ? { ...p, caption } : p))
        }
        onSend={sendImageFromPreview}
      />
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

  // ✅ Use backend's unreadCount if available, otherwise calculate from messages
  const unreadCount =
    c.unreadCount ??
    c.messages?.filter((m) => m.direction === "inbound" && m.status !== "read")
      .length ??
    0;

  console.log(
    `📊 Conversation ${c.lead.companyName}: unreadCount = ${unreadCount} (from backend: ${c.unreadCount}), total messages = ${c.messages?.length}`,
  );

  return {
    id: c.id,
    companyName: c.lead.companyName || c.lead.phoneNumber,
    phone: c.lead.phoneNumber,
    status: c.lead.status || "new",
    leadId: c.lead.id,

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

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export default function InboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const chatId = searchParams.get("chatId");

  const [selectedConversation, setSelectedConversation] = useState<string>(
    chatId || "",
  );
  const [showChat, setShowChat] = useState(!!chatId);
  const readSentRef = useRef<Set<string>>(new Set());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [assignedLeads, setAssignedLeads] = useState<Lead[]>([]); // ✅ State for assigned leads

  const loadInbox = async () => {
    console.time("⏱️ Load Inbox API Call");
    try {
      const res = await api.get<ApiConversation[]>("/inbox");
      console.timeEnd("⏱️ Load Inbox API Call");
      console.time("⏱️ Map Conversations");
      setConversations(res.data.map(mapApiConversation));
      console.timeEnd("⏱️ Map Conversations");
      console.log(`📊 Loaded ${res.data.length} conversations`);

      // ✅ Fetch ALL assigned leads (handled by backend role filtering)
      const allLeadsRes = await api.get("/leads-management");
      // status_counts, total are also returned but we only need leads
      setAssignedLeads(allLeadsRes.data.data.leads || []);
    } catch (err) {
      console.error("❌ Failed to load inbox", err);
    }
  };

  useEffect(() => {
    loadInbox();
    if (chatId) {
      handleSelectConversation(chatId);
    }
  }, []);

  useInboxSocket({
    selectedConversation,
    readSentRef,
    setConversations,
    mapApiConversation,
  });

  /* =======================
     SELECT CONVERSATION
  ======================= */
  const handleSelectConversation = async (id: string) => {
    // Update URL
    const params = new URLSearchParams(searchParams.toString());
    params.set("chatId", id);
    router.replace(`${pathname}?${params.toString()}`);

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

            // ✅ Map outboundPayload for interactive messages
            outboundPayload: m.outboundPayload,
            messageType: (m as any).messageType,
          };
        },
      );

      setMessages((prev) => {
        const map = new Map(prev.map((m) => [m.id, m]));
        mappedMessages.forEach((m) => map.set(m.id, m));
        return Array.from(map.values()).sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
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
            : c,
        ),
      );
    } catch (err) {
      console.error("Failed to load conversation", err);
      setMessages([]);
    }
  };

  // ✅ Update conversation's last message status in real-time
  const handleUpdateConversationStatus = (
    conversationId: string,
    status: Message["status"],
  ) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId && c.lastMessageDirection === "outbound"
          ? { ...c, lastMessageStatus: status }
          : c,
      ),
    );
  };

  // ✅ Mark conversation as read (unreadCount = 0)
  const handleMarkAsRead = (conversationId: string) => {
    console.log(`📖 Marking conversation ${conversationId} as read`);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? { ...c, unreadCount: 0, hasUnread: false }
          : c,
      ),
    );
  };

  // ✅ Update lead status
  const handleUpdateLeadStatus = async (leadId: number, status: string) => {
    try {
      if (!leadId) return;

      const formData = new FormData();
      formData.append("status", status);

      await leadsAPI.update(leadId, formData);

      // Update local state
      setConversations((prev) =>
        prev.map((c) =>
          c.leadId === leadId ? { ...c, status: status as any } : c,
        ),
      );
      toast.success("Lead status updated");
    } catch (err) {
      console.error("Failed to update status", err);
      toast.error("Failed to update status");
    }
  };

  const currentConversation = conversations.find(
    (c) => c.id === selectedConversation,
  );

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden bg-background">
      <div
        className={`${
          showChat ? "hidden md:block" : "block"
        } w-full md:w-auto h-full flex-shrink-0`}
      >
        <ConversationList
          conversations={conversations}
          assignedLeads={assignedLeads} // ✅ Pass assigned leads
          selected={selectedConversation}
          onSelect={handleSelectConversation}
          onReload={loadInbox}
        />
      </div>
      <div
        className={`${showChat ? "block" : "hidden md:block"} flex-1 h-full min-w-0`}
      >
        {currentConversation ? (
          <ChatArea
            conversation={currentConversation}
            messages={messages}
            setMessages={setMessages}
            readSentRef={readSentRef}
            onBack={() => setShowChat(false)}
            onUpdateConversationStatus={handleUpdateConversationStatus}
            onMarkAsRead={handleMarkAsRead}
            onUpdateLeadStatus={handleUpdateLeadStatus}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-muted/10">
            <div className="text-center px-4 max-w-md">
              <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquareIcon className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
                Select a conversation
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Choose a chat from the left to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
