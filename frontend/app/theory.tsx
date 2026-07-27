// Theory & evidence — the research behind the app, graded honestly.
//
// Topics are grouped by how strong the evidence actually is, and each carries
// its citations (tappable, opening PubMed / the publisher). The studies that
// argue AGAINST the traditional laterality claim are shown inside the very
// topic that makes it, flagged as counter-evidence — the point of the screen is
// to let you test the idea, not to confirm it.
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/context/ThemeContext";
import { Paper, PAPER_COUNT, THESIS, Tier, TIER_NOTE, TOPICS } from "@/src/lib/research";
import { fonts, radius, spacing } from "@/src/theme/theme";

export default function TheoryScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Evidence tiers get their own colours: strong reads as the calm green,
  // weaker tiers step back toward neutral so the hierarchy is visible at a glance.
  const tierColor = (tier: Tier): string =>
    tier === "Established"
      ? colors.stateLeft
      : tier === "Emerging"
        ? colors.stateRight
        : tier === "Preliminary"
          ? colors.onSurfaceTertiary
          : colors.stateBoth;

  const openPaper = (p: Paper) => {
    if (p.url) Linking.openURL(p.url).catch(() => {});
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          testID="theory-back-button"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/log"))}
          hitSlop={12}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface }]}>Theory &amp; evidence</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* the honest thesis, up front */}
        <View style={[styles.thesis, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Text style={[styles.thesisText, { color: colors.onSurfaceSecondary }]}>{THESIS}</Text>
        </View>

        <Text style={[styles.lead, { color: colors.onSurfaceTertiary }]}>
          {PAPER_COUNT} sources, each checked against PubMed or the publisher. Tap any
          study to open it.
        </Text>

        {/* what the grades mean */}
        <Text style={[styles.sectionTitle, { color: colors.onSurfaceTertiary }]}>How to read the grades</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          {(Object.keys(TIER_NOTE) as Tier[]).map((tier) => (
            <View key={tier} style={styles.legendRow}>
              <View style={[styles.badge, { backgroundColor: tierColor(tier) }]}>
                <Text style={styles.badgeText}>{tier}</Text>
              </View>
              <Text style={[styles.legendText, { color: colors.onSurfaceSecondary }]}>{TIER_NOTE[tier]}</Text>
            </View>
          ))}
        </View>

        {TOPICS.map((topic) => (
          <View
            key={topic.key}
            style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          >
            <View style={[styles.badge, styles.badgeStandalone, { backgroundColor: tierColor(topic.tier) }]}>
              <Text style={styles.badgeText}>{topic.tier}</Text>
            </View>
            <Text style={[styles.topicTitle, { color: colors.onSurface }]}>{topic.title}</Text>
            <Text style={[styles.body, { color: colors.onSurfaceSecondary }]}>{topic.summary}</Text>

            {topic.caveat ? (
              <View style={[styles.caveat, { borderLeftColor: tierColor(topic.tier), backgroundColor: colors.surfaceTertiary }]}>
                <Text style={[styles.caveatText, { color: colors.onSurfaceSecondary }]}>{topic.caveat}</Text>
              </View>
            ) : null}

            <View style={[styles.papers, { borderTopColor: colors.divider }]}>
              {topic.papers.map((p) => (
                <Pressable
                  key={p.title}
                  testID={`theory-paper-${p.title.slice(0, 24)}`}
                  onPress={() => openPaper(p)}
                  disabled={!p.url}
                  style={({ pressed }) => [styles.paper, { opacity: pressed && p.url ? 0.6 : 1 }]}
                >
                  <View style={styles.paperHead}>
                    <Text style={[styles.paperCite, { color: colors.onSurface }]}>
                      {p.authors}
                      {p.year ? ` (${p.year})` : ""}
                    </Text>
                    {p.url ? (
                      <Ionicons name="open-outline" size={13} color={colors.onSurfaceTertiary} />
                    ) : null}
                  </View>
                  <Text style={[styles.paperTitle, { color: colors.onSurfaceSecondary }]}>{p.title}</Text>
                  <Text style={[styles.paperJournal, { color: colors.onSurfaceTertiary }]}>
                    {p.journal}
                    {p.id ? ` · ${p.id}` : ""}
                  </Text>
                  <Text style={[styles.paperFinding, { color: colors.onSurfaceSecondary }]}>{p.finding}</Text>
                  {p.skeptic ? (
                    <Text style={[styles.skeptic, { color: colors.stateRight }]}>
                      Counter-evidence to the side-based claim
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Text style={[styles.disclaimer, { color: colors.onSurfaceTertiary }]}>
          Educational only — not medical advice. Nothing here is a treatment for any
          condition, and breathing practices are not a substitute for care from a
          clinician.
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
  thesis: { borderRadius: radius.md, borderWidth: 1, padding: spacing.lg },
  thesisText: { fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 22, fontStyle: "italic" },
  lead: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  card: { borderRadius: radius.md, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.md },
  legendRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  legendText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, flex: 1 },
  badge: { borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  badgeStandalone: { marginBottom: spacing.sm },
  badgeText: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#12140F",
  },
  topicTitle: { fontFamily: fonts.semibold, fontSize: 18, letterSpacing: -0.3 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, marginTop: spacing.sm },
  caveat: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderRadius: radius.sm,
  },
  caveatText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20 },
  papers: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, gap: spacing.md },
  paper: { gap: 2 },
  paperHead: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  paperCite: { fontFamily: fonts.semibold, fontSize: 13.5 },
  paperTitle: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19 },
  paperJournal: { fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 17 },
  paperFinding: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, marginTop: 3 },
  skeptic: { fontFamily: fonts.medium, fontSize: 11.5, marginTop: 3 },
  disclaimer: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.sm,
    textAlign: "center",
  },
});
