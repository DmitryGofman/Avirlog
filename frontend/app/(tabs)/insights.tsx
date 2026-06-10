import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/context/ThemeContext";
import { api, daysAgoStr, todayStr } from "@/src/lib/api";
import { BreathLog, fonts, NostrilState, radius, spacing, STATE_META } from "@/src/theme/theme";

const EMPTY_IMG =
  "https://images.unsplash.com/photo-1761156254622-7b66649b1f69?crop=entropy&cs=srgb&fm=jpg&q=85&w=800";

const STATE_KEYS = Object.keys(STATE_META) as NostrilState[];

function avgOf(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function timeBucket(hour: number): string {
  if (hour >= 5 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 17) return "Afternoon";
  if (hour >= 17 && hour < 21) return "Evening";
  return "Night";
}

export default function InsightsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<BreathLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api<BreathLog[]>(`/logs?start=${daysAgoStr(29)}&end=${todayStr()}`);
      setLogs(data);
    } catch (e: any) {
      setError(e.message ?? "Could not load insights");
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

  // ----- derived data -----
  const last7 = Array.from({ length: 7 }, (_, i) => daysAgoStr(6 - i));
  const byDate: Record<string, BreathLog[]> = {};
  logs?.forEach((l) => {
    (byDate[l.local_date] = byDate[l.local_date] ?? []).push(l);
  });

  const dayBars = last7.map((d) => {
    const dayLogs = byDate[d] ?? [];
    const counts: Record<NostrilState, number> = { left: 0, right: 0, both: 0 };
    dayLogs.forEach((l) => (counts[l.nostril_state] += 1));
    return { date: d, counts, total: dayLogs.length };
  });
  const maxDayTotal = Math.max(1, ...dayBars.map((b) => b.total));

  const metricBars = (key: "mood_score" | "energy_score" | "focus_score") =>
    last7.map((d) => {
      const vals = (byDate[d] ?? []).map((l) => l[key]).filter((v): v is number => v != null);
      return { date: d, avg: avgOf(vals) };
    });

  const buckets = ["Morning", "Afternoon", "Evening", "Night"];
  const bucketCounts: Record<string, number> = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
  logs?.forEach((l) => (bucketCounts[timeBucket(l.local_hour)] += 1));
  const maxBucket = Math.max(1, ...buckets.map((b) => bucketCounts[b]));

  // ----- correlation cards -----
  const totalLogs = logs?.length ?? 0;
  const distinctDays = Object.keys(byDate).length;
  const enoughData = totalLogs >= 10 && distinctDays >= 3;

  const correlations: string[] = [];
  if (logs && enoughData) {
    const overallCounts: Record<NostrilState, number> = { left: 0, right: 0, both: 0 };
    logs.forEach((l) => (overallCounts[l.nostril_state] += 1));

    const tagLogs: Record<string, BreathLog[]> = {};
    logs.forEach((l) => l.tags.forEach((t) => (tagLogs[t] = tagLogs[t] ?? []).push(l)));

    Object.entries(tagLogs).forEach(([tag, tlogs]) => {
      if (tlogs.length < 3) return;
      const tc: Record<NostrilState, number> = { left: 0, right: 0, both: 0 };
      tlogs.forEach((l) => (tc[l.nostril_state] += 1));
      STATE_KEYS.forEach((s) => {
        const tagShare = tc[s] / tlogs.length;
        const overallShare = overallCounts[s] / totalLogs;
        if (tagShare >= overallShare + 0.15 && tc[s] >= 2) {
          correlations.push(
            `${STATE_META[s].label} nostril appears more often during ${tag} logs.`,
          );
        }
      });
    });

    (["focus_score", "mood_score", "energy_score"] as const).forEach((metric) => {
      const label = metric === "focus_score" ? "focus" : metric === "mood_score" ? "mood" : "energy";
      const byState = STATE_KEYS.map((s) => {
        const vals = logs
          .filter((l) => l.nostril_state === s)
          .map((l) => l[metric])
          .filter((v): v is number => v != null);
        return { state: s, avg: avgOf(vals), n: vals.length };
      }).filter((x) => x.avg != null && x.n >= 3);
      if (byState.length >= 2) {
        const best = byState.sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))[0];
        correlations.push(
          `Average ${label} is highest when state is ${STATE_META[best.state].label} (${best.avg}).`,
        );
      }
    });
  }
  const shownCorrelations = correlations.slice(0, 5);

  const dayInitial = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday: "narrow" });

  const renderMetricChart = (title: string, key: "mood_score" | "energy_score" | "focus_score") => {
    const bars = metricBars(key);
    const hasAny = bars.some((b) => b.avg != null);
    return (
      <View
        key={key}
        style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
      >
        <Text style={[styles.cardTitle, { color: colors.onSurface }]}>{title}</Text>
        {hasAny ? (
          <View style={styles.chartRow}>
            {bars.map((b) => (
              <View key={b.date} style={styles.chartCol}>
                <View style={styles.chartColBarArea}>
                  <View
                    style={[
                      styles.metricBar,
                      {
                        height: b.avg != null ? Math.max(4, (b.avg / 10) * 72) : 2,
                        backgroundColor: b.avg != null ? colors.brand : colors.border,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.chartDayLabel, { color: colors.onSurfaceTertiary }]}>
                  {dayInitial(b.date)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.muted, { color: colors.onSurfaceTertiary }]}>
            No scores recorded yet. Add context to your logs.
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Insights</Text>
        <Text style={[styles.subtitle, { color: colors.onSurfaceTertiary }]}>Last 7 days</Text>
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
            <Text style={[styles.muted, { color: colors.error }]}>{error}</Text>
            <Text style={[styles.retry, { color: colors.onSurfaceTertiary }]} onPress={load}>
              Tap to retry
            </Text>
          </View>
        )}

        {logs !== null && !error && totalLogs === 0 && (
          <View testID="insights-empty-state" style={styles.center}>
            <Image source={{ uri: EMPTY_IMG }} style={styles.emptyImage} contentFit="cover" />
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Keep tracking</Text>
            <Text style={[styles.muted, { color: colors.onSurfaceTertiary }]}>
              Pattern will appear after more logs.
            </Text>
          </View>
        )}

        {logs !== null && !error && totalLogs > 0 && (
          <>
            <View
              testID="insights-dominance-chart"
              style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
              <Text style={[styles.cardTitle, { color: colors.onSurface }]}>Nostril dominance</Text>
              <View style={styles.chartRow}>
                {dayBars.map((b) => (
                  <View key={b.date} style={styles.chartCol}>
                    <View style={styles.chartColBarArea}>
                      <View style={styles.stackedBar}>
                        {STATE_KEYS.map((s) =>
                          b.counts[s] > 0 ? (
                            <View
                              key={s}
                              style={{
                                height: (b.counts[s] / maxDayTotal) * 72,
                                backgroundColor: colors[STATE_META[s].colorKey],
                                width: "100%",
                              }}
                            />
                          ) : null,
                        )}
                      </View>
                    </View>
                    <Text style={[styles.chartDayLabel, { color: colors.onSurfaceTertiary }]}>
                      {dayInitial(b.date)}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.legendRow}>
                {STATE_KEYS.map((s) => (
                  <View key={s} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors[STATE_META[s].colorKey] }]} />
                    <Text style={[styles.legendText, { color: colors.onSurfaceTertiary }]}>
                      {STATE_META[s].label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {renderMetricChart("Mood over time", "mood_score")}
            {renderMetricChart("Energy over time", "energy_score")}
            {renderMetricChart("Focus over time", "focus_score")}

            <View
              testID="insights-timeofday-card"
              style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
              <Text style={[styles.cardTitle, { color: colors.onSurface }]}>Time of day</Text>
              {buckets.map((b) => (
                <View key={b} style={styles.bucketRow}>
                  <Text style={[styles.bucketLabel, { color: colors.onSurfaceTertiary }]}>{b}</Text>
                  <View style={[styles.bucketTrack, { backgroundColor: colors.surfaceTertiary }]}>
                    <View
                      style={[
                        styles.bucketFill,
                        {
                          width: `${(bucketCounts[b] / maxBucket) * 100}%`,
                          backgroundColor: colors.brand,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.bucketCount, { color: colors.onSurfaceSecondary }]}>
                    {bucketCounts[b]}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { color: colors.onSurfaceTertiary }]}>Patterns</Text>
            {enoughData && shownCorrelations.length > 0 ? (
              shownCorrelations.map((c, i) => (
                <View
                  key={i}
                  testID={`insights-pattern-card-${i}`}
                  style={[styles.patternCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                >
                  <View style={[styles.patternDot, { backgroundColor: colors.brand }]} />
                  <Text style={[styles.patternText, { color: colors.onSurfaceSecondary }]}>{c}</Text>
                </View>
              ))
            ) : (
              <View
                testID="insights-patterns-locked"
                style={[styles.patternCard, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}
              >
                <Text style={[styles.patternText, { color: colors.onSurfaceTertiary }]}>
                  Log for a few more days to unlock useful patterns.
                </Text>
              </View>
            )}
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
  emptyImage: { width: 160, height: 120, borderRadius: radius.md, marginBottom: spacing.lg },
  emptyTitle: { fontFamily: fonts.semibold, fontSize: 17, marginBottom: spacing.xs },
  muted: { fontFamily: fonts.regular, fontSize: 14, textAlign: "center" },
  retry: { fontFamily: fonts.medium, fontSize: 14, marginTop: spacing.sm },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 15, marginBottom: spacing.md },
  chartRow: { flexDirection: "row", gap: spacing.sm },
  chartCol: { flex: 1, alignItems: "center" },
  chartColBarArea: { height: 76, justifyContent: "flex-end", width: "100%", alignItems: "center" },
  stackedBar: {
    width: 18,
    borderRadius: 4,
    overflow: "hidden",
    flexDirection: "column-reverse",
  },
  metricBar: { width: 18, borderRadius: 4 },
  chartDayLabel: { fontFamily: fonts.medium, fontSize: 11, marginTop: spacing.xs },
  legendRow: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: fonts.medium, fontSize: 12 },
  bucketRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  bucketLabel: { fontFamily: fonts.medium, fontSize: 13, width: 78 },
  bucketTrack: { flex: 1, height: 8, borderRadius: radius.pill, overflow: "hidden" },
  bucketFill: { height: 8, borderRadius: radius.pill },
  bucketCount: { fontFamily: fonts.semibold, fontSize: 13, width: 24, textAlign: "right" },
  sectionTitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  patternCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  patternDot: { width: 8, height: 8, borderRadius: 4 },
  patternText: { fontFamily: fonts.regular, fontSize: 14, flex: 1, lineHeight: 20 },
});
