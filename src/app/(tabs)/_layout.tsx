import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#000",
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="goal"
        options={{ title: "Goal", tabBarLabel: "Goal" }}
      />
      <Tabs.Screen
        name="friends"
        options={{ title: "Friends", tabBarLabel: "Friends" }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarLabel: "Profile" }}
      />
    </Tabs>
  );
}
