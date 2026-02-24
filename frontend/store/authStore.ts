import { create } from "zustand";
import * as storage from "../services/storage";
import type { User, TokenPair } from "../types";
import * as authService from "../services/auth";
import * as userService from "../services/user";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setProfileCompleted: () => void;
}

async function storeTokens(tokens: TokenPair) {
  await storage.setItem("access_token", tokens.access_token);
  await storage.setItem("refresh_token", tokens.refresh_token);
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: async () => {
    try {
      const token = await storage.getItem("access_token");
      if (!token) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      const user = await userService.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      await storage.deleteItem("access_token");
      await storage.deleteItem("refresh_token");
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  login: async (email: string, password: string) => {
    const tokens = await authService.login(email, password);
    await storeTokens(tokens);
    const user = await userService.getMe();
    set({ user, isAuthenticated: true });
  },

  signup: async (email: string, password: string, username: string) => {
    const tokens = await authService.signup(email, password, username);
    await storeTokens(tokens);
    const user = await userService.getMe();
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    await storage.deleteItem("access_token");
    await storage.deleteItem("refresh_token");
    set({ user: null, isAuthenticated: false });
  },

  refreshUser: async () => {
    try {
      const user = await userService.getMe();
      set({ user });
    } catch {
      // silently fail
    }
  },

  setProfileCompleted: () =>
    set((state) => ({
      user: state.user
        ? { ...state.user, profile_completed: true }
        : null,
    })),
}));
