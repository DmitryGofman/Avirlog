import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/src/context/ThemeContext";
import { BreathLog, fonts, radius, spacing, STATE_META } from "@/src/theme/theme";

interface LogRowProps {
  log: BreathLog;
  onEdit?: (log: BreathLog) => void;
  onDelete?: (log: BreathLog) => void;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${m} ${ampm}`;
}

export function LogRow({ log, onEdit, onDelete }: LogRowProps) {
  const { colors } = useTheme();
  const meta = STATE_META[log.nostril_state];
  const scores: string[] = [];
  if (log.mood_score != null) scores.push(`Mood ${log.mood_score}`);
  if (log.energy_score != null) scores.push(`Energy ${log.energy_score}`);
  if (log.focus_score != null) scores.push(`Focus ${log.focus_score}`);

  return (
    <View
      testID={`log-row-${log.id}`}
      style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
    >
      <View style={[styles.stateDot, { backgroundColor: colors[meta.colorKey] }]} />
      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text style={[styles.stateLabel, { color: colors.onSurface }]}>{meta.label}</Text>
          <Text style={[styles.time, { color: colors.onSurfaceTertiary }]}>{formatTime(log.created_at)}</Text>
        </View>
        {scores.length > 0 && (
          <Text style={[styles.scores, { color: colors.onSurfaceTertiary }]}>{scores.join(" · ")}</Text>
        )}
        {log.tags.length > 0 && (
          <View style={styles.tagsWrap}>
            {log.tags.map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: colors.surfaceTertiary }]}>
                <Text style={[styles.tagText, { color: colors.onSurfaceTertiary }]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
        {log.note ? (
          <Text style={[styles.note, { color: colors.onSurfaceSecondary }]} numberOfLines={3}>
            {log.note}
          </Text>
        ) : null}
        {(onEdit || onDelete) && (
          <View style={styles.actions}>
            {onEdit && (
              <Pressable
                testID={`log-edit-button-${log.id}`}
                onPress={() => onEdit(log)}
                hitSlop={8}
                style={[styles.actionBtn, { backgroundColor: colors.surfaceTertiary }]}
              >
                <Ionicons name="pencil-outline" size={15} color={colors.onSurfaceTertiary} />
                <Text style={[styles.actionText, { color: colors.onSurfaceTertiary }]}>Edit</Text>
              </Pressable>
            )}
            {onDelete && (
              <Pressable
                testID={`log-delete-button-${log.id}`}
                onPress={() => onDelete(log)}
                hitSlop={8}
                style={[styles.actionBtn, { backgroundColor: colors.surfaceTertiary }]}
              >
                <Ionicons name="trash-outline" size={15} color={colors.error} />
                <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  stateDot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    marginTop: 5,
  },
  body: { flex: 1 },
  topLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stateLabel: { fontFamily: fonts.semibold, fontSize: 16 },
  time: { fontFamily: fonts.regular, fontSize: 13 },
  scores: { fontFamily: fonts.regular, fontSize: 13, marginTop: spacing.xs },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  tagText: { fontFamily: fonts.medium, fontSize: 11 },
  note: { fontFamily: fonts.regular, fontSize: 14, marginTop: spacing.sm, lineHeight: 20 },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.md,
    height: 32,
    borderRadius: radius.pill,
  },
  actionText: { fontFamily: fonts.medium, fontSize: 12 },
});
