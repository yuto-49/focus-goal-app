import { View, Text, StyleSheet } from "react-native";
import type { Message } from "../lib/types";

type Props = {
  message: Message;
};

export function ChatBubble({ message }: Props) {
  const isUser = message.sender_type === "user";
  const isFriend = message.sender_type === "friend";
  const isPrivate = message.visibility === "private";

  return (
    <View
      style={[
        styles.bubble,
        isUser ? styles.userBubble : isFriend ? styles.friendBubble : styles.llmBubble,
      ]}
    >
      {isFriend && <Text style={styles.friendLabel}>Friend</Text>}
      {isPrivate && <Text style={styles.privateLabel}>Private</Text>}
      <Text
        style={[styles.text, isUser ? styles.userText : styles.otherText]}
      >
        {message.content}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userBubble: {
    backgroundColor: "#000",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  llmBubble: {
    backgroundColor: "#f0f0f0",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  friendBubble: {
    backgroundColor: "#e8f4ff",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  text: { fontSize: 15, lineHeight: 20 },
  userText: { color: "#fff" },
  otherText: { color: "#000" },
  friendLabel: {
    fontSize: 11,
    color: "#0077cc",
    fontWeight: "600",
    marginBottom: 4,
  },
  privateLabel: {
    fontSize: 10,
    color: "#999",
    fontStyle: "italic",
    marginBottom: 4,
  },
});
