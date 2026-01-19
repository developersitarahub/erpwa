"use client";

import { Search, MoreVertical, MessageCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { getConversationTick } from "@/utils/getConversationTicks";
import { useState, useEffect } from "react";
import { Conversation } from "@/lib/types";
import {
  checkWhatsAppNumber,
  createWhatsAppConversation,
} from "@/lib/whatsappApi";
import { toast } from "react-toastify";

export default function ConversationList({
  conversations,
  selected,
  onSelect,
  onReload,
}: {
  conversations: Conversation[];
  selected: string;
  onSelect: (id: string) => void;
  onReload?: () => Promise<void>;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [whatsappCheckResult, setWhatsappCheckResult] = useState<{
    isOnWhatsApp: boolean;
    phoneNumber: string;
    conversationExists: boolean;
    conversationId?: string;
    lead?: {
      id: number;
      phoneNumber: string;
      companyName: string;
    };
  } | null>(null);

  // Filter conversations based on search query
  const filteredConversations = conversations.filter((conv) => {
    const query = searchQuery.toLowerCase();
    return (
      conv.companyName?.toLowerCase().includes(query) ||
      conv.phone?.toLowerCase().includes(query)
    );
  });

  // Check if search query looks like a phone number
  const isPhoneNumber = (query: string) => {
    const digitsOnly = query.replace(/\D/g, "");
    return digitsOnly.length >= 10;
  };

  // Debounce WhatsApp number check
  useEffect(() => {
    if (!searchQuery || !isPhoneNumber(searchQuery)) {
      setWhatsappCheckResult(null);
      return;
    }

    // Don't check if we already have a conversation with this number
    const existingConv = conversations.find(
      (conv) =>
        conv.phone?.replace(/\D/g, "") === searchQuery.replace(/\D/g, ""),
    );
    if (existingConv) {
      setWhatsappCheckResult(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsChecking(true);
      try {
        const result = await checkWhatsAppNumber(searchQuery);
        setWhatsappCheckResult(result);
      } catch (error) {
        console.error("Error checking WhatsApp number:", error);
        setWhatsappCheckResult(null);
      } finally {
        setIsChecking(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [searchQuery, conversations]);

  // Handle creating a new conversation
  const handleStartChat = async () => {
    if (!whatsappCheckResult || isCreating) return;

    setIsCreating(true);
    try {
      if (whatsappCheckResult.conversationExists) {
        // Open existing conversation
        onSelect(whatsappCheckResult.conversationId!);
        setSearchQuery("");
        setWhatsappCheckResult(null);
      } else {
        // Create new conversation
        const result = await createWhatsAppConversation(
          whatsappCheckResult.phoneNumber,
          whatsappCheckResult.lead?.companyName ||
            whatsappCheckResult.phoneNumber,
        );

        // Reload conversations list to include the new one
        if (onReload) {
          await onReload();
        }

        // Open the new conversation
        onSelect(result.conversationId);
        setSearchQuery("");
        setWhatsappCheckResult(null);

        toast.success("Conversation created successfully!");
      }
    } catch (error) {
      console.error("Error starting chat:", error);
      toast.error("Failed to start conversation. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

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
          {isChecking && (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-background">
        {/* WhatsApp Number Check Result */}
        {whatsappCheckResult &&
          whatsappCheckResult.isOnWhatsApp &&
          filteredConversations.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-4 py-3 border-b border-border/50 bg-muted/30"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {whatsappCheckResult.lead?.companyName ||
                      whatsappCheckResult.phoneNumber}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {whatsappCheckResult.phoneNumber}
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: isCreating ? 1 : 1.05 }}
                  whileTap={{ scale: isCreating ? 1 : 0.95 }}
                  onClick={handleStartChat}
                  disabled={isCreating}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="w-4 h-4" />
                      Chat
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}

        {/* Conversation List */}
        {filteredConversations.map((conv, i) => (
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
                  <p className="text-base font-semibold text-foreground truncate">
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
                      conv.lastMessageStatus,
                    )}

                    <p
                      className={`text-sm truncate ${
                        conv.hasUnread
                          ? "text-foreground"
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

        {/* No results message */}
        {searchQuery &&
          filteredConversations.length === 0 &&
          !whatsappCheckResult &&
          !isChecking && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No conversations found
              </p>
            </div>
          )}
      </div>
    </div>
  );
}
