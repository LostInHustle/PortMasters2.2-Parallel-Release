"use client";

import { t } from "@/lib/game/i18n";
import { useLanguage } from "@/lib/use-language-preference";
import { ErrorShell } from "./error-shell";

// The harbor's answer to an address that names nothing. Next renders
// this for any route the app does not have, which until now was the
// framework's own gray page: the one screen a lost visitor was certain to
// see was the one screen that did not look like the game.
//
// It is deliberately stateless. A captain reaches it by typing a wrong
// address, following a stale link, or landing on a route this build never
// shipped, and the single thing it owes them is the way back, which is a
// plain anchor so it works before any script does.

export default function NotFound() {
  // This screen stands outside the harbor and the lobby, so it
  // subscribes to the captain's language itself, the way the error
  // boundary beside it does: a pick redraws it and the lines below read
  // through t() at that render.
  useLanguage();
  return (
    <ErrorShell
      title={t("This harbor is not on the chart")}
      body={t(
        "The page you were looking for does not exist. The address may have a typo, or it may point at a screen this build does not sail with.",
      )}
      actions={
        <a
          href="/"
          className="pm-pressable pm-grad-brand mt-6 inline-flex h-10 items-center justify-center rounded-xl px-5 text-sm font-semibold"
        >
          {t("Back to the harbor")}
        </a>
      }
    />
  );
}
