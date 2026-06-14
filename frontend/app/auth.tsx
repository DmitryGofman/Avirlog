import { Redirect, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useAuth } from "@/src/context/AuthContext";

// Deep-link landing route for mobile Google auth redirects.
export default function AuthRedirect() {
  const params = useLocalSearchParams<{ session_id?: string }>();
  const { user, processSessionId } = useAuth();
  const [done, setDone] = useState(false);

  useEffect(() => {
    const sid = params.session_id ? String(params.session_id) : null;
    if (sid && !user) {
      processSessionId(sid)
        .catch(() => {})
        .finally(() => setDone(true));
    } else {
      setDone(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.session_id]);

  if (user) return <Redirect href="/(tabs)/log" />;
  if (done) return <Redirect href="/(tabs)/log" />;

  return (
    <View style={styles.wrap}>
      <ActivityIndicator color="#7C8074" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F7F5" },
});
