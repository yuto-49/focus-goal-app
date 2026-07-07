import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../lib/supabase";
import { FriendRow } from "../components/FriendRow";
import type { Profile, Friendship } from "../lib/types";
import { useAuth } from "../hooks/useAuth";
import type { RootStackParamList } from "../navigation/types";

type FriendsNav = NativeStackNavigationProp<RootStackParamList>;

type FriendWithProfile = {
  friendship: Friendship;
  profile: Profile;
  activeGoalId?: string;
};

export default function FriendsScreen() {
  const { session } = useAuth();
  const navigation = useNavigation<FriendsNav>();
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [searchName, setSearchName] = useState("");

  const userId = session?.user.id;

  const loadFriends = useCallback(async () => {
    if (!userId) return;

    const { data: friendships } = await supabase
      .from("friendships")
      .select("*")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (!friendships || friendships.length === 0) {
      setFriends([]);
      return;
    }

    const friendIds = friendships.map((f) =>
      f.user_id === userId ? f.friend_id : f.user_id
    );

    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", friendIds);

    if (!profiles) return;

    const { data: activeGoals } = await supabase
      .from("goals")
      .select("id, user_id")
      .in("user_id", friendIds)
      .eq("status", "active");

    const activeGoalMap = new Map(
      (activeGoals || []).map((g) => [g.user_id, g.id])
    );

    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    const result: FriendWithProfile[] = friendships
      .map((f) => {
        const friendId = f.user_id === userId ? f.friend_id : f.user_id;
        const profile = profileMap.get(friendId);
        if (!profile) return null;
        return {
          friendship: f as Friendship,
          profile: profile as Profile,
          activeGoalId: activeGoalMap.get(friendId),
        };
      })
      .filter(Boolean) as FriendWithProfile[];

    setFriends(result);
  }, [userId]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  const handleAddFriend = async () => {
    if (!searchName.trim() || !userId) return;

    const { data: foundProfiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .ilike("display_name", searchName.trim());

    if (!foundProfiles || foundProfiles.length === 0) {
      Alert.alert("Not found", "No user found with that name.");
      return;
    }

    const friendId = foundProfiles[0].id;
    if (friendId === userId) {
      Alert.alert("Error", "You can't add yourself.");
      return;
    }

    const { error } = await supabase.from("friendships").insert({
      user_id: userId,
      friend_id: friendId,
    });

    if (error) {
      if (error.code === "23505") {
        Alert.alert("Already sent", "Friend request already exists.");
      } else {
        Alert.alert("Error", error.message);
      }
      return;
    }

    setSearchName("");
    loadFriends();
  };

  const handleAccept = async (friendshipId: string) => {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendshipId);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    loadFriends();
  };

  const handleWatch = async (goalId: string) => {
    if (!userId) return;

    await supabase
      .from("goal_watchers")
      .upsert({ goal_id: goalId, friend_id: userId }, { onConflict: "goal_id,friend_id" });

    navigation.navigate("Watch", { goalId });
  };

  return (
    <View style={styles.container}>
      <View style={styles.addSection}>
        <TextInput
          style={styles.input}
          placeholder="Friend's display name"
          value={searchName}
          onChangeText={setSearchName}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddFriend}>
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={friends}
        keyExtractor={(item) => item.friendship.id}
        renderItem={({ item }) => (
          <FriendRow
            profile={item.profile}
            friendship={item.friendship}
            currentUserId={userId!}
            activeGoalId={item.activeGoalId}
            onAccept={() => handleAccept(item.friendship.id)}
            onWatch={
              item.activeGoalId
                ? () => handleWatch(item.activeGoalId!)
                : undefined
            }
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No friends yet. Add someone above!</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  addSection: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginRight: 8,
  },
  addButton: {
    backgroundColor: "#000",
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  addButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  empty: {
    textAlign: "center",
    color: "#888",
    marginTop: 40,
    fontSize: 15,
  },
});
