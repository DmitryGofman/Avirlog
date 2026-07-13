// Full-screen living backdrop for the Log screen: gradient sky on the real
// clock, stars at night, sun by day, the moon in its true phase after dark,
// and three flat mountain ranges. Re-renders once a minute; the palette math
// lives in src/lib/sky.ts.
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Path, Polygon, RadialGradient, Stop, Defs } from "react-native-svg";

import {
  celestialAt,
  moonLitPath,
  moonPhaseFraction,
  nowMinutes,
  paletteAt,
  SkyPalette,
} from "@/src/lib/sky";

export function useSkyPalette(): SkyPalette {
  const [minutes, setMinutes] = useState(nowMinutes);
  useEffect(() => {
    const id = setInterval(() => setMinutes(nowMinutes()), 60000);
    return () => clearInterval(id);
  }, []);
  return useMemo(() => paletteAt(minutes), [minutes]);
}

// Star field is generated once and kept stable across re-renders.
function useStars(width: number, height: number) {
  const ref = useRef<{ x: number; y: number; o: number }[] | null>(null);
  if (!ref.current) {
    ref.current = Array.from({ length: 38 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height * 0.6,
      o: 0.25 + Math.random() * 0.7,
    }));
  }
  return ref.current;
}

export function LivingSky() {
  const { width, height } = useWindowDimensions();
  const [minutes, setMinutes] = useState(nowMinutes);
  useEffect(() => {
    const id = setInterval(() => setMinutes(nowMinutes()), 60000);
    return () => clearInterval(id);
  }, []);

  const palette = useMemo(() => paletteAt(minutes), [minutes]);
  const cel = useMemo(() => celestialAt(minutes), [minutes]);
  const stars = useStars(width, height);
  const moonD = useMemo(() => moonLitPath(0, 0, 26, moonPhaseFraction()), []);

  const H = height;
  const W = width;
  // Mountain silhouettes — same shapes as the prototype, scaled to the screen.
  const farPts = `0,${0.55 * H} ${0.12 * W},${0.48 * H} ${0.26 * W},${0.54 * H} ${0.4 * W},${0.44 * H} ${0.55 * W},${0.53 * H} ${0.7 * W},${0.42 * H} ${0.84 * W},${0.52 * H} ${W},${0.46 * H} ${W},${H} 0,${H}`;
  const midPts = `0,${0.66 * H} ${0.16 * W},${0.6 * H} ${0.32 * W},${0.65 * H} ${0.5 * W},${0.58 * H} ${0.66 * W},${0.64 * H} ${0.82 * W},${0.59 * H} ${W},${0.63 * H} ${W},${H} 0,${H}`;
  const nearPts = `0,${0.74 * H} ${0.2 * W},${0.79 * H} ${0.42 * W},${0.72 * H} ${0.6 * W},${0.78 * H} ${0.78 * W},${0.74 * H} ${W},${0.78 * H} ${W},${H} 0,${H}`;

  const sunCy = (cel.sunTopPct / 100) * H + 60;
  const moonCy = (cel.moonTopPct / 100) * H + 40;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[palette.sky1, palette.sky2, palette.sky2]}
        locations={[0, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="sunGrad" cx="42%" cy="38%" r="65%">
            <Stop offset="0" stopColor="#FFF6DC" />
            <Stop offset="1" stopColor="#F7DFA0" />
          </RadialGradient>
        </Defs>

        {/* stars */}
        {stars.map((s, i) => (
          <Circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={1.1}
            fill="#DDE6FF"
            opacity={s.o * palette.starOpacity}
          />
        ))}

        {/* sun with soft halo rings */}
        {cel.sunOpacity > 0 && (
          <>
            <Circle cx={W / 2} cy={sunCy} r={92} fill="#FFF4D2" opacity={0.05 * cel.sunOpacity} />
            <Circle cx={W / 2} cy={sunCy} r={76} fill="#FFF4D2" opacity={0.07 * cel.sunOpacity} />
            <Circle cx={W / 2} cy={sunCy} r={60} fill="url(#sunGrad)" opacity={cel.sunOpacity} />
          </>
        )}

        {/* moon in its true phase */}
        {cel.moonOpacity > 0 && (
          <>
            <Circle
              cx={W * 0.62}
              cy={moonCy}
              r={26}
              fill="#39405C"
              opacity={cel.moonOpacity}
            />
            <Path
              d={moonD}
              x={W * 0.62}
              y={moonCy}
              fill="#F2EEDC"
              opacity={cel.moonOpacity}
            />
          </>
        )}

        {/* mountains */}
        <Polygon points={farPts} fill={palette.far} />
        <Polygon points={midPts} fill={palette.mid} />
        <Polygon points={nearPts} fill={palette.near} />

        {/* lone pine on the near ridge */}
        <Path
          d={`M ${0.86 * W} ${0.755 * H} l 1.5 0 l 0 -34 l -1.5 0 Z`}
          fill={palette.ink}
        />
        <Path
          d={`M ${0.868 * W} ${0.685 * H} l -16 21 l 9 -1.5 l -14 16 l 12 -1.5 l -15 15 l 24 -6.5 l 24 6.5 l -15 -15 l 12 1.5 l -14 -16 l 9 1.5 Z`}
          fill={palette.ink}
        />
      </Svg>
    </View>
  );
}
