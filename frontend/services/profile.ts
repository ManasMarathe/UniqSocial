import api from "./api";

export interface ProfileData {
  display_name: string;
  age: number | null;
  city: string;
  occupation: string;
  ideal_weekend: string;
  love_talking_about: string;
  energy_level: string;
  social_style: string;
  sleep_schedule: string;
  drinking: string;
  fitness_level: string;
  work_schedule: string;
  looking_for: string[];
  currently_interested_in: string[];
  profile_completed: boolean;
}

export async function getProfile(): Promise<ProfileData> {
  const { data } = await api.get<ProfileData>("/profile");
  return data;
}

export async function updateProfile(
  profile: Partial<ProfileData>
): Promise<{ status: string; profile_completed: boolean }> {
  const { data } = await api.put<{
    status: string;
    profile_completed: boolean;
  }>("/profile", profile);
  return data;
}
