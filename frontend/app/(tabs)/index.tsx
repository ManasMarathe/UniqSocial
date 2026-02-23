import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useMatchStore } from "../../store/matchStore";
import { useAuthStore } from "../../store/authStore";
import { Colors } from "../../constants/colors";

function useCountdown() {
  const [timeLeft, setTimeLeft] = useState("");
  const [isMatchWindow, setIsMatchWindow] = useState(false);
  const [isPastMidnight, setIsPastMidnight] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const hour = now.getHours();

      if (hour >= 20 && hour < 24) {
        setIsMatchWindow(true);
        setIsPastMidnight(false);
        setTimeLeft("");
      } else if (hour >= 0 && hour < 20) {
        setIsMatchWindow(false);
        setIsPastMidnight(hour < 8);

        const target = new Date(now);
        target.setHours(20, 0, 0, 0);
        const diff = target.getTime() - now.getTime();

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setTimeLeft(
          `${hours.toString().padStart(2, "0")}:${minutes
            .toString()
            .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
        );
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return { timeLeft, isMatchWindow, isPastMidnight };
}

export default function HomeScreen() {
  const router = useRouter();
  const { match, status, error, checkTodayMatch, findMatch } = useMatchStore();
  const user = useAuthStore((s) => s.user);
  const { timeLeft, isMatchWindow, isPastMidnight } = useCountdown();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    checkTodayMatch();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await checkTodayMatch();
    setRefreshing(false);
  }, []);

  const handleFindMatch = () => {
    findMatch();
  };

  const handleStartChat = () => {
    if (match?.session_id) {
      router.push(`/match/${match.session_id}`);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.greeting}>
        Hey, {user?.username || "there"}
      </Text>

      {status === "matched" && match ? (
        <View style={styles.matchCard}>
          <View style={styles.matchAvatar}>
            <Text style={styles.matchAvatarText}>
              {match.partner_username.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.matchTitle}>You've been matched!</Text>
          <Text style={styles.matchName}>{match.partner_username}</Text>
          <TouchableOpacity
            style={styles.chatButton}
            onPress={handleStartChat}
          >
            <Text style={styles.chatButtonText}>Start Chatting</Text>
          </TouchableOpacity>
        </View>
      ) : status === "ended" ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateEmoji}>🌙</Text>
          <Text style={styles.stateTitle}>Chat ended</Text>
          <Text style={styles.stateSubtitle}>
            See you tomorrow at 8 PM for a new connection
          </Text>
        </View>
      ) : status === "searching" ? (
        <View style={styles.stateCard}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.stateTitle}>Finding your match...</Text>
          <Text style={styles.stateSubtitle}>
            Looking for someone interesting nearby
          </Text>
        </View>
      ) : isMatchWindow ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateEmoji}>✨</Text>
          <Text style={styles.stateTitle}>Match window is open!</Text>
          <Text style={styles.stateSubtitle}>
            Find your conversation partner for tonight
          </Text>
          <TouchableOpacity style={styles.findButton} onPress={handleFindMatch}>
            <Text style={styles.findButtonText}>Find My Match</Text>
          </TouchableOpacity>
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      ) : isPastMidnight ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateEmoji}>🌙</Text>
          <Text style={styles.stateTitle}>See you tonight</Text>
          <Text style={styles.stateSubtitle}>
            Your next match opens at 8 PM
          </Text>
          {timeLeft ? (
            <View style={styles.timerContainer}>
              <Text style={styles.timerLabel}>Countdown</Text>
              <Text style={styles.timer}>{timeLeft}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.stateCard}>
          <Text style={styles.stateEmoji}>⏰</Text>
          <Text style={styles.stateTitle}>Not yet time</Text>
          <Text style={styles.stateSubtitle}>
            Your daily match opens at 8 PM
          </Text>
          {timeLeft ? (
            <View style={styles.timerContainer}>
              <Text style={styles.timerLabel}>Opens in</Text>
              <Text style={styles.timer}>{timeLeft}</Text>
            </View>
          ) : null}
        </View>
      )}

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>How it works</Text>
        <View style={styles.infoItem}>
          <Text style={styles.infoNumber}>1</Text>
          <Text style={styles.infoText}>
            Every day at 8 PM, you get matched with someone nearby
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoNumber}>2</Text>
          <Text style={styles.infoText}>
            Chat until midnight — make the most of it
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoNumber}>3</Text>
          <Text style={styles.infoText}>
            Be responsive — it helps you get better matches
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 24,
  },
  matchCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  matchAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  matchAvatarText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
  },
  matchTitle: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  matchName: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 24,
  },
  chatButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 48,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  chatButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  stateCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  stateEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  stateTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 8,
    marginBottom: 8,
  },
  stateSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  timerContainer: {
    marginTop: 24,
    alignItems: "center",
  },
  timerLabel: {
    fontSize: 13,
    color: Colors.textLight,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  timer: {
    fontSize: 40,
    fontWeight: "800",
    color: Colors.primary,
    fontVariant: ["tabular-nums"],
  },
  findButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 48,
    marginTop: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  findButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  error: {
    color: Colors.error,
    fontSize: 14,
    marginTop: 12,
  },
  infoSection: {
    marginTop: 32,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 12,
  },
  infoNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    color: "#fff",
    textAlign: "center",
    lineHeight: 28,
    fontSize: 14,
    fontWeight: "700",
    overflow: "hidden",
  },
  infoText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
});
