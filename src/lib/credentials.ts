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
// Deliberately import free. A client screen reads this file, and auth.ts
// next door holds the password hasher and the database handle, neither of
// which can go into a browser bundle.
// =====================================================================

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
/** Printed beside the captain name field on both cards. */
export const USERNAME_HINT = `${USERNAME_MIN} to ${USERNAME_MAX} chars, letters, numbers, underscore`;
/** Refused with this sentence when the name breaks the pattern. */
export const USERNAME_ERROR =
  "Username may only contain letters, numbers and underscores";

export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 72;
/** Printed beside the password field on both cards. */
export const PASSWORD_HINT = `at least ${PASSWORD_MIN} characters`;

export const DISPLAY_NAME_MAX = 24;
