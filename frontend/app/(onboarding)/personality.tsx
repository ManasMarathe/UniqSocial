import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useProfileStore } from "../../store/profileStore";
import { Colors } from "../../constants/colors";

const ENERGY_OPTIONS = ["Introvert", "Ambivert", "Extrovert"];
const SOCIAL_OPTIONS = ["1-on-1", "Small Group", "Large Group"];

export default function PersonalityScreen() {
  const router = useRouter();
  const updateField = useProfileStore((s) => s.updateField);

  const [idealWeekend, setIdealWeekend] = useState("");
  const [loveTalking, setLoveTalking] = useState("");
  const [energy, setEnergy] = useState("");
  const [social, setSocial] = useState("");

  const handleContinue = () => {
    if (!idealWeekend.trim() || !loveTalking.trim() || !energy || !social) {
      Alert.alert("Missing Info", "Please complete all fields to continue.");
      return;
    }
    updateField({
      ideal_weekend: idealWeekend.trim(),
      love_talking_about: loveTalking.trim(),
      energy_level: energy.toLowerCase(),
      social_style: social.toLowerCase().replace(/ /g, "_"),
    });
    router.push("/(onboarding)/lifestyle");
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.progress}>
          <Text style={styles.stepText}>Step 2 of 5</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: "40%" }]} />
          </View>
        </View>

        <Text style={styles.title}>Your Personality</Text>
        <Text style={styles.subtitle}>
          This helps us match you with people you'll actually click with.
        </Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>My ideal weekend looks like...</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={idealWeekend}
              onChangeText={setIdealWeekend}
              placeholder="e.g. Gym, coffee, coding side project"
              placeholderTextColor={Colors.textLight}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>I love talking about...</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={loveTalking}
              onChangeText={setLoveTalking}
              placeholder="e.g. Startups, psychology, books"
              placeholderTextColor={Colors.textLight}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>My energy level</Text>
            <View style={styles.optionRow}>
              {ENERGY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.option,
                    energy === opt && styles.optionSelected,
                  ]}
                  onPress={() => setEnergy(opt)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      energy === opt && styles.optionTextSelected,
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Social style</Text>
            <View style={styles.optionRow}>
              {SOCIAL_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.option,
                    social === opt && styles.optionSelected,
                  ]}
                  onPress={() => setSocial(opt)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      social === opt && styles.optionTextSelected,
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
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
  form: { gap: 24 },
  field: { gap: 10 },
  label: { fontSize: 14, fontWeight: "600", color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  multiline: { minHeight: 80, paddingTop: 16 },
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
