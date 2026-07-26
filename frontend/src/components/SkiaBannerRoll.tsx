// GPU-shaded banner roll (Skia). This is the piece the plain React Native view
// layer could never do: instead of faking the roll with a rounded rectangle and
// a linear gradient, an SkSL fragment shader treats the rolled cloth as a real
// cylinder and shades it per pixel.
//
// For each pixel it converts the screen y into an angle around the cylinder,
// turns that angle into an arc length along the cloth, and uses the arc length
// to decide (a) whether there is still cloth there at all and (b) how wide the
// cloth is at that point — so the roll narrows into the banner's pointed hem on
// its own. Lighting, the specular crown and the wound seams all fall out of the
// angle, which is why it reads as round rather than as a bar.
//
// Only the *rolled* part is drawn here; the flat, printed part of the banner is
// still the real SVG art. The roll shows the cloth's plain back (no print), so
// it needs no texture at all — the silhouette is computed from the known hem
// geometry instead.
import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import React, { useMemo } from "react";

const SKSL = `
uniform float2 size;      // canvas size in px
uniform float  flatH;     // height of the flat (already unrolled) part
uniform float  radius;    // radius of the roll
uniform float  flagH;     // total cloth length
uniform float  artScale;  // screen px per unit of the source art
uniform float  bodyHalf;  // half-width of the straight body, in px
uniform float  taperTop;  // art Y where the pointed hem begins
uniform float  taperTip;  // art Y of the point itself
uniform float3 back;      // plain reverse colour of the cloth

// How wide the cloth is at arc position v — full width down the body, then
// narrowing to nothing across the triangular hem.
float clothHalf(float v) {
  float artY = v / artScale;
  if (artY <= taperTop) {
    return bodyHalf;
  }
  return bodyHalf * max((taperTip - artY) / (taperTip - taperTop), 0.0);
}

half4 main(float2 xy) {
  if (radius < 0.5) { return half4(0.0); }

  // Distance from the cylinder's axis; outside it there is nothing to draw.
  float cy = flatH + radius;
  float dy = xy.y - cy;
  if (abs(dy) > radius) { return half4(0.0); }

  // Screen y -> angle around the front of the cylinder (0 = top rim, PI = bottom),
  // then angle -> how far along the cloth we are. This is the foreshortening:
  // equal steps of cloth compress into ever smaller steps of screen y near the rims.
  float theta = acos(clamp(-dy / radius, -1.0, 1.0));
  float v = flatH + radius * theta;
  if (v > flagH) { return half4(0.0); }

  // Silhouette, so the roll tapers with the hem instead of staying a full bar.
  float half_w = clothHalf(v);
  float dx = abs(xy.x - size.x * 0.5);
  float edge = half_w - dx;
  if (edge <= 0.0) { return half4(0.0); }
  float alpha = clamp(edge, 0.0, 1.0);

  // Round-body lighting: brightest at the crown, falling off to both rims.
  float lit = sin(theta);
  float shade = 0.34 + 0.9 * lit;

  // The wound ends of the roll turn away from the light, so darken towards them
  // — without this the roll reads as a flat strip cut off with hard edges.
  float endFall = 1.0 - 0.42 * pow(clamp(dx / max(half_w, 0.001), 0.0, 1.0), 2.5);
  shade *= endFall;

  // A crisp highlight just above the crown — the "firm roll" tell.
  float spec = exp(-pow((theta - 1.15) * 6.0, 2.0)) * 0.45;

  // Two wound seams, foreshortened by the same angle mapping as the cloth.
  float seam = exp(-pow((theta - 0.95) * 26.0, 2.0)) * 0.20
             + exp(-pow((theta - 1.85) * 26.0, 2.0)) * 0.16;

  float3 rgb = clamp(back * shade + spec - seam, float3(0.0), float3(1.0));
  return half4(half3(rgb * alpha), half(alpha)); // premultiplied
}
`;

// Compiled once, defensively: a shader that fails to compile must degrade to
// "draw nothing" rather than crash the Log screen.
let cachedEffect: ReturnType<typeof Skia.RuntimeEffect.Make> | null | undefined;
function getEffect() {
  if (cachedEffect === undefined) {
    try {
      cachedEffect = Skia.RuntimeEffect.Make(SKSL);
    } catch {
      cachedEffect = null;
    }
  }
  return cachedEffect;
}

export interface SkiaBannerRollProps {
  width: number;
  height: number;
  flatH: number;
  radius: number;
  flagH: number;
  artScale: number;
  bodyHalf: number;
  taperTop: number;
  taperTip: number;
  /** Plain reverse colour of the cloth, as 0–1 RGB. */
  back: readonly [number, number, number];
}

export function SkiaBannerRoll({
  width,
  height,
  flatH,
  radius,
  flagH,
  artScale,
  bodyHalf,
  taperTop,
  taperTip,
  back,
}: SkiaBannerRollProps) {
  const effect = getEffect();
  const uniforms = useMemo(
    () => ({
      size: [width, height],
      flatH,
      radius,
      flagH,
      artScale,
      bodyHalf,
      taperTop,
      taperTip,
      back: [back[0], back[1], back[2]],
    }),
    [width, height, flatH, radius, flagH, artScale, bodyHalf, taperTop, taperTip, back],
  );

  if (!effect) return null;

  return (
    <Canvas pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width, height }}>
      <Fill>
        <Shader source={effect} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
}

/** Whether the GPU roll is usable at all (Skia present + shader compiled). */
export function skiaRollAvailable(): boolean {
  return !!getEffect();
}
