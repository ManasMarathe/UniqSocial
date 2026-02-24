import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useProfileStore } from "../../store/profileStore";
import { useAuthStore } from "../../store/authStore";
import { Colors } from "../../constants/colors";

const ACTIVITY_OPTIONS = [
  "Looking for gym partner",
  "Looking for someone to work from café",
  "Looking for badminton partner",
  "Looking for running buddy",
  "Looking for book club",
  "Looking for weekend hikes",
  "Looking for coding buddy",
  "Looking for travel companion",
];

export default function ActivityScreen() {
  const updateField = useProfileStore((s) => s.updateField);
  const submitProfile = useProfileStore((s) => s.submitProfile);
  const setProfileCompleted = useAuthStore((s) => s.setProfileCompleted);

  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggle = (item: string) => {
    setSelected((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const handleComplete = async () => {
    if (selected.length === 0) {
      Alert.alert("Missing Info", "Please select at least one activity.");
      return;
    }
    setLoading(true);
    try {
      updateField({ currently_interested_in: selected });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const completed = await submitProfile();
      if (completed) {
        setProfileCompleted();
      } else {
        Alert.alert(
          "Incomplete Profile",
          "Some fields are missing. Please go back and fill them in."
        );
      }
    } catch {
      Alert.alert("Error", "Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.progress}>
        <Text style={styles.stepText}>Step 5 of 5</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: "100%" }]} />
        </View>
      </View>

      <Text style={styles.title}>Currently interested in</Text>
      <Text style={styles.subtitle}>
        Show others what you're up to right now. You can change this anytime.
      </Text>

      <View style={styles.chipContainer}>
        {ACTIVITY_OPTIONS.map((opt) => {
          const isSelected = selected.includes(opt);
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => toggle(opt)}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected && styles.chipTextSelected,
                ]}
              >
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleComplete}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Complete Profile</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    backgroundColor: Colors.background,
    minHeight: "100%",
  },
  progress: { marginBottom: 32 },
  stepText: { color: Colors.textSecondary, fontSize: 14, marginBottom: 8 },
  progressBar: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 32,
    lineHeight: 22,
  },
  chipContainer: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 12,
  },
  chip: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipSelected: {
    backgroundColor: "rgba(124,92,252,0.15)",
    borderColor: Colors.primary,
  },
  chipText: { color: Colors.text, fontSize: 15 },
  chipTextSelected: { color: Colors.primary, fontWeight: "600" },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center" as const,
    marginTop: 40,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
