"use client";

import { t } from "@/lib/game/i18n";
import { useLanguage } from "@/lib/use-language-preference";
import { ErrorShell } from "./error-shell";

// The boundary a screen falls into when rendering throws. Next mounts it
// inside the root layout and hands it the error and a reset, which
// re-renders the segment that failed rather than reloading the page: a
// captain whose hold panel tripped does not lose the harbor around it.
//
// The screen says what happened, what it did not cost, and the two ways
// on, which is the same shape every status in the game is written in. It
// does not print the error itself: the digest is a hash with no meaning
// to a player, and the server log already has the real one.

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // This boundary stands outside the harbor and the lobby, the same as
  // the sign in card, so it subscribes to the captain's language itself
  // rather than riding a parent that already does: a pick redraws this
  // screen, and the words below read through t() at that render.
  useLanguage();
  return (
    <ErrorShell
      title={t("This screen hit rough water")}
      body={t(
        "Something went wrong while drawing it. Your voyage is stored on the server, so nothing sailed on without you. Try again first; a reload settles what trying again does not.",
      )}
      actions={
        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="pm-pressable pm-grad-brand inline-flex h-10 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold"
          >
            {t("Try again")}
          </button>
          <a
            href="/"
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
          >
            {t("Back to the harbor")}
          </a>
        </div>
      }
    />
  );
}
