import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { Profile, Friendship } from "../lib/types";

type Props = {
  profile: Profile;
  friendship: Friendship;
  currentUserId: string;
  onAccept?: () => void;
};

export function FriendRow({ profile, friendship, currentUserId, onAccept }: Props) {
  const isPending = friendship.status === "pending";
  const canAccept = isPending && friendship.friend_id === currentUserId;

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {profile.display_name.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>{profile.display_name}</Text>
        {isPending && (
          <Text style={styles.pending}>
            {canAccept ? "Wants to be your friend" : "Request sent"}
          </Text>
        )}
      </View>

      {canAccept && onAccept && (
        <TouchableOpacity style={styles.acceptButton} onPress={onAccept}>
          <Text style={styles.acceptText}>Accept</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: "500" },
  pending: { fontSize: 12, color: "#888", marginTop: 2 },
  acceptButton: {
    backgroundColor: "#000",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  acceptText: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
