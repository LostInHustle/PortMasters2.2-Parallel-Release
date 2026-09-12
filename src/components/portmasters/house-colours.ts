/**
 * The three Houses wear the colours they are named for: a pavilion of
 * jade, a gate of vermilion, a crown of lotus gold. The palette carries
 * one token each, and everything that draws a House reads from here, so
 * a House is never one colour in one panel and another colour in the
 * next.
 *
 * This lives apart from the components because two of them draw a House
 * and they used to disagree: the Great Houses dialog painted every crest
 * gold while the leaderboard gave each House its own. One list, two
 * readers.
 */

/** The crest behind a House icon. */
export const HOUSE_CREST: Record<string, string> = {
  jade_pavilion: "pm-grad-house-jade",
  vermilion_gate: "pm-grad-house-vermilion",
  golden_lotus: "pm-grad-house-lotus",
};

/** The soft form, for a chip that names a House without filling it. */
export const HOUSE_TINT: Record<string, string> = {
  jade_pavilion: "bg-house-jade/15 text-house-jade",
  vermilion_gate: "bg-house-vermilion/15 text-house-vermilion",
  golden_lotus: "bg-house-lotus/15 text-house-lotus",
};

/** The progress bar a House runs along, in its own colour. */
export const HOUSE_BAR: Record<string, string> = {
  jade_pavilion: "from-house-jade/60 to-house-jade",
  vermilion_gate: "from-house-vermilion/60 to-house-vermilion",
  golden_lotus: "from-house-lotus/60 to-house-lotus",
};

/**
 * A House the palette has not met yet falls back to the panel it is
 * drawn in rather than to the brand colour, so an unknown House reads
 * as part of the Great Houses panel instead of as the app mark.
 */
export const HOUSE_FALLBACK = "pm-grad-houses";
export const HOUSE_TINT_FALLBACK = "bg-houses/15 text-houses";
export const HOUSE_BAR_FALLBACK = "from-houses/60 to-houses";
