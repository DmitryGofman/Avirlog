import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/context/ThemeContext";
import { fonts, spacing } from "@/src/theme/theme";

const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "What we collect",
    body: "Nothing is sent to us. AvirLog has no account and no server in this version. Everything you log — your breath states, optional mood/energy/focus, notes, tags, and settings — is stored only on your device.",
  },
  {
    heading: "What we do not collect",
    body: "We do not collect personal information. We do not use analytics, tracking, advertising, or third-party SDKs that collect data. We do not share or sell any data.",
  },
  {
    heading: "Notifications",
    body: "If you enable reminders, AvirLog schedules local notifications on your device. They are generated on-device and are not routed through any server.",
  },
  {
    heading: "Your data and control",
    body: "Because your data lives only on your device, you can export it anytime from Settings → Export data, and deleting the app removes all of it.",
  },
  {
    heading: "Health disclaimer",
    body: "AvirLog offers educational content based on Swara Yoga tradition and general wellness research. It is not medical advice and is not intended to diagnose, treat, or prevent any condition.",
  },
  {
    heading: "Changes",
    body: "If a future version adds optional account sign-in or cloud sync, this policy will be updated to describe it, and such features will be opt-in.",
  },
];

export default function PrivacyScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          testID="privacy-back-button"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/settings"))}
          hitSlop={12}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface }]}>Privacy Policy</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.updated, { color: colors.onSurfaceTertiary }]}>Last updated: June 2026</Text>
        <Text style={[styles.lead, { color: colors.onSurfaceSecondary }]}>
          AvirLog is a breath-awareness journal, designed to be private by default.
        </Text>

        {SECTIONS.map((s) => (
          <View key={s.heading} style={styles.block}>
            <Text style={[styles.heading, { color: colors.onSurface }]}>{s.heading}</Text>
            <Text style={[styles.body, { color: colors.onSurfaceSecondary }]}>{s.body}</Text>
          </View>
        ))}

        <Text style={[styles.contact, { color: colors.onSurfaceTertiary }]}>
          Questions? Contact support@avirlog.app
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.semibold, fontSize: 24, letterSpacing: -0.5 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  updated: { fontFamily: fonts.medium, fontSize: 12, marginBottom: spacing.md },
  lead: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, marginBottom: spacing.lg },
  block: { marginBottom: spacing.lg },
  heading: { fontFamily: fonts.semibold, fontSize: 16, marginBottom: spacing.xs },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 },
  contact: { fontFamily: fonts.regular, fontSize: 13, marginTop: spacing.sm },
});
