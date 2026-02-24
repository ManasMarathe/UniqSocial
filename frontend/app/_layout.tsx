import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "../store/authStore";
import {
  View,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Colors } from "../constants/colors";

export default function RootLayout() {
  const { isAuthenticated, isLoading, initialize, user } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "(onboarding)";
    const profileDone = user?.profile_completed ?? false;

    if (!isAuthenticated) {
      if (!inAuthGroup) router.replace("/(auth)/login");
    } else if (!profileDone) {
      if (!inOnboarding) router.replace("/(onboarding)/identity");
    } else {
      if (inAuthGroup || inOnboarding) router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, segments, user?.profile_completed]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Slot />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
});
