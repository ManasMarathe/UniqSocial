import { create } from "zustand";
import * as profileService from "../services/profile";
import type { ProfileData } from "../services/profile";

interface ProfileState {
  profile: ProfileData;
  updateField: (fields: Partial<ProfileData>) => void;
  submitProfile: () => Promise<boolean>;
  loadProfile: () => Promise<void>;
  reset: () => void;
}

const defaultProfile: ProfileData = {
  display_name: "",
  age: null,
  city: "",
  occupation: "",
  ideal_weekend: "",
  love_talking_about: "",
  energy_level: "",
  social_style: "",
  sleep_schedule: "",
  drinking: "",
  fitness_level: "",
  work_schedule: "",
  looking_for: [],
  currently_interested_in: [],
  profile_completed: false,
};

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: { ...defaultProfile },

  updateField: (fields) =>
    set((state) => ({
      profile: { ...state.profile, ...fields },
    })),

  submitProfile: async () => {
    const { profile } = get();
    const response = await profileService.updateProfile(profile);
    if (response.profile_completed) {
      set((state) => ({
        profile: { ...state.profile, profile_completed: true },
      }));
    }
    return response.profile_completed;
  },

  loadProfile: async () => {
    try {
      const data = await profileService.getProfile();
      set({ profile: { ...defaultProfile, ...data } });
    } catch {
      // no existing profile
    }
  },

  reset: () => set({ profile: { ...defaultProfile } }),
}));
