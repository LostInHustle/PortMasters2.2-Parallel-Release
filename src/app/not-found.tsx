import { Anchor } from "lucide-react";

// The harbour's answer to an address that names nothing. Next renders
// this for any route the app does not have, which until now was the
// framework's own grey page: the one screen a lost visitor was certain to
// see was the one screen that did not look like the game.
//
// It is deliberately a server component with no state. A captain reaches
// it by typing a wrong address, following a stale link, or landing on a
// route this build never shipped, and the single thing it owes them is
// the way back, which is a plain anchor so it works before any script
// does.

export default function NotFound() {
  return (
    <main className="pm-canvas flex min-h-screen items-center justify-center p-4">
      <div className="pm-glass pm-crackle relative w-full max-w-md overflow-hidden rounded-3xl p-8 text-center">
        <div className="pm-seigaiha pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative">
          <div className="pm-grad-brand mx-auto flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg">
            <Anchor className="h-7 w-7" />
          </div>
          <h1 className="font-display mt-4 text-xl font-bold">
            This harbor is not on the chart
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            The page you were looking for does not exist. The address may have a
            typo, or it may point at a screen this build does not sail with.
          </p>
          <a
            href="/"
            className="pm-pressable pm-grad-brand mt-6 inline-flex h-10 items-center justify-center rounded-xl px-5 text-sm font-semibold"
          >
            Back to the harbor
          </a>
        </div>
      </div>
    </main>
  );
}
