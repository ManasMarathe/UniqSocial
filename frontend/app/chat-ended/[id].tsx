import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useMatchStore } from "../../store/matchStore";
import { Colors } from "../../constants/colors";

export default function ChatEndedScreen() {
  const router = useRouter();
  const match = useMatchStore((s) => s.match);

  const handleGoHome = () => {
    router.replace("/(tabs)");
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Chat Ended",
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.text,
          headerBackVisible: false,
        }}
      />

      <View style={styles.content}>
        <Text style={styles.emoji}>🌙</Text>
        <Text style={styles.title}>Chat ended</Text>
        <Text style={styles.subtitle}>
          Your conversation with{" "}
          <Text style={styles.bold}>
            {match?.partner_username || "your match"}
          </Text>{" "}
          has ended.
        </Text>
        <Text style={styles.nextTime}>See you tomorrow at 8 PM</Text>

        <TouchableOpacity style={styles.button} onPress={handleGoHome}>
          <Text style={styles.buttonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 17,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 8,
  },
  bold: {
    fontWeight: "700",
    color: Colors.text,
  },
  nextTime: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 48,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
});
