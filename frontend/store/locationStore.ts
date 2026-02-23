import { create } from "zustand";
import * as Location from "expo-location";
import * as userService from "../services/user";

interface LocationState {
  hasPermission: boolean | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;

  requestPermission: () => Promise<boolean>;
  updateLocation: () => Promise<void>;
}

export const useLocationStore = create<LocationState>((set) => ({
  hasPermission: null,
  city: null,
  latitude: null,
  longitude: null,

  requestPermission: async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === "granted";
    set({ hasPermission: granted });
    return granted;
  },

  updateLocation: async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;

      const [geocode] = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      const city = geocode?.city || geocode?.region || "Unknown";
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      await userService.updateLocation({
        latitude,
        longitude,
        city,
        timezone,
      });

      set({ latitude, longitude, city });
    } catch {
      // silently fail
    }
  },
}));
