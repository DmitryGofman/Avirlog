import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogRow } from "@/src/components/LogRow";
import { useTheme } from "@/src/context/ThemeContext";
import { api, todayStr } from "@/src/lib/api";
import { BreathLog, fonts, NostrilState, radius, spacing, STATE_META } from "@/src/theme/theme";

const EMPTY_IMG =
  "https://images.unsplash.com/photo-1598620617148-c9e8ddee6711?crop=entropy&cs=srgb&fm=jpg&q=85&w=800";

function avg(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export default function TodayScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<BreathLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api<BreathLog[]>(`/logs?date=${todayStr()}`);
      setLogs(data);
    } catch (e: any) {
      setError(e.message ?? "Could not load logs");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const total = logs?.length ?? 0;
  const counts: Record<NostrilState, number> = { left: 0, right: 0, both: 0 };
  logs?.forEach((l) => {
    counts[l.nostril_state] += 1;
  });
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const avgMood = avg(logs?.map((l) => l.mood_score) ?? []);
  const avgEnergy = avg(logs?.map((l) => l.energy_score) ?? []);
  const avgFocus = avg(logs?.map((l) => l.focus_score) ?? []);

  const tagCounts: Record<string, number> = {};
  logs?.forEach((l) => l.tags.forEach((t) => (tagCounts[t] = (tagCounts[t] ?? 0) + 1)));
  const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Today</Text>
        <Text style={[styles.subtitle, { color: colors.onSurfaceTertiary }]}>
          Today’s breath map
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
        showsVerticalScrollIndicator={false}
      >
        {logs === null && !error && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand} />
          </View>
        )}

        {error && (
          <View style={styles.center}>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            <Text style={[styles.retry, { color: colors.onSurfaceTertiary }]} onPress={load}>
              Tap to retry
            </Text>
          </View>
        )}

        {logs !== null && !error && total === 0 && (
          <View testID="today-empty-state" style={styles.center}>
            <Image source={{ uri: EMPTY_IMG }} style={styles.emptyImage} contentFit="cover" />
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>No logs yet today</Text>
            <Text style={[styles.emptyText, { color: colors.onSurfaceTertiary }]}>
              Tap Left, Right, or Both to begin.
            </Text>
          </View>
        )}

        {logs !== null && !error && total > 0 && (
          <>
            <View
              testID="today-summary-card"
              style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
              <View style={styles.summaryTop}>
                <Text style={[styles.summaryCount, { color: colors.onSurface }]}>{total}</Text>
                <Text style={[styles.summaryCountLabel, { color: colors.onSurfaceTertiary }]}>
                  {total === 1 ? "log" : "logs"} today
                </Text>
              </View>
              <View style={styles.distBar}>
                {(Object.keys(STATE_META) as NostrilState[]).map((s) =>
                  counts[s] > 0 ? (
                    <View
                      key={s}
                      style={{
                        flex: counts[s],
                        backgroundColor: colors[STATE_META[s].colorKey],
                      }}
                    />
                  ) : null,
                )}
              </View>
              <View style={styles.legendRow}>
                {(Object.keys(STATE_META) as NostrilState[]).map((s) => (
                  <View key={s} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors[STATE_META[s].colorKey] }]} />
                    <Text style={[styles.legendText, { color: colors.onSurfaceTertiary }]}>
                      {STATE_META[s].label} {pct(counts[s])}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.statRow}>
              {[
                { label: "Mood", value: avgMood },
                { label: "Energy", value: avgEnergy },
                { label: "Focus", value: avgFocus },
              ].map((s) => (
                <View
                  key={s.label}
                  style={[styles.statCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                >
                  <Text style={[styles.statValue, { color: s.value != null ? colors.onSurface : colors.onSurfaceTertiary }]}>
                    {s.value ?? "—"}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.onSurfaceTertiary }]}>
                    Avg {s.label}
                  </Text>
                </View>
              ))}
            </View>

            {topTag && (
              <View style={[styles.topTagRow, { backgroundColor: colors.surfaceTertiary }]}>
                <Text style={[styles.topTagText, { color: colors.onSurfaceTertiary }]}>
                  Most common tag · {topTag}
                </Text>
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: colors.onSurfaceTertiary }]}>Timeline</Text>
            {logs.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  title: { fontFamily: fonts.semibold, fontSize: 28, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  center: { alignItems: "center", paddingVertical: spacing.xxxl },
  errorText: { fontFamily: fonts.medium, fontSize: 14 },
  retry: { fontFamily: fonts.medium, fontSize: 14, marginTop: spacing.sm },
  emptyImage: { width: 160, height: 120, borderRadius: radius.md, marginBottom: spacing.lg },
  emptyTitle: { fontFamily: fonts.semibold, fontSize: 17 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, marginTop: spacing.xs },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  summaryTop: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  summaryCount: { fontFamily: fonts.bold, fontSize: 34, letterSpacing: -1 },
  summaryCountLabel: { fontFamily: fonts.regular, fontSize: 14 },
  distBar: {
    flexDirection: "row",
    height: 10,
    borderRadius: radius.pill,
    overflow: "hidden",
    marginTop: spacing.md,
  },
  legendRow: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: fonts.medium, fontSize: 12 },
  statRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  statCard: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  statValue: { fontFamily: fonts.semibold, fontSize: 20 },
  statLabel: { fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  topTagRow: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignSelf: "flex-start",
    marginBottom: spacing.lg,
  },
  topTagText: { fontFamily: fonts.medium, fontSize: 12 },
  sectionTitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
});
