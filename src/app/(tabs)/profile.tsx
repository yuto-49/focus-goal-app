import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import type { Goal } from "../../lib/types";

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!session?.user.id) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", session.user.id)
        .single();

      if (profile) setDisplayName(profile.display_name);

      const { data: goalHistory } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", session.user.id)
        .in("status", ["completed", "abandoned"])
        .order("ended_at", { ascending: false });

      if (goalHistory) setGoals(goalHistory as Goal[]);
    };

    load();
  }, [session?.user.id]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {displayName.charAt(0).toUpperCase() || "?"}
          </Text>
        </View>
        <Text style={styles.name}>{displayName || "Anonymous"}</Text>
        <Text style={styles.email}>{session?.user.email}</Text>
        <Text style={styles.stat}>
          {goals.filter((g) => g.status === "completed").length} goals completed
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Goal History</Text>

      <FlatList
        data={goals}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.goalRow}>
            <View style={styles.goalInfo}>
              <Text style={styles.goalTitle}>{item.title}</Text>
              <Text style={styles.goalDate}>
                {item.ended_at
                  ? new Date(item.ended_at).toLocaleDateString()
                  : ""}
              </Text>
            </View>
            <Text
              style={[
                styles.goalStatus,
                item.status === "completed"
                  ? styles.completed
                  : styles.abandoned,
              ]}
            >
              {item.status}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No completed goals yet.</Text>
        }
      />

      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { alignItems: "center", padding: 24, borderBottomWidth: 1, borderBottomColor: "#eee" },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  name: { fontSize: 20, fontWeight: "600" },
  email: { fontSize: 14, color: "#888", marginTop: 4 },
  stat: { fontSize: 14, color: "#555", marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "600", padding: 16, paddingBottom: 8 },
  goalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  goalInfo: { flex: 1 },
  goalTitle: { fontSize: 15, fontWeight: "500" },
  goalDate: { fontSize: 12, color: "#888", marginTop: 2 },
  goalStatus: { fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  completed: { color: "#22c55e" },
  abandoned: { color: "#ef4444" },
  empty: { textAlign: "center", color: "#888", marginTop: 24, fontSize: 15 },
  signOutButton: {
    margin: 24,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
  },
  signOutText: { fontSize: 15, color: "#888", fontWeight: "500" },
});
