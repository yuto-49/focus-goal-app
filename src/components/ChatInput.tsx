import { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import type { Visibility } from "../lib/types";

type Props = {
  onSend: (content: string, visibility: Visibility) => Promise<void>;
};

export function ChatInput({ onSend }: Props) {
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await onSend(text.trim(), visibility);
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.visibilityToggle}
        onPress={() =>
          setVisibility((v) => (v === "public" ? "private" : "public"))
        }
      >
        <Text style={styles.visibilityText}>
          {visibility === "public" ? "Public" : "Private"}
        </Text>
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Ask your coach..."
        multiline
      />

      <TouchableOpacity
        style={styles.sendButton}
        onPress={handleSend}
        disabled={!text.trim() || sending}
      >
        {sending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.sendText}>Send</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#fff",
  },
  visibilityToggle: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    marginRight: 4,
  },
  visibilityText: {
    fontSize: 11,
    color: "#888",
    fontWeight: "600",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: "#000",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginLeft: 8,
  },
  sendText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
