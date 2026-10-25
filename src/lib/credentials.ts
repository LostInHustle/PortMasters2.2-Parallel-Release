// =====================================================================
// The captain's own rule: what a captain name, a password and a display
// name are allowed to be.
//
// It lives out here rather than in auth.ts because it is read from both
// sides of the wire. The server enforces it (the zod schema in auth.ts
// takes its bounds from here) and both credential cards print it beside
// their fields, so the sentence a captain reads and the rule they are
// held to are one statement of the numbers rather than three.
//
// Deliberately import free of the layers a browser cannot carry. A client
// screen reads this file, and auth.ts next door holds the password hasher
// and the database handle, neither of which can go into a browser bundle.
// The one import below is the language pack's reader, which is a table of
// strings and nothing else.
// =====================================================================

import { t, type Params } from "./game/i18n";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
/**
 * Printed beside the captain name field on both cards.
 *
 * The sentence carries the rule's numbers, and the pack carries it as a
 * frame rather than as the baked English: the field's read fills it from
 * HINT_TOKENS below (see hintText), which is what keeps the numbers
 * written once and the English the same sentence it has always been.
 */
export const USERNAME_HINT =
  "{USERNAME_MIN} to {USERNAME_MAX} chars, letters, numbers, underscore";
/** Refused with this sentence when the name breaks the pattern. */
export const USERNAME_ERROR =
  "Captain name may only contain letters, numbers and underscores";

export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 72;
/** Printed beside the password field on both cards. The same frame, the same read. */
export const PASSWORD_HINT = "at least {PASSWORD_MIN} characters";

export const DISPLAY_NAME_MAX = 24;

/**
 * The values the two hint frames read, under the names the pack spells
 * them: the rule's own numbers, taken from the constants above rather
 * than written again inside a sentence.
 */
const HINT_TOKENS: Params = {
  USERNAME_MIN,
  USERNAME_MAX,
  PASSWORD_MIN,
};

/**
 * A field hint in the language of the captain reading it.
 *
 * The card holds each hint as data (the two constants above, which are
 * the pack's own spellings) and hands it here the way it hands every
 * other line of a field to the reader. The two hints are the only lines
 * in the tree that are frames rather than whole sentences, so the read
 * fills their numbers from beside them; a plain hint like "shown in the
 * roster" passes through untouched, and anything the pack does not carry
 * prints as itself.
 */
export function hintText(hint: string): string {
  return t(hint, HINT_TOKENS);
}
