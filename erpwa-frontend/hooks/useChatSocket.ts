"use client";

import { useEffect } from "react";
import api from "@/lib/api";
import { connectSocket, getSocket } from "@/lib/socket";
import type { Message } from "@/lib/types";

const STATUS_PRIORITY: Record<NonNullable<Message["status"]>, number> = {
  failed: 0,
  sent: 1,
  delivered: 2,
  received: 2,
  read: 3,
};

interface UseChatSocketParams {
  conversationId: string;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onUpdateConversationStatus?: (
    conversationId: string,
    status: Message["status"],
  ) => void;
  onCustomerMessage?: () => void;
}

export function useChatSocket({
  conversationId,
  setMessages,
  onUpdateConversationStatus,
  onCustomerMessage,
}: UseChatSocketParams) {
  useEffect(() => {
    if (!conversationId) return;

    connectSocket();
    const socket = getSocket();

    socket.emit("join-conversation", conversationId);

    /* =========================
       NEW MESSAGE HANDLER
    ========================== */
    const handleNewMessage = (msg: Message) => {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === msg.id);
        return exists ? prev : [...prev, msg];
      });

      if (msg.sender === "customer") {
        onCustomerMessage?.();
      }
    };

    /* =========================
       STATUS UPDATE HANDLER
    ========================== */
    const handleStatusUpdate = ({
      whatsappMessageId,
      status,
    }: {
      whatsappMessageId: string;
      status?: Message["status"];
    }) => {
      if (!status) return;

      setMessages((prev) => {
        let updated = prev.map((m) => {
          if (m.whatsappMessageId !== whatsappMessageId) return m;

          if (!m.status) return { ...m, status };

          if (STATUS_PRIORITY[m.status] >= STATUS_PRIORITY[status]) {
            return m; // ⛔ ignore downgrade
          }

          return { ...m, status };
        });

        const lastMessage = updated[updated.length - 1];
        if (
          lastMessage?.whatsappMessageId === whatsappMessageId &&
          onUpdateConversationStatus
        ) {
          onUpdateConversationStatus(conversationId, status);
        }

        return updated;
      });
    };

    socket.on("message:new", handleNewMessage);
    socket.on("message:status", handleStatusUpdate);

    return () => {
      socket.emit("leave-conversation", conversationId);
      socket.off("message:new", handleNewMessage);
      socket.off("message:status", handleStatusUpdate);
    };
  }, [
    conversationId,
    setMessages,
    onUpdateConversationStatus,
    onCustomerMessage,
  ]);
}
