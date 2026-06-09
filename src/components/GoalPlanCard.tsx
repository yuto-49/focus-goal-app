import { View, Text, StyleSheet } from "react-native";
import type { GoalPlanStep } from "../lib/types";

type Props = {
  steps: GoalPlanStep[];
};

export function GoalPlanCard({ steps }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Your Plan</Text>
      {steps.map((step) => (
        <View key={step.step} style={styles.stepRow}>
          <Text style={styles.stepNumber}>{step.step}</Text>
          <Text style={styles.stepText}>{step.description}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: "row",
    marginBottom: 10,
    alignItems: "flex-start",
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#000",
    color: "#fff",
    textAlign: "center",
    lineHeight: 24,
    fontSize: 12,
    fontWeight: "bold",
    marginRight: 10,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
