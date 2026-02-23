import api from "./api";
import type { ChatMessage } from "../types";

export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  const { data } = await api.get<ChatMessage[]>(
    `/chat/${sessionId}/messages`
  );
  return data;
}

export async function endChat(sessionId: string): Promise<void> {
  await api.post(`/chat/${sessionId}/end`);
}
