import * as storage from "./storage";
import type { WSMessage } from "../types";

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || "ws://localhost:8080";

type MessageHandler = (msg: WSMessage) => void;

export class ChatWebSocket {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private handlers: MessageHandler[] = [];
  private reconnectAttempts = 0;
  private maxReconnect = 5;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  async connect(): Promise<void> {
    const token = await storage.getItem("access_token");
    if (!token) throw new Error("Not authenticated");

    const url = `${WS_URL}/api/chat/ws?session_id=${this.sessionId}&token=${token}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        this.handlers.forEach((h) => h(msg));
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onclose = () => {
      this.attemptReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  send(msg: WSMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  sendMessage(content: string): void {
    this.send({
      type: "message",
      session_id: this.sessionId,
      content,
    });
  }

  sendTyping(): void {
    this.send({
      type: "typing",
      session_id: this.sessionId,
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.maxReconnect = 0; // Prevent reconnection
    this.ws?.close();
    this.ws = null;
    this.handlers = [];
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnect) return;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}
