"use client";

import { Anchor } from "lucide-react";

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
  return (
    <main className="pm-canvas flex min-h-screen items-center justify-center p-4">
      <div className="pm-glass pm-crackle relative w-full max-w-md overflow-hidden rounded-3xl p-8 text-center">
        <div className="pm-seigaiha pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative">
          <div className="pm-grad-brand mx-auto flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg">
            <Anchor className="h-7 w-7" />
          </div>
          <h1 className="font-display mt-4 text-xl font-bold">
            This screen hit rough water
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Something went wrong while drawing it. Your voyage is stored on the
            server, so nothing sailed on without you. Try again first; a reload
            settles what trying again does not.
          </p>
          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="pm-pressable pm-grad-brand inline-flex h-10 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold"
            >
              Try again
            </button>
            <a
              href="/"
              className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
            >
              Back to the harbor
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
