import api from "./api";
import type { TokenPair } from "../types";

export async function signup(
  email: string,
  password: string,
  username: string
): Promise<TokenPair> {
  const { data } = await api.post<TokenPair>("/auth/signup", {
    email,
    password,
    username,
  });
  return data;
}

export async function login(
  email: string,
  password: string
): Promise<TokenPair> {
  const { data } = await api.post<TokenPair>("/auth/login", {
    email,
    password,
  });
  return data;
}

export async function refresh(refreshToken: string): Promise<TokenPair> {
  const { data } = await api.post<TokenPair>("/auth/refresh", {
    refresh_token: refreshToken,
  });
  return data;
}
