import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useAuth } from "@/src/context/AuthContext";
import { hasSeenOnboarding } from "@/src/lib/onboarding";

// Entry gate. The app is usable locally without an account, so everyone lands
// in the tabs; signing in is optional and lives in Settings. We only wait here
// while auth restores a stored session (or processes a Google redirect), and
// while we check whether this install has been through the welcome flow.
export default function Index() {
  const { loading } = useAuth();
  // null = still reading the flag; routing before it resolves would flash the
  // Log screen at a first-time user before bouncing them to onboarding.
  const [seenOnboarding, setSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    hasSeenOnboarding()
      .then(setSeenOnboarding)
      // If storage is unreadable, don't trap anyone in the welcome flow.
      .catch(() => setSeenOnboarding(true));
  }, []);

  if (loading || seenOnboarding === null) {
    return (
      <View style={styles.wrap}>
        <ActivityIndicator color="#7C8074" />
      </View>
    );
  }

  if (!seenOnboarding) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/log" />;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1C1C1C" },
});
