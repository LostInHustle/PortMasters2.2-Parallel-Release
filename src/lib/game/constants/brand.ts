// =====================================================================
// PortMasters 2.2 Parallel Release: game constants
// Balance, descriptions, and overall wording are carried over verbatim
// from PortMasters 2 Parallel Release, the build this one follows; where
// this text names the game it says the current name (see README.md).
// =====================================================================

// Single source of truth for the project's display name. Every screen,
// log line, and metadata tag that shows the game's name should pull from
// this constant rather than hardcoding the string, so a future rebrand
// only has to happen in one place.
export const APP_NAME = "PortMasters 2.2 Parallel Release";

// The one sentence the game says about itself when it is asked what it
// is: the browser's metadata, the link preview a shared address unfolds
// into, and the social card's own art. Written without the name, because
// the callers that show it put the name beside it, and a sentence that
// begins with its own title reads as boilerplate in exactly the places
// this one is read.
export const APP_DESCRIPTION =
  "A multiplayer maritime trade game on the ancient Silk Road. Captains gather in a shared harbor, sail in lockstep, and the highest Reputation wins the Sea Master crown.";

export const ICONS: Record<string, string> = {
  Gold: "💰",
  Hemp: "🧶",
  Silk: "👘",
  Tea: "🍵",
  "Linen Clothes": "👔",
  "Cotton Clothes": "👕",
  Brocade: "👗",
  Sachet: "🌸",
  "Porcelain Clay": "🧱",
  "Copper Ore": "⛏️",
  "Celadon Ware": "🫖",
  "Bronze Mirror": "🪞",
  Spices: "🌶️",
  Pearls: "🦪",
  "Foreign Balm": "🧴",
  "Pearl String": "📿",
  Rags: "🪡",
};

export const COLORS: Record<string, string> = {
  Gold: "#D4A017",
  Hemp: "#8B7355",
  Silk: "#DC143C",
  Tea: "#228B22",
  "Linen Clothes": "#D2691E",
  "Cotton Clothes": "#4169E1",
  Brocade: "#8B008B",
  Sachet: "#FF1493",
  "Porcelain Clay": "#8FA5B6",
  "Copper Ore": "#B87333",
  "Celadon Ware": "#6FA292",
  "Bronze Mirror": "#8C7853",
  Spices: "#C1440E",
  Pearls: "#9AA7B1",
  "Foreign Balm": "#C99B6E",
  "Pearl String": "#B9A0E0",
  Rags: "#A89A8C",
};

// [MANIFEST 16: Colorblind Safe Palette] The set above puts Silk (a
// crimson red) and Tea (a forest green) close enough on the color wheel
// that a red green colorblind captain, the most common form by far, would
// struggle to tell them apart at a glance in the same list. This is a
// second, complete mapping for the same set of goods, built around the
// design technique that actually works for red green colorblindness:
// separate every color by lightness and saturation as well as by hue,
// never by hue alone, and keep any two colors that would clash under
// protanopia or deuteranopia (reds, greens, and browns collapsing toward
// each other) as far apart as possible. Anchored on the Okabe and Ito
// palette, a widely cited set of hues confirmed distinguishable under
// every common form of color vision deficiency. Selecting it changes
// nothing about game rules, balance, or what any other captain sees, only
// how one captain's own client renders a color already being shown to
// them anyway; see useColorPreference in src/lib/use-color-preference.ts
// for where a player turns it on.
export const COLORS_COLORBLIND_SAFE: Record<string, string> = {
  Gold: "#E8A33D",
  Hemp: "#A67C52",
  Silk: "#CC79A7",
  Tea: "#009E73",
  "Linen Clothes": "#0072B2",
  "Cotton Clothes": "#56B4E9",
  Brocade: "#D55E00",
  Sachet: "#F0E442",
  "Porcelain Clay": "#7A93A6",
  "Copper Ore": "#B5651D",
  "Celadon Ware": "#4FA98C",
  "Bronze Mirror": "#7D6852",
  Spices: "#B33F1E",
  Pearls: "#A8B4BD",
  "Foreign Balm": "#C99B6E",
  "Pearl String": "#7B6FA6",
  Rags: "#C3B7A4",
};
