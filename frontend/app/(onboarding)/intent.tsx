import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useProfileStore } from "../../store/profileStore";
import { Colors } from "../../constants/colors";

const INTENT_OPTIONS = [
  "Gym Partner",
  "Startup Friends",
  "Casual Hangout Friends",
  "Deep Conversations",
  "Activity Partners",
  "Networking",
  "Moving to New City",
];

export default function IntentScreen() {
  const router = useRouter();
  const updateField = useProfileStore((s) => s.updateField);
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (item: string) => {
    setSelected((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const handleContinue = () => {
    if (selected.length === 0) {
      Alert.alert("Missing Info", "Please select at least one option.");
      return;
    }
    updateField({ looking_for: selected });
    router.push("/(onboarding)/activity");
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.progress}>
        <Text style={styles.stepText}>Step 4 of 5</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: "80%" }]} />
        </View>
      </View>

      <Text style={styles.title}>What are you looking for?</Text>
      <Text style={styles.subtitle}>
        Select everything that fits. This helps us understand why you're here.
      </Text>

      <View style={styles.chipContainer}>
        {INTENT_OPTIONS.map((opt) => {
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

      <TouchableOpacity style={styles.button} onPress={handleContinue}>
        <Text style={styles.buttonText}>Continue</Text>
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
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
