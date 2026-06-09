import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useAuth } from "../../hooks/useAuth";

export default function ProfileScreen() {
  const { session, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.email}>{session?.user.email}</Text>
      <TouchableOpacity style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  email: { fontSize: 16, marginBottom: 24, color: "#666" },
  button: {
    backgroundColor: "#000",
    borderRadius: 8,
    padding: 16,
    paddingHorizontal: 32,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
