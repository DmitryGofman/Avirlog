import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
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

  // Instrument tabs are numbered cells in the record-grid language (01 LOG …);
  // other skins keep their icons.
  const tabIcon = (index: string, name: keyof typeof Ionicons.glyphMap) => {
    function TabGlyph({ color, size, focused }: { color: string; size: number; focused: boolean }) {
      return instrument ? (
        <Text
          style={{
            fontFamily: MONO,
            fontSize: 14,
            fontWeight: focused ? "700" : "400",
            letterSpacing: 1,
            color,
          }}
        >
          {index}
        </Text>
      ) : (
        <Ionicons name={name} size={size} color={color} />
      );
    }
    return TabGlyph;
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: instrument ? "#111111" : colors.onSurface,
        tabBarInactiveTintColor: instrument ? "#9A9A94" : colors.onSurfaceTertiary,
        tabBarActiveBackgroundColor: instrument ? colors.surfaceTertiary : undefined,
        tabBarItemStyle: instrument
          ? { borderRightWidth: 1, borderRightColor: colors.divider }
          : undefined,
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
          tabBarIcon: tabIcon("01", "add-circle-outline"),
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: "Today",
          tabBarIcon: tabIcon("02", "time-outline"),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights",
          tabBarIcon: tabIcon("03", "stats-chart-outline"),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: tabIcon("04", "calendar-outline"),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: tabIcon("05", "settings-outline"),
        }}
      />
    </Tabs>
  );
}
