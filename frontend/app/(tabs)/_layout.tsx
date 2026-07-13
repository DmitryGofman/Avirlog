import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { fonts } from "@/src/theme/theme";

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

export default function TabsLayout() {
  const { loading } = useAuth();
  const { colors, skin } = useTheme();
  const insets = useSafeAreaInsets();
  const instrument = skin === "instrument";

  // No login gate: guests use the app locally (data stored on-device).
  // Signing in to sync is offered from Settings.
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.onSurface,
        tabBarInactiveTintColor: colors.onSurfaceTertiary,
        tabBarStyle: {
          backgroundColor: instrument ? colors.surface : colors.surfaceSecondary,
          borderTopColor: instrument ? colors.border : colors.divider,
          borderTopWidth: 1,
          // Web fallback fonts render taller than Geist — give the labels
          // extra room there so they don't clip against the bar's bottom.
          height: (Platform.OS === "web" ? 64 : 56) + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : Platform.OS === "web" ? 10 : 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: instrument
          ? { fontFamily: MONO, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase" as const }
          : { fontFamily: fonts.medium, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen
        name="log"
        options={{
          title: "Log",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: "Today",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
