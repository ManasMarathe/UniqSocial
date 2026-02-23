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
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useChatStore } from "../../store/chatStore";
import { useAuthStore } from "../../store/authStore";
import { useMatchStore } from "../../store/matchStore";
import { Colors } from "../../constants/colors";
import type { ChatMessage } from "../../types";

export default function ChatScreen() {
  const { id: sessionId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
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

  useEffect(() => {
    if (!sessionId || !user?.id) return;

    loadHistory(sessionId);
    connect(sessionId, user.id);

    return () => {
      disconnect();
    };
  }, [sessionId, user?.id]);

  useEffect(() => {
    if (!isConnected && messages.length > 0) {
      router.replace(`/chat-ended/${sessionId}`);
    }
  }, [isConnected]);

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
    Alert.alert("End Chat", "Are you sure you want to end this conversation?", [
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
    ]);
  };

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isMe = item.sender_id === user?.id;
      const time = new Date(item.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      return (
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
      );
    },
    [user?.id]
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen
        options={{
          title: match?.partner_username || "Chat",
          headerStyle: { backgroundColor: Colors.surfaceLight },
          headerTintColor: Colors.text,
          headerRight: () => (
            <TouchableOpacity onPress={handleEndChat} style={styles.endButton}>
              <Text style={styles.endButtonText}>End</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>👋</Text>
            <Text style={styles.emptyText}>
              Say hello to {match?.partner_username || "your match"}!
            </Text>
          </View>
        }
      />

      {isTyping && (
        <View style={styles.typingContainer}>
          <Text style={styles.typingText}>
            {match?.partner_username} is typing...
          </Text>
        </View>
      )}

      <View style={styles.inputContainer}>
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
          style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
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
  messageList: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 6,
  },
  sentBubble: {
    alignSelf: "flex-end",
    backgroundColor: Colors.sent,
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    alignSelf: "flex-start",
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
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
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
  endButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  endButtonText: {
    color: Colors.error,
    fontSize: 15,
    fontWeight: "600",
  },
});
