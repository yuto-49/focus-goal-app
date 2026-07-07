import { View, Text, StyleSheet } from "react-native";

type Props = {
  hasPermission: boolean;
  isTracking: boolean;
};

export function LocationIndicator({ hasPermission, isTracking }: Props) {
  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <View style={[styles.dot, styles.dotInactive]} />
        <Text style={styles.textInactive}>Location off</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.dot, isTracking ? styles.dotActive : styles.dotInactive]} />
      <Text style={isTracking ? styles.textActive : styles.textInactive}>
        {isTracking ? "Tracking" : "Waiting..."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: "#22c55e" },
  dotInactive: { backgroundColor: "#ccc" },
  textActive: { fontSize: 12, color: "#22c55e", fontWeight: "600" },
  textInactive: { fontSize: 12, color: "#999" },
});
