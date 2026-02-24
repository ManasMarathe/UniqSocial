export interface User {
  id: string;
  email: string;
  username: string;
  photo_url: string | null;
  interests: string[];
  city: string | null;
  latitude?: number;
  longitude?: number;
  profile_completed: boolean;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export interface MatchResult {
  session_id: string;
  status: "active" | "ended_by_user" | "ended_by_system" | "ended_no_reply";
  partner_id: string;
  partner_username: string;
  partner_photo: string | null;
  started_at: string;
}

export interface MatchResponse {
  matched: boolean;
  match?: MatchResult;
  message?: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface WSMessage {
  type: "message" | "typing" | "read_receipt" | "chat_ended";
  session_id: string;
  content?: string;
  sender_id?: string;
  timestamp?: string;
}
