export const palettes = {
  light: {
    surface: "#F7F7F5",
    onSurface: "#1C1C1C",
    surfaceSecondary: "#FFFFFF",
    onSurfaceSecondary: "#2B2B2B",
    surfaceTertiary: "#EFEFEE",
    onSurfaceTertiary: "#4A4A4A",
    surfaceInverse: "#1C1C1C",
    onSurfaceInverse: "#F7F7F5",
    brand: "#7C8074",
    brandPrimary: "#1C1C1C",
    onBrandPrimary: "#FFFFFF",
    brandSecondary: "#E5E5E5",
    onBrandSecondary: "#1C1C1C",
    brandTertiary: "#EFEFEE",
    onBrandTertiary: "#1C1C1C",
    stateLeft: "#95A599",
    onStateLeft: "#142418",
    stateRight: "#C49382",
    onStateRight: "#36150B",
    stateBoth: "#A3A3A3",
    onStateBoth: "#1C1C1C",
    success: "#8F9E8B",
    onSuccess: "#FFFFFF",
    warning: "#C89E73",
    onWarning: "#FFFFFF",
    error: "#C07B75",
    onError: "#FFFFFF",
    border: "#E5E5E5",
    borderStrong: "#C4C4C4",
    divider: "#EBEBEB",
  },
  dark: {
    surface: "#121212",
    onSurface: "#E6E6E6",
    surfaceSecondary: "#1E1E1E",
    onSurfaceSecondary: "#D4D4D4",
    surfaceTertiary: "#2A2A2A",
    onSurfaceTertiary: "#A3A3A3",
    surfaceInverse: "#E6E6E6",
    onSurfaceInverse: "#121212",
    brand: "#7C8074",
    brandPrimary: "#E6E6E6",
    onBrandPrimary: "#121212",
    brandSecondary: "#2A2A2A",
    onBrandSecondary: "#E6E6E6",
    brandTertiary: "#333333",
    onBrandTertiary: "#E6E6E6",
    stateLeft: "#526658",
    onStateLeft: "#E6F0E8",
    stateRight: "#8A4D3E",
    onStateRight: "#FCE3DD",
    stateBoth: "#5C5C5C",
    onStateBoth: "#E6E6E6",
    success: "#5E705A",
    onSuccess: "#E6E6E6",
    warning: "#8A6642",
    onWarning: "#E6E6E6",
    error: "#874641",
    onError: "#E6E6E6",
    border: "#2A2A2A",
    borderStrong: "#4A4A4A",
    divider: "#242424",
  },
};

export type Palette = typeof palettes.light;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const fonts = {
  regular: "Geist-Regular",
  medium: "Geist-Medium",
  semibold: "Geist-SemiBold",
  bold: "Geist-Bold",
};

export type NostrilState = "left" | "right" | "both";

export const STATE_META: Record<
  NostrilState,
  { label: string; sub: string; colorKey: "stateLeft" | "stateRight" | "stateBoth"; onColorKey: "onStateLeft" | "onStateRight" | "onStateBoth" }
> = {
  left: { label: "Left", sub: "Ida · Calming", colorKey: "stateLeft", onColorKey: "onStateLeft" },
  right: { label: "Right", sub: "Pingala · Active", colorKey: "stateRight", onColorKey: "onStateRight" },
  both: { label: "Both", sub: "Sushumna · Balanced", colorKey: "stateBoth", onColorKey: "onStateBoth" },
};

export const ALL_TAGS = [
  "Yoga",
  "Work",
  "Study",
  "Trading",
  "Social",
  "Exercise",
  "Sleep",
  "Food",
  "Stress",
];

export interface BreathLog {
  id: string;
  user_id: string;
  nostril_state: NostrilState;
  mood_score: number | null;
  energy_score: number | null;
  focus_score: number | null;
  note: string | null;
  tags: string[];
  local_date: string;
  local_hour: number;
  created_at: string;
  updated_at: string;
}
