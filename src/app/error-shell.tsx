"use client";

import { Anchor } from "lucide-react";

/**
 * The shell the route error screens are drawn in: the canvas, the glass
 * card, the anchor chip, the title, the body and the way on.
 *
 * The boundary and the not found page are the same glass card with
 * different words in it, so the frame is written once here and each screen
 * hands over its own copy and its own actions.
 *
 * The last boundary (see global-error.tsx) cannot use this shell: it
 * replaces the root layout, which is where the stylesheet is loaded, so
 * every rule it draws has to be an inline style, and a class here would be
 * a name with nothing behind it.
 */
export function ErrorShell({
  title,
  body,
  actions,
}: {
  title: string;
  body: string;
  actions?: React.ReactNode;
}) {
  return (
    <main className="pm-canvas flex min-h-screen items-center justify-center p-4">
      <div className="pm-glass pm-crackle relative w-full max-w-md overflow-hidden rounded-3xl p-8 text-center">
        <div className="pm-seigaiha pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative">
          <div className="pm-grad-brand mx-auto flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg">
            <Anchor className="h-7 w-7" />
          </div>
          <h1 className="font-display mt-4 text-xl font-bold">{title}</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            {body}
          </p>
          {actions}
        </div>
      </div>
    </main>
  );
}
