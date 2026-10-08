import { Anchor } from "lucide-react";

/**
 * The splash a screen shows while its first read is in flight: one line,
 * centred on the canvas.
 *
 * Written once because three entry screens wear it: the harbor door, the
 * operator console and the balance dashboard. The landing screen carries
 * the brand badge above its line, because that splash is the first thing a
 * captain sees and the mark belongs on it; the two operator screens are
 * visited mid shift and read as a line.
 */
export function PageSplash({
  line,
  badge = false,
}: {
  line: string;
  badge?: boolean;
}) {
  return (
    <main className="pm-canvas flex min-h-screen items-center justify-center">
      {badge ? (
        <div className="flex flex-col items-center gap-4">
          <div className="pm-grad-brand flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg">
            <Anchor className="h-8 w-8" />
          </div>
          <p className="text-brand font-display text-lg">{line}</p>
        </div>
      ) : (
        <p className="text-muted-foreground font-display text-lg">{line}</p>
      )}
    </main>
  );
}
