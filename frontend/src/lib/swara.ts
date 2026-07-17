// Swara Yoga guidance content, derived from the Avirlog Swara Yoga module.
// Maps each logged nostril state to its energetic meaning, recommended
// activities, and a set of short rotating recommendation lines shown after a
// log (per the module's "popup recommendation" UX copy).
import { NostrilState } from "@/src/theme/theme";

export interface SwaraActivity {
  label: string;
  text: string;
}

export interface SwaraInfo {
  sanskrit: string; // Ida / Pingala / Sushumna
  essence: string; // short qualifier line
  description: string;
  activities: SwaraActivity[];
  messages: string[]; // rotating post-log recommendations
}

export const SWARA: Record<NostrilState, SwaraInfo> = {
  left: {
    sanskrit: "Ida",
    essence: "Cooling · parasympathetic · introspective",
    description:
      "Left-nostril (Ida) flow engages the parasympathetic “rest and digest” system — calming and cooling, and biased toward the creative right brain. A good window for reflection and recovery.",
    activities: [
      { label: "Physical", text: "Gentle movement — yoga, stretching, a slow walk" },
      { label: "Mental", text: "Reading, creative writing, meditation" },
      { label: "Social", text: "Quiet family time, journaling; avoid heated debate" },
      { label: "Breathing", text: "Left-nostril (Chandra Bhedana) or deep belly breaths" },
      { label: "Timing", text: "Evening or rest periods — to unwind" },
    ],
    messages: [
      "Calm mode: read, journal or meditate quietly.",
      "Creativity flows: write, draw, or envision ideas.",
      "A gentle stretch or yoga is ideal right now.",
      "Relax: take deep slow breaths or a warm bath.",
      "Quiet time: call a friend, listen to music, or rest.",
      "Unwind with left-nostril breathing or a So-Ham chant.",
      "The moon is with you — soften, slow down, receive.",
      "Cool and calm. Let the day settle into you.",
      "Rest is not idleness. Let your mind wander freely.",
      "A good hour to feel, imagine, and restore.",
      "Breathe long and low. Nothing to chase right now.",
      "Ida flows — nourish yourself and be gentle.",
      "Let go of the rush. This is a window for peace.",
      "Cool water over warm stone. Ease into stillness.",
    ],
  },
  right: {
    sanskrit: "Pingala",
    essence: "Heating · sympathetic · energizing",
    description:
      "Right-nostril (Pingala) flow engages the sympathetic “fight or flight” system — heating and energizing, biased toward the logical left brain. A good window for action and output.",
    activities: [
      { label: "Physical", text: "Intensive exercise — running, HIIT, sports" },
      { label: "Mental", text: "Analytical tasks, strategic planning, debate" },
      { label: "Social", text: "Active networking, competitive games" },
      { label: "Breathing", text: "Right-nostril (Surya Bhedana) or Kapalabhati" },
      { label: "Timing", text: "Morning or midday — peak energy" },
    ],
    messages: [
      "Energy’s up — tackle a workout or active task now.",
      "Feeling energized: try a brisk run or cycling.",
      "Time to focus: solve a problem or plan your day.",
      "Get moving: do a quick workout or power walk.",
      "Engage with others: schedule a meeting or group activity.",
      "Boost energy with right-nostril breaths or Kapalabhati.",
      "The sun is with you — act, decide, and build.",
      "Momentum is on your side. Start the hard thing.",
      "Sharp and clear. Great time to think and do.",
      "Channel the heat: finish what the day began.",
      "Strike while it’s hot — one bold move now.",
      "Pingala flows — be direct, be strong, be swift.",
      "Fuel in the tank. Put it toward what matters.",
      "Fire in the mind. Solve, plan, and push forward.",
    ],
  },
  both: {
    sanskrit: "Sushumna",
    essence: "Balanced · meditative · harmonious",
    description:
      "When both nostrils flow equally (Sushumna), the autonomic system is balanced — an auspicious window for meditation, study, and creative focus.",
    activities: [
      { label: "Physical", text: "Moderate exercise or yoga; flexibility work" },
      { label: "Mental", text: "Deep concentration, study, creative brainstorming" },
      { label: "Social", text: "Group meditation or calm conversation" },
      { label: "Breathing", text: "Alternate-nostril breathing (Nadi Shodhana)" },
      { label: "Timing", text: "During equal flow — often around midday" },
    ],
    messages: [
      "Balanced mind: perfect for meditation or study.",
      "Deep focus: try breathing exercises or creative work.",
      "Harmonious energy: great for yoga or mindful tasks.",
      "Social balance: have a calm discussion or family time.",
      "Practice alternate-nostril breathing (Nadi Shodhana).",
      "Enjoy this balanced state — maybe journal or rest.",
      "A rare and open door — sit quietly for a moment.",
      "Sun and moon in balance. The mind grows still.",
      "Perfect equilibrium. Meditate, or simply be.",
      "Neither pushing nor resting — just present.",
      "Sushumna flows — an auspicious time for practice.",
      "Center found. Let awareness rest where it is.",
      "Both currents meet. Breathe, and notice.",
      "Stillness at the crossroads. Savor it.",
    ],
  },
};

// Rotate through the messages, avoiding an immediate repeat per state.
const lastIndex: Partial<Record<NostrilState, number>> = {};

export function pickMessage(state: NostrilState): string {
  const messages = SWARA[state].messages;
  let i = Math.floor(Math.random() * messages.length);
  if (messages.length > 1 && i === lastIndex[state]) {
    i = (i + 1) % messages.length;
  }
  lastIndex[state] = i;
  return messages[i];
}
