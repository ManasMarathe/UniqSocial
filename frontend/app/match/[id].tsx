import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  Animated,
  ViewToken,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChatStore } from "../../store/chatStore";
import { useAuthStore } from "../../store/authStore";
import { useMatchStore } from "../../store/matchStore";
import { Colors } from "../../constants/colors";
import type { ChatMessage } from "../../types";

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const diffDays = Math.floor(
    (today.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)
    return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function getInitial(name: string | undefined): string {
  return (name?.charAt(0) || "?").toUpperCase();
}

export default function ChatScreen() {
  const { id: sessionId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const match = useMatchStore((s) => s.match);
  const {
    messages,
    isTyping,
    isConnected,
    connect,
    disconnect,
    sendMessage,
    sendTyping,
    loadHistory,
    endChat,
    reset,
  } = useChatStore();

  const [text, setText] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [scrollDate, setScrollDate] = useState("");
  const dateOpacity = useRef(new Animated.Value(0)).current;
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    if (!sessionId || !user?.id) return;
    loadHistory(sessionId);
    connect(sessionId, user.id);
    return () => disconnect();
  }, [sessionId, user?.id]);

  useEffect(() => {
    if (!isConnected && messages.length > 0) {
      router.replace(`/chat-ended/${sessionId}`);
    }
  }, [isConnected]);

  useEffect(() => {
    return () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || !user?.id) return;
    sendMessage(trimmed, user.id);
    setText("");
  }, [text, user?.id]);

  const handleTextChange = useCallback(
    (value: string) => {
      setText(value);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      sendTyping();
      typingTimer.current = setTimeout(() => {}, 2000);
    },
    [sendTyping]
  );

  const handleEndChat = () => {
    Alert.alert(
      "End Chat",
      "Are you sure you want to end this conversation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End Chat",
          style: "destructive",
          onPress: async () => {
            if (sessionId) {
              await endChat(sessionId);
              useMatchStore.getState().setStatus("ended");
              reset();
              router.replace(`/chat-ended/${sessionId}`);
            }
          },
        },
      ]
    );
  };

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 0,
    minimumViewTime: 0,
  }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0 || isAtBottomRef.current) return;
      const sorted = [...viewableItems].sort(
        (a, b) => (a.index ?? 0) - (b.index ?? 0)
      );
      const firstMsg = sorted[0]?.item as ChatMessage | undefined;
      if (!firstMsg?.created_at) return;

      setScrollDate(formatDateLabel(firstMsg.created_at));

      Animated.timing(dateOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();

      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      fadeTimer.current = setTimeout(() => {
        Animated.timing(dateOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }, 1500);
    }
  ).current;

  const handleScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const distFromBottom =
        contentSize.height - contentOffset.y - layoutMeasurement.height;
      isAtBottomRef.current = distFromBottom < 50;

      if (isAtBottomRef.current) {
        if (fadeTimer.current) clearTimeout(fadeTimer.current);
        Animated.timing(dateOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    },
    [dateOpacity]
  );

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isMe = item.sender_id === user?.id;
      const initial = isMe
        ? getInitial(user?.username)
        : getInitial(match?.partner_username);
      const time = new Date(item.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      return (
        <View
          style={[
            styles.messageRow,
            isMe ? styles.messageRowSent : styles.messageRowReceived,
          ]}
        >
          {!isMe && (
            <View style={[styles.avatarSmall, styles.partnerAvatarColor]}>
              <Text style={styles.avatarSmallText}>{initial}</Text>
            </View>
          )}
          <View
            style={[
              styles.messageBubble,
              isMe ? styles.sentBubble : styles.receivedBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isMe ? styles.sentText : styles.receivedText,
              ]}
            >
              {item.content}
            </Text>
            <Text
              style={[
                styles.messageTime,
                isMe ? styles.sentTime : styles.receivedTime,
              ]}
            >
              {time}
            </Text>
          </View>
          {isMe && <View style={styles.avatarSpacer} />}
        </View>
      );
    },
    [user?.id, user?.username, match?.partner_username]
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => router.replace("/(tabs)")}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.backArrow}>{"‹"}</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerName} numberOfLines={1}>
            {match?.partner_username || "Chat"}
          </Text>
          {isConnected && (
            <Text style={styles.headerStatus}>Online</Text>
          )}
        </View>

        <TouchableOpacity onPress={handleEndChat} style={styles.endButton}>
          <Text style={styles.endButtonText}>End</Text>
        </TouchableOpacity>
      </View>

      {/* Message Area with Floating Date */}
      <View style={styles.messageArea}>
        <Animated.View
          style={[styles.dateBadge, { opacity: dateOpacity }]}
          pointerEvents="none"
        >
          <Text style={styles.dateBadgeText}>{scrollDate}</Text>
        </Animated.View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>👋</Text>
              <Text style={styles.emptyText}>
                Say hello to {match?.partner_username || "your match"}!
              </Text>
            </View>
          }
        />
      </View>

      {isTyping && (
        <View style={styles.typingContainer}>
          <Text style={styles.typingText}>
            {match?.partner_username} is typing...
          </Text>
        </View>
      )}

      {/* Input Bar */}
      <View
        style={[
          styles.inputContainer,
          { paddingBottom: Platform.OS === "ios" ? insets.bottom || 12 : 12 },
        ]}
      >
        <TextInput
          style={styles.textInput}
          value={text}
          onChangeText={handleTextChange}
          placeholder="Type a message..."
          placeholderTextColor={Colors.textLight}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            !text.trim() && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!text.trim()}
        >
          <Text style={styles.sendButtonText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  backArrow: {
    fontSize: 34,
    color: Colors.text,
    fontWeight: "300",
    marginTop: -2,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerName: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text,
  },
  headerStatus: {
    fontSize: 12,
    color: Colors.success,
    marginTop: 1,
  },
  endButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,77,106,0.12)",
  },
  endButtonText: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: "600",
  },

  messageArea: {
    flex: 1,
  },
  dateBadge: {
    position: "absolute",
    top: 10,
    alignSelf: "center",
    zIndex: 10,
    backgroundColor: "rgba(30,30,58,0.92)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  dateBadgeText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },

  messageList: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 10,
    gap: 8,
  },
  messageRowSent: {
    justifyContent: "flex-end",
  },
  messageRowReceived: {
    justifyContent: "flex-start",
  },
  avatarSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  avatarSmallText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  avatarSpacer: {
    width: 30,
  },
  partnerAvatarColor: {
    backgroundColor: "#3B82F6",
  },
  messageBubble: {
    maxWidth: "70%",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sentBubble: {
    backgroundColor: Colors.sent,
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    backgroundColor: Colors.received,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  sentText: {
    color: "#fff",
  },
  receivedText: {
    color: Colors.receivedText,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  sentTime: {
    color: "rgba(255,255,255,0.6)",
  },
  receivedTime: {
    color: Colors.textLight,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },

  typingContainer: {
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  typingText: {
    fontSize: 13,
    color: Colors.textLight,
    fontStyle: "italic",
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    backgroundColor: Colors.surfaceLight,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: Colors.textLight,
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
});
