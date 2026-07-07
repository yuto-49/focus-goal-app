import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { LiveMap } from "../components/LiveMap";
import { ChatBubble } from "../components/ChatBubble";
import { PhotoGrid } from "../components/PhotoGrid";
import type { Goal, Message, LocationPing, GoalPhoto } from "../lib/types";
import type { RootStackParamList } from "../navigation/types";

type WatchRoute = RouteProp<RootStackParamList, "Watch">;
type Tab = "chat" | "photos";

export default function WatchScreen() {
  const route = useRoute<WatchRoute>();
  const navigation = useNavigation();
  const { goalId } = route.params;
  const [goal, setGoal] = useState<Goal | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pings, setPings] = useState<LocationPing[]>([]);
  const [photos, setPhotos] = useState<GoalPhoto[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  useEffect(() => {
    if (!goalId) return;
    const load = async () => {
      const { data } = await supabase
        .from("goals")
        .select("*")
        .eq("id", goalId)
        .single();
      if (data) setGoal(data as Goal);
    };
    load();
  }, [goalId]);

  useEffect(() => {
    if (!goalId) return;
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("goal_id", goalId)
        .order("created_at", { ascending: true });
      if (data) setMessages(data as Message[]);
    };
    load();

    const channel = supabase
      .channel(`watch:${goalId}:messages`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `goal_id=eq.${goalId}` },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.visibility === "public") {
            setMessages((prev) => [...prev, msg]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [goalId]);

  useEffect(() => {
    if (!goalId) return;
    const load = async () => {
      const { data } = await supabase
        .from("location_pings")
        .select("*")
        .eq("goal_id", goalId)
        .order("created_at", { ascending: true });
      if (data) setPings(data as LocationPing[]);
    };
    load();

    const channel = supabase
      .channel(`watch:${goalId}:location`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "location_pings", filter: `goal_id=eq.${goalId}` },
        (payload) => { setPings((prev) => [...prev, payload.new as LocationPing]); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [goalId]);

  useEffect(() => {
    if (!goalId) return;
    const load = async () => {
      const { data } = await supabase
        .from("goal_photos")
        .select("*")
        .eq("goal_id", goalId)
        .order("created_at", { ascending: true });
      if (data) setPhotos(data as GoalPhoto[]);
    };
    load();

    const channel = supabase
      .channel(`watch:${goalId}:photos`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "goal_photos", filter: `goal_id=eq.${goalId}` },
        (payload) => { setPhotos((prev) => [...prev, payload.new as GoalPhoto]); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [goalId]);

  if (!goal) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (goal.status === "completed" || goal.status === "abandoned") {
    return (
      <View style={styles.center}>
        <Text style={styles.heading}>{goal.title}</Text>
        <Text style={styles.statusText}>Goal {goal.status}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LiveMap pings={pings} height={200} />

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "chat" && styles.tabActive]}
          onPress={() => setActiveTab("chat")}
        >
          <Text style={[styles.tabText, activeTab === "chat" && styles.tabTextActive]}>
            Chat ({messages.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "photos" && styles.tabActive]}
          onPress={() => setActiveTab("photos")}
        >
          <Text style={[styles.tabText, activeTab === "photos" && styles.tabTextActive]}>
            Photos ({photos.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "chat" ? (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatBubble message={item} />}
          contentContainerStyle={{ padding: 16 }}
          style={{ flex: 1 }}
        />
      ) : (
        <FlatList
          data={[{ key: "grid" }]}
          keyExtractor={(item) => item.key}
          renderItem={() => <PhotoGrid photos={photos} />}
          style={{ flex: 1 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  heading: { fontSize: 18, fontWeight: "600" },
  loadingText: { fontSize: 16, color: "#888" },
  statusText: { fontSize: 16, color: "#888", marginTop: 8, textTransform: "capitalize" },
  backButton: { backgroundColor: "#000", borderRadius: 8, padding: 14, paddingHorizontal: 24, marginTop: 24 },
  backButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eee" },
  tab: { flex: 1, padding: 12, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#000" },
  tabText: { fontSize: 14, color: "#888" },
  tabTextActive: { color: "#000", fontWeight: "600" },
});
