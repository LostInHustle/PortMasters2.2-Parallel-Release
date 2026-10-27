/**
 * The three Houses wear the colors they are named for: a pavilion of
 * jade, a gate of vermilion, a crown of lotus gold. The palette carries
 * one token each, and everything that draws a House reads from here, so
 * a House is never one color in one panel and another color in the
 * next.
 *
 * This lives apart from the components because two of them draw a House:
 * one list with two readers, so a House wears the same color in the
 * Great Houses dialog and on the leaderboard.
 *
 * The maps are typed to the Houses themselves, so a House that the
 * engine knows and the palette does not is a compile error rather than a
 * House that quietly wears the fallback everywhere it is drawn. The crest
 * is built from the House's own token (see HOUSE_TOKENS in the engine),
 * because its class is hand written CSS. The tint and the bar are written
 * out in full, because Tailwind reads class names from source text: a
 * class built by interpolation produces no CSS and leaves the House with no
 * color at all. Their maps are still typed to the Houses, and the Houses
 * smoke suite checks each string names that House's own token.
 */
import { HOUSE_TOKENS } from "@/lib/game/engine";
import { HOUSE_IDS, type HouseId } from "@/lib/game/legacy";

// One map per form, each built from the House's own token. The one
// builder rather than three hand written lists, because a list of three
// House names written out three times is three places for a House to go
// missing.
function byHouse(build: (token: string) => string): Record<HouseId, string> {
  const out = {} as Record<HouseId, string>;
  for (const id of HOUSE_IDS) out[id] = build(HOUSE_TOKENS[id]);
  return out;
}

/** The crest behind a House icon. */
export const HOUSE_CREST: Record<HouseId, string> = byHouse(
  (token) => `pm-grad-${token}`,
);

/** The soft form, for a chip that names a House without filling it. */
export const HOUSE_TINT: Record<HouseId, string> = {
  jade_pavilion: "bg-house-jade/15 text-house-jade",
  vermilion_gate: "bg-house-vermilion/15 text-house-vermilion",
  golden_lotus: "bg-house-lotus/15 text-house-lotus",
};

/** The progress bar a House runs along, in its own color. */
export const HOUSE_BAR: Record<HouseId, string> = {
  jade_pavilion: "from-house-jade/60 to-house-jade",
  vermilion_gate: "from-house-vermilion/60 to-house-vermilion",
  golden_lotus: "from-house-lotus/60 to-house-lotus",
};

/**
 * A House the palette has not met yet falls back to the panel it is
 * drawn in rather than to the brand color, so an unknown House reads
 * as part of the Great Houses panel instead of as the app mark.
 */
export const HOUSE_FALLBACK = "pm-grad-houses";
export const HOUSE_TINT_FALLBACK = "bg-houses/15 text-houses";
export const HOUSE_BAR_FALLBACK = "from-houses/60 to-houses";
