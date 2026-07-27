import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogRow } from "@/src/components/LogRow";
import { MONO, ScreenHeader, useSkinUi } from "@/src/components/ScreenHeader";
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
  const ui = useSkinUi();
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
  // Distribution is weighted by *time in each state*, not the number of logs:
  // each log's state holds until the next log (the newest holds until now), so
  // a side that dominated for two hours counts as two hours even if you only
  // logged it once. `counts` here means milliseconds spent in each state.
  const counts: Record<NostrilState, number> = { left: 0, right: 0, both: 0 };
  if (logs && logs.length > 0) {
    const sorted = [...logs].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    const now = Date.now();
    for (let i = 0; i < sorted.length; i++) {
      const start = new Date(sorted[i].created_at).getTime();
      const end = i + 1 < sorted.length ? new Date(sorted[i + 1].created_at).getTime() : now;
      counts[sorted[i].nostril_state] += Math.max(0, end - start);
    }
    // Just-logged day (all durations ~0): show the latest state as the current one.
    if (counts.left + counts.right + counts.both === 0) {
      counts[sorted[sorted.length - 1].nostril_state] = 1;
    }
  }
  const totalTime = counts.left + counts.right + counts.both;
  const pct = (n: number) => (totalTime > 0 ? Math.round((n / totalTime) * 100) : 0);
  // Advanced logging records a right-nostril % on each log; summarise those
  // separately so the precision you logged with is actually visible.
  const blendLogs = logs?.filter((l) => l.blend != null) ?? [];
  const avgRight = blendLogs.length
    ? Math.round(blendLogs.reduce((sum, l) => sum + (l.blend as number), 0) / blendLogs.length)
    : null;
  const mostRight = blendLogs.length ? Math.max(...blendLogs.map((l) => l.blend as number)) : null;
  const mostLeft = blendLogs.length ? 100 - Math.min(...blendLogs.map((l) => l.blend as number)) : null;

  const avgMood = avg(logs?.map((l) => l.mood_score) ?? []);
  const avgEnergy = avg(logs?.map((l) => l.energy_score) ?? []);
  const avgFocus = avg(logs?.map((l) => l.focus_score) ?? []);

  const tagCounts: Record<string, number> = {};
  logs?.forEach((l) => l.tags.forEach((t) => (tagCounts[t] = (tagCounts[t] ?? 0) + 1)));
  const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <ScreenHeader index="02" title="Today" subtitle="Today’s breath map" topInset={insets.top} />

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
            {ui.instrument ? (
              <View style={[styles.emptyBox, { borderColor: colors.border }]}>
                <Text style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: colors.onSurfaceTertiary }}>
                  — NO SAMPLES —
                </Text>
              </View>
            ) : (
              <Image source={{ uri: EMPTY_IMG }} style={styles.emptyImage} contentFit="cover" />
            )}
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
              style={[styles.card, ui.sq, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
              <View style={styles.summaryTop}>
                <Text style={[styles.summaryCount, ui.mono, { color: colors.onSurface }]}>{total}</Text>
                <Text style={[styles.summaryCountLabel, { color: colors.onSurfaceTertiary }]}>
                  {total === 1 ? "log" : "logs"} today
                </Text>
              </View>
              <View style={[styles.distBar, ui.sq]}>
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
                    <Text style={[styles.legendText, ui.mono, { color: colors.onSurfaceTertiary }]}>
                      {STATE_META[s].label} {pct(counts[s])}%
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={[styles.distCaption, { color: colors.onSurfaceTertiary }]}>
                Share of time in each state — each log holds until the next.
              </Text>

              {avgRight != null && (
                <View style={[styles.blendBox, { borderTopColor: colors.divider }]}>
                  <Text style={[styles.blendTitle, { color: colors.onSurfaceTertiary }]}>
                    BLEND · {blendLogs.length} logged with percentages
                  </Text>
                  <View style={styles.blendRow}>
                    <View style={styles.blendCell}>
                      <Text style={[styles.blendValue, { color: colors.stateLeft }]}>{100 - avgRight}%</Text>
                      <Text style={[styles.blendLabel, { color: colors.onSurfaceTertiary }]}>avg left</Text>
                    </View>
                    <View style={styles.blendCell}>
                      <Text style={[styles.blendValue, { color: colors.stateRight }]}>{avgRight}%</Text>
                      <Text style={[styles.blendLabel, { color: colors.onSurfaceTertiary }]}>avg right</Text>
                    </View>
                    <View style={styles.blendCell}>
                      <Text style={[styles.blendValue, { color: colors.onSurface }]}>
                        {mostLeft}/{mostRight}
                      </Text>
                      <Text style={[styles.blendLabel, { color: colors.onSurfaceTertiary }]}>most L / most R</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.statRow}>
              {[
                { label: "Mood", value: avgMood },
                { label: "Energy", value: avgEnergy },
                { label: "Focus", value: avgFocus },
              ].map((s) => (
                <View
                  key={s.label}
                  style={[styles.statCard, ui.sq, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                >
                  <Text style={[styles.statValue, ui.mono, { color: s.value != null ? colors.onSurface : colors.onSurfaceTertiary }]}>
                    {s.value ?? "—"}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.onSurfaceTertiary }]}>
                    Avg {s.label}
                  </Text>
                </View>
              ))}
            </View>

            {topTag && (
              <View style={[styles.topTagRow, ui.sq, { backgroundColor: colors.surfaceTertiary }]}>
                <Text style={[styles.topTagText, { color: colors.onSurfaceTertiary }]}>
                  Most common tag · {topTag}
                </Text>
              </View>
            )}

            <Text style={[styles.sectionTitle, ui.monoLabel, { color: colors.onSurfaceTertiary }]}>Timeline</Text>
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
  emptyBox: {
    width: 200,
    height: 90,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
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
  distCaption: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, marginTop: spacing.sm },
  blendBox: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1 },
  blendTitle: { fontFamily: fonts.medium, fontSize: 10, letterSpacing: 1 },
  blendRow: { flexDirection: "row", marginTop: spacing.sm },
  blendCell: { flex: 1 },
  blendValue: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.5 },
  blendLabel: { fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },
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
