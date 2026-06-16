import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/context/ThemeContext";
import { SWARA } from "@/src/lib/swara";
import { fonts, NostrilState, radius, spacing, STATE_META } from "@/src/theme/theme";

const ORDER: NostrilState[] = ["left", "right", "both"];

const BENEFITS = [
  "The nose warms, humidifies and filters air, and releases nitric oxide — boosting oxygen uptake by roughly 18% over mouth-breathing.",
  "Nasal breathing is linked to lower blood pressure and higher heart-rate variability (James Nestor, “Breath”).",
  "Healthy adults naturally alternate nostril dominance on an ultradian rhythm — typically 1–4 hours per side — regulated by the autonomic nervous system.",
];

export default function LearnScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          testID="learn-back-button"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/log"))}
          hitSlop={12}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface }]}>Swara Yoga</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.lead, { color: colors.onSurfaceSecondary }]}>
          Your breath alternates which nostril leads, in a slow daily rhythm. Each state reflects a
          different nervous-system tone — and suits different kinds of activity.
        </Text>

        {ORDER.map((state) => {
          const meta = STATE_META[state];
          const info = SWARA[state];
          return (
            <View
              key={state}
              style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
              <View style={styles.cardHead}>
                <View style={[styles.dot, { backgroundColor: colors[meta.colorKey] }]} />
                <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
                  {meta.label} · {info.sanskrit}
                </Text>
              </View>
              <Text style={[styles.essence, { color: colors.onSurfaceTertiary }]}>{info.essence}</Text>
              <Text style={[styles.body, { color: colors.onSurfaceSecondary }]}>{info.description}</Text>

              <View style={[styles.activities, { borderTopColor: colors.divider }]}>
                {info.activities.map((a) => (
                  <View key={a.label} style={styles.activityRow}>
                    <Text style={[styles.activityLabel, { color: colors.onSurfaceTertiary }]}>{a.label}</Text>
                    <Text style={[styles.activityText, { color: colors.onSurfaceSecondary }]}>{a.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        <Text style={[styles.sectionTitle, { color: colors.onSurfaceTertiary }]}>Why nasal breathing</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          {BENEFITS.map((b, i) => (
            <View key={i} style={styles.benefitRow}>
              <View style={[styles.bullet, { backgroundColor: colors.brand }]} />
              <Text style={[styles.body, { color: colors.onSurfaceSecondary, flex: 1 }]}>{b}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.disclaimer, { color: colors.onSurfaceTertiary }]}>
          Grounded in Swara Yoga tradition (Shiva Swarodaya) and modern studies of the nasal cycle.
          Educational only — not medical advice.
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
  lead: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, marginBottom: spacing.lg },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 18, letterSpacing: -0.3 },
  essence: {
    fontFamily: fonts.medium,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: spacing.xs,
  },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, marginTop: spacing.sm },
  activities: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, gap: spacing.sm },
  activityRow: { flexDirection: "row", gap: spacing.md },
  activityLabel: { fontFamily: fonts.semibold, fontSize: 13, width: 72 },
  activityText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, flex: 1 },
  sectionTitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  benefitRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.sm },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  disclaimer: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md,
    textAlign: "center",
  },
});
