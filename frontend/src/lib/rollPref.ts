// Local-only preference for the GPU-shaded ("realistic") banner roll.
//
// Kept out of the /settings blob on purpose: this is a rendering choice for
// comparing the Skia roll against the original view-layer one, so it lives on
// the device and needs no backend field.
import { storage } from "@/src/utils/storage";

export const REALISTIC_ROLL_KEY = "avirlog_realistic_roll";

// On by default — the shaded roll is the point of the change; flip it off to
// see the original.
export async function getRealisticRoll(): Promise<boolean> {
  const v = await storage.getItem<boolean>(REALISTIC_ROLL_KEY, true);
  return v !== false;
}

export async function setRealisticRoll(value: boolean): Promise<void> {
  await storage.setItem(REALISTIC_ROLL_KEY, value);
}
