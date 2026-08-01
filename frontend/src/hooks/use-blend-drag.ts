// A small pointer/touch drag hook for the blend sliders. Attach `panHandlers`
// and `ref` to the same View; on drag it measures that View and reports the
// fraction along one axis, mapped to a right-nostril percentage (0–100, snapped
// to 5). Each draggable surface passes its own `map` so a left-side control and
// a right-side control can share one value. Works on native and web (RN-web).
import { useMemo, useRef } from "react";
import { PanResponder, View } from "react-native";

import { hapticTick } from "@/src/lib/haptics";

type Axis = "vertical" | "horizontal";

interface BlendDragOpts {
  axis: Axis;
  // frac is 0..1 from the start of the axis (top for vertical, left for
  // horizontal). Return the resulting RIGHT-nostril percentage.
  map: (frac: number) => number;
  setValue: (rightPct: number) => void;
  disabled?: boolean;
}

const clampPct = (v: number) => Math.max(0, Math.min(100, Math.round(v / 5) * 5));
const clampFrac = (f: number) => Math.max(0, Math.min(1, f));

export function useBlendDrag(opts: BlendDragOpts) {
  const ref = useRef<View>(null);
  // Latest opts, so the (stable) PanResponder never reads stale closures.
  const latest = useRef(opts);
  latest.current = opts;
  // Measured box for the active gesture: axis start (pageX/pageY) and size.
  const box = useRef({ start: 0, size: 1 });
  // Last value we ticked on, so the detent haptic fires once per 5% step
  // instead of on every touch event.
  const lastPct = useRef<number | null>(null);

  const responder = useMemo(() => {
    // Report a new value, with a tick whenever it actually changed. This is
    // what makes the blend controls usable without looking at them — you feel
    // each step go by, the way a physical dial has notches. Defined in here so
    // the PanResponder closes over one stable copy; it only touches refs.
    const emit = (pct: number) => {
      if (lastPct.current !== pct) {
        lastPct.current = pct;
        hapticTick();
      }
      latest.current.setValue(pct);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !latest.current.disabled,
      onMoveShouldSetPanResponder: () => !latest.current.disabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        const o = latest.current;
        // Touch down always ticks, even if it lands on the current value.
        lastPct.current = null;
        ref.current?.measure((_x, _y, w, h, px, py) => {
          box.current =
            o.axis === "vertical" ? { start: py, size: h || 1 } : { start: px, size: w || 1 };
          const pos = o.axis === "vertical" ? evt.nativeEvent.pageY : evt.nativeEvent.pageX;
          emit(clampPct(o.map(clampFrac((pos - box.current.start) / box.current.size))));
        });
      },
      onPanResponderMove: (evt) => {
        const o = latest.current;
        const pos = o.axis === "vertical" ? evt.nativeEvent.pageY : evt.nativeEvent.pageX;
        emit(clampPct(o.map(clampFrac((pos - box.current.start) / box.current.size))));
      },
    });
  }, []);

  return { ref, panHandlers: responder.panHandlers };
}
