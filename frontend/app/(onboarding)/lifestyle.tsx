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

const SLEEP_OPTIONS = ["Early Bird", "Night Owl"];
const DRINKING_OPTIONS = ["Yes", "No", "Occasionally"];
const FITNESS_OPTIONS = ["Active", "Moderate", "Low"];
const WORK_OPTIONS = ["Student", "9-5", "Remote", "Flexible"];

function toKey(label: string) {
  return label.toLowerCase().replace(/ /g, "_").replace(/-/g, "_");
}

export default function LifestyleScreen() {
  const router = useRouter();
  const updateField = useProfileStore((s) => s.updateField);

  const [sleep, setSleep] = useState("");
  const [drinking, setDrinking] = useState("");
  const [fitness, setFitness] = useState("");
  const [work, setWork] = useState("");

  const handleContinue = () => {
    if (!sleep || !drinking || !fitness || !work) {
      Alert.alert("Missing Info", "Please make a selection for each category.");
      return;
    }
    updateField({
      sleep_schedule: toKey(sleep),
      drinking: toKey(drinking),
      fitness_level: toKey(fitness),
      work_schedule: toKey(work),
    });
    router.push("/(onboarding)/intent");
  };

  const renderOptions = (
    label: string,
    options: string[],
    selected: string,
    onSelect: (v: string) => void
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.option, selected === opt && styles.optionSelected]}
            onPress={() => onSelect(opt)}
          >
            <Text
              style={[
                styles.optionText,
                selected === opt && styles.optionTextSelected,
              ]}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.progress}>
        <Text style={styles.stepText}>Step 3 of 5</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: "60%" }]} />
        </View>
      </View>

      <Text style={styles.title}>Your Lifestyle</Text>
      <Text style={styles.subtitle}>
        This helps prevent mismatches and keeps conversations flowing.
      </Text>

      <View style={styles.form}>
        {renderOptions("Sleep schedule", SLEEP_OPTIONS, sleep, setSleep)}
        {renderOptions("Drinking", DRINKING_OPTIONS, drinking, setDrinking)}
        {renderOptions("Fitness level", FITNESS_OPTIONS, fitness, setFitness)}
        {renderOptions("Work schedule", WORK_OPTIONS, work, setWork)}
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
  form: { gap: 28 },
  field: { gap: 10 },
  label: { fontSize: 14, fontWeight: "600", color: Colors.textSecondary },
  optionRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 10 },
  option: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionSelected: {
    backgroundColor: "rgba(124,92,252,0.15)",
    borderColor: Colors.primary,
  },
  optionText: { color: Colors.text, fontSize: 15 },
  optionTextSelected: { color: Colors.primary, fontWeight: "600" },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center" as const,
    marginTop: 32,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
