import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogForm, LogFormPayload } from "@/src/components/LogForm";
import { LogRow } from "@/src/components/LogRow";
import { Sheet } from "@/src/components/Sheet";
import { useToast } from "@/src/components/Toast";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import { BreathLog, fonts, NostrilState, radius, spacing, STATE_META } from "@/src/theme/theme";

interface DateRow {
  date: string;
  count: number;
  left: number;
  right: number;
  both: number;
}

function formatDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function HistoryScreen() {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [dates, setDates] = useState<DateRow[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayLogs, setDayLogs] = useState<BreathLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [editLog, setEditLog] = useState<BreathLog | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BreathLog | null>(null);
  const [saving, setSaving] = useState(false);

  const loadDates = useCallback(async () => {
    try {
      setError(null);
      const data = await api<DateRow[]>("/logs/dates");
      setDates(data);
    } catch (e: any) {
      setError(e.message ?? "Could not load history");
    }
  }, []);

  const loadDay = useCallback(async (date: string) => {
    setDayLogs(null);
    try {
      const data = await api<BreathLog[]>(`/logs?date=${date}`);
      setDayLogs(data);
    } catch (e: any) {
      setError(e.message ?? "Could not load logs");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDates();
      if (selectedDate) loadDay(selectedDate);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadDates]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedDate) await loadDay(selectedDate);
    else await loadDates();
    setRefreshing(false);
  };

  const openDate = (date: string) => {
    setSelectedDate(date);
    loadDay(date);
  };

  const saveEdit = async (payload: LogFormPayload) => {
    if (!editLog) return;
    setSaving(true);
    try {
      await api(`/logs/${editLog.id}`, { method: "PATCH", body: payload });
      setEditLog(null);
      showToast("Log updated");
      if (selectedDate) await loadDay(selectedDate);
      await loadDates();
    } catch (e: any) {
      showToast(e.message ?? "Could not update log", "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api(`/logs/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      showToast("Log deleted");
      if (selectedDate) await loadDay(selectedDate);
      await loadDates();
    } catch (e: any) {
      showToast(e.message ?? "Could not delete log", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        {selectedDate ? (
          <Pressable
            testID="history-back-button"
            onPress={() => {
              setSelectedDate(null);
              setDayLogs(null);
            }}
            style={styles.backRow}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
            <Text style={[styles.backText, { color: colors.onSurface }]}>All dates</Text>
          </Pressable>
        ) : null}
        <Text style={[styles.title, { color: colors.onSurface }]}>
          {selectedDate ? formatDate(selectedDate) : "History"}
        </Text>
        {!selectedDate && (
          <Text style={[styles.subtitle, { color: colors.onSurfaceTertiary }]}>
            Logs by date
          </Text>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={styles.center}>
            <Text style={[styles.muted, { color: colors.error }]}>{error}</Text>
            <Text
              style={[styles.retry, { color: colors.onSurfaceTertiary }]}
              onPress={() => (selectedDate ? loadDay(selectedDate) : loadDates())}
            >
              Tap to retry
            </Text>
          </View>
        )}

        {!selectedDate && (
          <>
            {dates === null && !error && (
              <View style={styles.center}>
                <ActivityIndicator color={colors.brand} />
              </View>
            )}
            {dates !== null && dates.length === 0 && !error && (
              <View testID="history-empty-state" style={styles.center}>
                <Ionicons name="calendar-clear-outline" size={40} color={colors.onSurfaceTertiary} />
                <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>No history yet</Text>
                <Text style={[styles.muted, { color: colors.onSurfaceTertiary }]}>
                  Your logged days will appear here.
                </Text>
              </View>
            )}
            {dates?.map((d) => {
              const total = d.count;
              return (
                <Pressable
                  key={d.date}
                  testID={`history-date-${d.date}`}
                  onPress={() => openDate(d.date)}
                  style={({ pressed }) => [
                    styles.dateCard,
                    {
                      backgroundColor: colors.surfaceSecondary,
                      borderColor: colors.border,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <View style={styles.dateCardLeft}>
                    <Text style={[styles.dateLabel, { color: colors.onSurface }]}>
                      {formatDate(d.date)}
                    </Text>
                    <Text style={[styles.dateCount, { color: colors.onSurfaceTertiary }]}>
                      {total} {total === 1 ? "log" : "logs"}
                    </Text>
                    <View style={styles.miniBar}>
                      {(["left", "right", "both"] as NostrilState[]).map((s) =>
                        d[s] > 0 ? (
                          <View
                            key={s}
                            style={{ flex: d[s], backgroundColor: colors[STATE_META[s].colorKey] }}
                          />
                        ) : null,
                      )}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
                </Pressable>
              );
            })}
          </>
        )}

        {selectedDate && (
          <>
            {dayLogs === null && !error && (
              <View style={styles.center}>
                <ActivityIndicator color={colors.brand} />
              </View>
            )}
            {dayLogs?.map((log) => (
              <LogRow
                key={log.id}
                log={log}
                onEdit={(l) => setEditLog(l)}
                onDelete={(l) => setDeleteTarget(l)}
              />
            ))}
            {dayLogs !== null && dayLogs.length === 0 && (
              <View style={styles.center}>
                <Text style={[styles.muted, { color: colors.onSurfaceTertiary }]}>
                  No logs on this day.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Sheet visible={!!editLog} onClose={() => setEditLog(null)} title="Edit log">
        {editLog && (
          <LogForm
            key={editLog.id}
            initial={editLog}
            showStatePicker
            saving={saving}
            onSave={saveEdit}
            saveLabel="Save changes"
          />
        )}
      </Sheet>

      <Sheet visible={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete this log?">
        <Text style={[styles.deleteText, { color: colors.onSurfaceTertiary }]}>
          This cannot be undone.
        </Text>
        <Pressable
          testID="confirm-delete-button"
          onPress={confirmDelete}
          disabled={saving}
          style={[styles.deleteBtn, { backgroundColor: colors.error, opacity: saving ? 0.7 : 1 }]}
        >
          {saving ? (
            <ActivityIndicator color={colors.onError} />
          ) : (
            <Text style={[styles.deleteBtnText, { color: colors.onError }]}>Delete log</Text>
          )}
        </Pressable>
        <Pressable
          testID="cancel-delete-button"
          onPress={() => setDeleteTarget(null)}
          style={styles.cancelBtn}
        >
          <Text style={[styles.cancelText, { color: colors.onSurfaceTertiary }]}>Cancel</Text>
        </Pressable>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  backRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  backText: { fontFamily: fonts.medium, fontSize: 14 },
  title: { fontFamily: fonts.semibold, fontSize: 26, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  center: { alignItems: "center", paddingVertical: spacing.xxxl, gap: spacing.sm },
  muted: { fontFamily: fonts.regular, fontSize: 14, textAlign: "center" },
  retry: { fontFamily: fonts.medium, fontSize: 14 },
  emptyTitle: { fontFamily: fonts.semibold, fontSize: 17 },
  dateCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  dateCardLeft: { flex: 1, marginRight: spacing.md },
  dateLabel: { fontFamily: fonts.semibold, fontSize: 15 },
  dateCount: { fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  miniBar: {
    flexDirection: "row",
    height: 6,
    borderRadius: radius.pill,
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  deleteText: { fontFamily: fonts.regular, fontSize: 14, marginBottom: spacing.lg },
  deleteBtn: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: { fontFamily: fonts.semibold, fontSize: 16 },
  cancelBtn: { height: 44, alignItems: "center", justifyContent: "center", marginTop: spacing.xs },
  cancelText: { fontFamily: fonts.medium, fontSize: 14 },
});
