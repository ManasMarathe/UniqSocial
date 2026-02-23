import { create } from "zustand";
import type { ChatMessage, WSMessage } from "../types";
import { ChatWebSocket } from "../services/ws";
import * as chatService from "../services/chat";

interface ChatState {
  messages: ChatMessage[];
  isTyping: boolean;
  isConnected: boolean;
  ws: ChatWebSocket | null;

  connect: (sessionId: string, currentUserId: string) => Promise<void>;
  disconnect: () => void;
  sendMessage: (content: string, currentUserId: string) => void;
  sendTyping: () => void;
  loadHistory: (sessionId: string) => Promise<void>;
  endChat: (sessionId: string) => Promise<void>;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isTyping: false,
  isConnected: false,
  ws: null,

  connect: async (sessionId: string, currentUserId: string) => {
    const existing = get().ws;
    if (existing) existing.disconnect();

    const ws = new ChatWebSocket(sessionId);

    ws.onMessage((msg: WSMessage) => {
      if (msg.type === "message" && msg.content && msg.sender_id) {
        const chatMsg: ChatMessage = {
          id: `${Date.now()}-${msg.sender_id}`,
          session_id: sessionId,
          sender_id: msg.sender_id,
          content: msg.content,
          created_at: msg.timestamp || new Date().toISOString(),
        };

        set((state) => {
          if (msg.sender_id === currentUserId) return state;
          return { messages: [...state.messages, chatMsg] };
        });
      }

      if (msg.type === "typing" && msg.sender_id !== currentUserId) {
        set({ isTyping: true });
        setTimeout(() => set({ isTyping: false }), 3000);
      }

      if (msg.type === "chat_ended") {
        set({ isConnected: false });
      }
    });

    await ws.connect();
    set({ ws, isConnected: true });
  },

  disconnect: () => {
    const { ws } = get();
    ws?.disconnect();
    set({ ws: null, isConnected: false });
  },

  sendMessage: (content: string, currentUserId: string) => {
    const { ws } = get();
    if (!ws) return;

    ws.sendMessage(content);

    const optimistic: ChatMessage = {
      id: `${Date.now()}-${currentUserId}`,
      session_id: "",
      sender_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
    };

    set((state) => ({ messages: [...state.messages, optimistic] }));
  },

  sendTyping: () => {
    get().ws?.sendTyping();
  },

  loadHistory: async (sessionId: string) => {
    try {
      const messages = await chatService.getMessages(sessionId);
      set({ messages });
    } catch {
      // silently fail
    }
  },

  endChat: async (sessionId: string) => {
    await chatService.endChat(sessionId);
    set({ isConnected: false });
  },

  reset: () => {
    get().ws?.disconnect();
    set({ messages: [], isTyping: false, isConnected: false, ws: null });
  },
}));
