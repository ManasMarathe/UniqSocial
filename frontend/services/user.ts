import api from "./api";
import type { User } from "../types";

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>("/users/me");
  return data;
}

export async function updateProfile(updates: {
  username?: string;
  photo_url?: string;
  interests?: string[];
}): Promise<void> {
  await api.put("/users/me", updates);
}

export async function updateLocation(location: {
  latitude: number;
  longitude: number;
  city: string;
  timezone: string;
}): Promise<void> {
  await api.put("/users/me/location", location);
}
