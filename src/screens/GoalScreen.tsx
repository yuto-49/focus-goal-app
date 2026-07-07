import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useGoal } from "../hooks/useGoal";
import { useChat } from "../hooks/useChat";
import { useLocation } from "../hooks/useLocation";
import { usePhotos } from "../hooks/usePhotos";
import { GoalPlanCard } from "../components/GoalPlanCard";
import { ChatBubble } from "../components/ChatBubble";
import { ChatInput } from "../components/ChatInput";
import { LocationIndicator } from "../components/LocationIndicator";
import { PhotoCapture } from "../components/PhotoCapture";
import { PhotoGrid } from "../components/PhotoGrid";
import type { GoalPlanStep } from "../lib/types";

export default function GoalScreen() {
  const [title, setTitle] = useState("");
  const [tips, setTips] = useState("");
  const [showPhotos, setShowPhotos] = useState(false);
  const { activeGoal, loading, createGoal, activateGoal, completeGoal, loadActiveGoal } =
    useGoal();
  const { messages, sendMessage } = useChat(activeGoal?.id);
  const isActive = activeGoal?.status === "active";
  const { hasPermission, currentLocation } = useLocation({
    goalId: activeGoal?.id,
    enabled: isActive,
  });
  const { photos, uploading, pickAndUpload, takeAndUpload } = usePhotos(
    isActive ? activeGoal?.id : undefined
  );

  useEffect(() => {
    loadActiveGoal();
  }, []);

  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      const result = await createGoal(title.trim());
      setTips(result.tips || "");
      setTitle("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      Alert.alert("Error", message);
    }
  };

  const handleActivate = async () => {
    try {
      await activateGoal();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      Alert.alert("Error", message);
    }
  };

  if (!activeGoal) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>What do you want to achieve?</Text>
        <Text style={styles.hint}>
          Describe your goal — be specific about what and where.
        </Text>

        <TextInput
          style={styles.input}
          placeholder='e.g. "Talk to 3 strangers at the coffee shop"'
          value={title}
          onChangeText={setTitle}
          multiline
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleCreate}
          disabled={loading || !title.trim()}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Generate Plan</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  if (activeGoal.status === "planning") {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.heading}>{activeGoal.title}</Text>
        {tips ? <Text style={styles.tips}>{tips}</Text> : null}

        <GoalPlanCard steps={activeGoal.plan as GoalPlanStep[]} />

        <TouchableOpacity style={styles.button} onPress={handleActivate}>
          <Text style={styles.buttonText}>Start Goal</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.chatContainer}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <View style={styles.activeHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.activeTitle}>{activeGoal.title}</Text>
          <LocationIndicator
            hasPermission={hasPermission}
            isTracking={currentLocation !== null}
          />
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setShowPhotos((v) => !v)}>
            <Text style={styles.toggleLink}>
              {showPhotos ? "Chat" : `Photos (${photos.length})`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={completeGoal}>
            <Text style={styles.completeLink}>Complete</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showPhotos ? (
        <ScrollView style={{ flex: 1 }}>
          <PhotoGrid photos={photos} />
        </ScrollView>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatBubble message={item} />}
          contentContainerStyle={{ padding: 16 }}
          style={{ flex: 1 }}
        />
      )}

      <PhotoCapture
        uploading={uploading}
        onPickFromGallery={pickAndUpload}
        onTakePhoto={takeAndUpload}
      />

      <ChatInput onSend={async (content, visibility) => { await sendMessage(content, visibility); }} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#fff" },
  chatContainer: { flex: 1, backgroundColor: "#fff" },
  heading: { fontSize: 24, fontWeight: "bold", marginBottom: 8 },
  hint: { fontSize: 14, color: "#888", marginBottom: 24 },
  tips: {
    fontSize: 14,
    color: "#555",
    fontStyle: "italic",
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#000",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  activeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerLeft: { flex: 1, gap: 4 },
  headerRight: { flexDirection: "row", gap: 16, alignItems: "center" },
  activeTitle: { fontSize: 16, fontWeight: "600" },
  toggleLink: { fontSize: 13, color: "#0077cc", fontWeight: "600" },
  completeLink: { fontSize: 14, color: "#888", fontWeight: "600" },
});
