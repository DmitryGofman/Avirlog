// Static previews of the surfaces the welcome flow describes: the reminder
// notification, the Live Activity card, and the two widget shapes.
//
// These are mock-ups, not the real components — the real ones are a WidgetKit
// extension and an ActivityKit activity, neither of which can render inside the
// app. The strings here are copied from the shipping surfaces on purpose, so
// what a new user is shown is what they will actually see:
//   · title/body          → scheduleNextReminder() in src/lib/notifications.ts
//   · "LOG YOUR BREATH"   → BreathLiveActivity in targets/widget/index.swift
//   · "BREATH", Both bar  → AvirLogWidgetView in the same file
// If those change, change these.
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/src/context/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/theme";

export function NotificationPreview() {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.notif, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
    >
      <View style={styles.notifHead}>
        <View style={styles.notifIcon}>
          <View style={[styles.iconHalf, { backgroundColor: colors.stateLeft }]} />
          <View style={[styles.iconHalf, { backgroundColor: colors.stateRight }]} />
        </View>
        <Text style={[styles.notifApp, { color: colors.onSurfaceTertiary }]}>AVIRLOG</Text>
        <Text style={[styles.notifWhen, { color: colors.onSurfaceTertiary }]}>now</Text>
      </View>
      <Text style={[styles.notifTitle, { color: colors.onSurface }]}>Breath check</Text>
      <Text style={[styles.notifBody, { color: colors.onSurfaceSecondary }]}>
        Which nostril is active? Hold to log · Left / Both / Right
      </Text>
      <View style={styles.actions}>
        <Action label="Left" color={colors.stateLeft} />
        <Action label="Both" color={colors.stateBoth} />
        <Action label="Right" color={colors.stateRight} />
      </View>
    </View>
  );
}

export function LiveActivityPreview() {
  const { colors } = useTheme();
  return (
    <View style={styles.la}>
      <View style={styles.laHead}>
        <Text style={styles.laTitle}>LOG YOUR BREATH</Text>
        <Text style={styles.laTimer}>12:04</Text>
      </View>
      <View style={styles.actions}>
        <Action label="Left" color={colors.stateLeft} />
        <Action label="Both" color={colors.stateBoth} />
        <Action label="Right" color={colors.stateRight} />
      </View>
    </View>
  );
}

// The home-screen tile in its shipped layout: two big side buttons over a slim
// Both bar.
export function WidgetPreview() {
  const { colors } = useTheme();
  return (
    <View style={styles.tiles}>
      <View style={styles.tile}>
        <Text style={styles.tileTitle}>BREATH</Text>
        <View style={styles.tilePair}>
          <View style={[styles.tileBtn, { backgroundColor: colors.stateLeft }]}>
            <Text style={styles.tileBtnText}>Left</Text>
          </View>
          <View style={[styles.tileBtn, { backgroundColor: colors.stateRight }]}>
            <Text style={styles.tileBtnText}>Right</Text>
          </View>
        </View>
        <View style={[styles.tileBoth, { backgroundColor: colors.stateBoth }]}>
          <Text style={styles.tileBothText}>Both</Text>
        </View>
      </View>

      <View style={styles.lock}>
        <Text style={styles.tileTitle}>BREATH</Text>
        <View style={styles.lockRow}>
          <View style={styles.lockBtn}>
            <Text style={styles.lockBtnText}>L</Text>
          </View>
          <View style={[styles.lockBtn, styles.lockBoth]}>
            <Text style={styles.lockBtnText}>B</Text>
          </View>
          <View style={styles.lockBtn}>
            <Text style={styles.lockBtnText}>R</Text>
          </View>
        </View>
        <Text style={styles.lockCaption}>LOCK SCREEN</Text>
      </View>
    </View>
  );
}

function Action({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.action, { backgroundColor: color }]}>
      <Text style={styles.actionText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notif: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  notifHead: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  notifIcon: { width: 16, height: 16, borderRadius: 5, flexDirection: "row", overflow: "hidden" },
  iconHalf: { flex: 1 },
  notifApp: { fontFamily: fonts.medium, fontSize: 9, letterSpacing: 1.2 },
  notifWhen: { fontFamily: fonts.regular, fontSize: 9, marginLeft: "auto" },
  notifTitle: { fontFamily: fonts.semibold, fontSize: 14, marginTop: spacing.xs },
  notifBody: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, marginTop: 1 },

  la: { backgroundColor: "#17171A", borderRadius: radius.lg, padding: spacing.md },
  laHead: { flexDirection: "row", alignItems: "center" },
  laTitle: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: "rgba(255,255,255,0.85)",
  },
  laTimer: { fontFamily: fonts.semibold, fontSize: 14, color: "#FFFFFF", marginLeft: "auto" },

  actions: { flexDirection: "row", gap: 5, marginTop: spacing.sm },
  action: { flex: 1, borderRadius: 9, paddingVertical: 9, alignItems: "center" },
  actionText: { fontFamily: fonts.semibold, fontSize: 12, color: "#FFFFFF" },

  tiles: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  tile: { width: 116, backgroundColor: "#111111", borderRadius: 18, padding: 9, gap: 4 },
  tileTitle: {
    fontFamily: fonts.bold,
    fontSize: 7,
    letterSpacing: 1.6,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
  },
  tilePair: { flexDirection: "row", gap: 4 },
  tileBtn: { flex: 1, borderRadius: 8, paddingVertical: 22, alignItems: "center" },
  tileBtnText: { fontFamily: fonts.bold, fontSize: 10, color: "#FFFFFF" },
  tileBoth: { borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  tileBothText: { fontFamily: fonts.bold, fontSize: 9, color: "#FFFFFF" },

  lock: { flex: 1, backgroundColor: "#1A1A1C", borderRadius: radius.md, padding: 10 },
  lockRow: { flexDirection: "row", gap: 4, marginTop: 6 },
  lockBtn: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.20)",
  },
  lockBoth: { flex: 0, width: 26 },
  lockBtnText: { fontFamily: fonts.bold, fontSize: 11, color: "#FFFFFF" },
  lockCaption: {
    fontFamily: fonts.medium,
    fontSize: 7,
    letterSpacing: 0.6,
    color: "rgba(255,255,255,0.4)",
    marginTop: 6,
  },
});
