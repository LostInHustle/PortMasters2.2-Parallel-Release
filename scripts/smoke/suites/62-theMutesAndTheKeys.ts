// PortMasters 2.2 Parallel Release, smoke run: the mutes and the keys.
//
// [W3, NOT-5] The audit asked for an article driving the notification
// center's rules and found none written down; reading the code settled
// which rules exist. There is no dedupe rule and no below the breakpoint
// suppression rule; the rules that are real are these. A captain who has
// never opened Settings hears every category, because an absent
// preference answers enabled. The three switches are three keys, so
// muting one category leaves the others alone. Storage that is blocked
// or refuses a write is answered in the captain's favor rather than
// throwing inside a settings screen. And the screen that saves a
// preference and the hook that reads it are looking at the same key,
// because the keys are spelled in exactly one file.
//
// The delivery half of the center (a new bubble replacing the current one
// rather than stacking, a muted category still recorded in the history
// with no unread increment) stays where it already lives: the
// conversation article drives a harbor chat frame end to end through the
// live socket, and the replacement rule is a property of the hook's one
// push rather than of anything a socket surface can observe without a
// page. This article reads the half that is reachable from here, the
// preference functions and the keys, which is the half the audit's own
// defect was about: the screen once saved under its own copy of the key
// names while the hook read a set nothing wrote to.
//
// The preference functions answer out of localStorage, so the first half
// swaps a stub in and puts the host's own storage back in the finally
// below, whether or not a check threw. The key half walks src for the
// three literals: each one must live in one file, which is the same
// shape the private information scan reads its single paths through.

import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  notifCategoryPref,
  setNotifCategoryPref,
} from "@/lib/use-notifications";
import { check, walkSrc, withoutComments } from "../harness";

// The three keys, retyped here on purpose: this article's job is to hold
// the strings still, so reading them back out of the module it audits
// would make the audit agree with whatever the module said.
const PREF_KEY_LITERALS = [
  "portmasters_notif_room_events",
  "portmasters_notif_docks",
  "portmasters_notif_tidewatch",
];

export async function theMutesAndTheKeysSuite(): Promise<void> {
  const store = new Map<string, string>();
  const prior = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const setStorage = (value: unknown) =>
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      writable: true,
      value,
    });

  setStorage({
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  });
  try {
    check(
      notifCategoryPref("room") &&
        notifCategoryPref("docks") &&
        notifCategoryPref("tidewatch"),
      "a captain who has never opened Settings hears every category: an absent preference answers enabled, which is the only default that cannot silently mute somebody on their first voyage",
    );

    setNotifCategoryPref("room", false);
    check(
      notifCategoryPref("room") === false &&
        notifCategoryPref("docks") === true &&
        notifCategoryPref("tidewatch") === true,
      "muting one category leaves the other two alone, so the three switches are three keys rather than one shared flag wearing three labels",
    );

    setNotifCategoryPref("room", true);
    check(
      notifCategoryPref("room") === true,
      "unmuting writes the preference back, so the switch is a switch rather than a one way door",
    );

    setStorage({
      getItem: () => {
        throw new Error("storage is blocked");
      },
      setItem: () => {
        throw new Error("storage is blocked");
      },
    });
    check(
      notifCategoryPref("room") === true,
      "storage that refuses reads answers enabled, because a captain who has blocked storage has not muted anything and the alternative is a settings screen deciding they did",
    );
    let threw = false;
    try {
      setNotifCategoryPref("room", false);
    } catch {
      threw = true;
    }
    check(
      !threw,
      "storage that refuses writes swallows the refusal rather than throwing out of a settings screen, which is the private browsing case the hook's own comment names",
    );
  } finally {
    if (prior) Object.defineProperty(globalThis, "localStorage", prior);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }

  // The keys, each one held to a single file. The walk reads src the same
  // way the check script does and strips comments first, so a comment
  // quoting a key is not a second home for it.
  const root = join(import.meta.dirname, "..", "..", "..");
  const files = walkSrc(join(root, "src"));
  for (const key of PREF_KEY_LITERALS) {
    const holders = files
      .filter((file) =>
        withoutComments(readFileSync(file, "utf8")).includes(key),
      )
      .map((file) => relative(root, file));
    check(
      holders.length === 1 && holders[0] === "src/lib/use-notifications.ts",
      `the key "${key}" lives in exactly one file (${holders.join(", ") || "none"}), so the screen that saves a preference and the code that reads it cannot part ways the way they once did`,
    );
  }

  const settings = readFileSync(
    join(root, "src", "components", "portmasters", "SettingsModal.tsx"),
    "utf8",
  );
  check(
    settings.includes("notifCategoryPref") &&
      settings.includes("setNotifCategoryPref"),
    "the settings screen reads and writes through the module's own two functions, so its switches hold no key of their own to drift",
  );
}
