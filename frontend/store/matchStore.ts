import { create } from "zustand";
import type { MatchResult } from "../types";
import * as matchService from "../services/match";

type MatchStatus = "idle" | "searching" | "matched" | "chatting" | "ended";

interface MatchState {
  match: MatchResult | null;
  status: MatchStatus;
  error: string | null;

  checkTodayMatch: () => Promise<void>;
  findMatch: () => Promise<void>;
  setStatus: (status: MatchStatus) => void;
  reset: () => void;
}

export const useMatchStore = create<MatchState>((set) => ({
  match: null,
  status: "idle",
  error: null,

  checkTodayMatch: async () => {
    try {
      const response = await matchService.getTodayMatch();
      if (response.matched && response.match) {
        const status =
          response.match.status === "active" ? "matched" : "ended";
        set({ match: response.match, status, error: null });
      } else {
        set({ match: null, status: "idle", error: null });
      }
    } catch {
      set({ error: "Failed to check match" });
    }
  },

  findMatch: async () => {
    set({ status: "searching", error: null });
    try {
      const response = await matchService.findMatch();
      if (response.matched && response.match) {
        set({ match: response.match, status: "matched" });
      } else {
        set({
          status: "idle",
          error: response.message || "No matches available",
        });
      }
    } catch {
      set({ status: "idle", error: "Failed to find match" });
    }
  },

  setStatus: (status: MatchStatus) => set({ status }),
  reset: () => set({ match: null, status: "idle", error: null }),
}));
