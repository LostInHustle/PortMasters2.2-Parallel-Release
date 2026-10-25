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
 * House that quietly wears the fallback everywhere it is drawn. The token
 * each House wears is the House's own fact (see HOUSE_TOKENS in the
 * engine), so the three forms below are built from it rather than each
 * spelling the color out: a House added there is a House the crest, the
 * tint and the bar all know how to draw.
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
export const HOUSE_TINT: Record<HouseId, string> = byHouse(
  (token) => `bg-${token}/15 text-${token}`,
);

/** The progress bar a House runs along, in its own color. */
export const HOUSE_BAR: Record<HouseId, string> = byHouse(
  (token) => `from-${token}/60 to-${token}`,
);

/**
 * A House the palette has not met yet falls back to the panel it is
 * drawn in rather than to the brand color, so an unknown House reads
 * as part of the Great Houses panel instead of as the app mark.
 */
export const HOUSE_FALLBACK = "pm-grad-houses";
export const HOUSE_TINT_FALLBACK = "bg-houses/15 text-houses";
export const HOUSE_BAR_FALLBACK = "from-houses/60 to-houses";
