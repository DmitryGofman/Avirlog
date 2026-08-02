// Shared furniture for the welcome flow: the page shell, the progress dots,
// and the two button styles. Kept in one module-scope file so the pages stay
// declarative and nothing rebuilds a component type mid-flow.
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/src/context/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/theme";

/** One page: an eyebrow, a headline, and whatever body the page supplies. */
export function Page({
  eyebrow,
  title,
  children,
  width,
  centered,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
  width: number;
  centered?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.page, { width }]}>
      <ScrollView
        contentContainerStyle={[styles.pageScroll, centered && styles.pageCentered]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.eyebrow, { color: colors.onSurfaceTertiary }]}>{eyebrow}</Text>
        <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
        {children}
      </ScrollView>
    </View>
  );
}

export function Body({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.body, { color: colors.onSurfaceSecondary }]}>{children}</Text>;
}

export function Small({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.small, { color: colors.onSurfaceTertiary }]}>{children}</Text>;
}

/** A titled card, used for the three states and the benefit list. */
export function InfoCard({
  pip,
  title,
  text,
}: {
  pip?: string;
  title: string;
  text: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
    >
      {pip ? <View style={[styles.pip, { backgroundColor: pip }]} /> : null}
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, { color: colors.onSurface }]}>{title}</Text>
        <Text style={[styles.cardBody, { color: colors.onSurfaceSecondary }]}>{text}</Text>
      </View>
    </View>
  );
}

export function Dots({ count, index }: { count: number; index: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.dots}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === index && styles.dotOn,
            { backgroundColor: i === index ? colors.onSurface : colors.border },
          ]}
        />
      ))}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  testID,
  disabled,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: colors.brandPrimary, opacity: disabled ? 0.5 : pressed ? 0.9 : 1 },
      ]}
    >
      <Text style={[styles.primaryText, { color: colors.onBrandPrimary }]}>{label}</Text>
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.ghost, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={[styles.ghostText, { color: colors.onSurfaceTertiary }]}>{label}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  page: { flex: 1 },
  pageScroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.lg },
  pageCentered: { flexGrow: 1, justifyContent: "center" },
  eyebrow: { fontFamily: fonts.medium, fontSize: 10, letterSpacing: 2, textTransform: "uppercase" },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.5,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, marginBottom: spacing.md },
  small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, marginTop: spacing.sm },
  card: {
    flexDirection: "row",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  pip: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  cardText: { flex: 1 },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 14, marginBottom: 2 },
  cardBody: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17 },
  dots: { flexDirection: "row", gap: 5, justifyContent: "center", marginBottom: spacing.md },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dotOn: { width: 16 },
  primary: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontFamily: fonts.semibold, fontSize: 16 },
  ghost: { height: 40, alignItems: "center", justifyContent: "center", marginTop: spacing.xs },
  ghostText: { fontFamily: fonts.medium, fontSize: 13 },
});
