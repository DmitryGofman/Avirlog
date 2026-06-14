import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useAuth } from "@/src/context/AuthContext";

// Entry gate. The app is usable locally without an account, so everyone lands
// in the tabs; signing in is optional and lives in Settings. We only wait here
// while auth restores a stored session (or processes a Google redirect).
export default function Index() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.wrap}>
        <ActivityIndicator color="#7C8074" />
      </View>
    );
  }

  return <Redirect href="/(tabs)/log" />;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1C1C1C" },
});
