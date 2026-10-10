"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { JustForChip, PathDeskRow } from "./phases/PhaseShared";

/**
 * The furniture the trading desks share.
 *
 * The escort market, the module market, the refit bench and the bazaar
 * desk are four markets drawn at the same table, and they had grown the
 * same frame, the same offer block, the same error line, the same empty
 * state and the same offer row four times over: eighteen shared JSX and
 * class lines pairwise between the escort, module and refit panels alone,
 * with the wrapper, the heading, the form block, the error block, the
 * empty state and the row button cluster byte for byte. Three copies of
 * a row is three chances for one desk's accept button, blocked note or
 * cancel press to drift from the next, which is the same defect
 * PathDeskRow was extracted to end one layer down.
 *
 * What stays in each market is what is actually that market's own: its
 * sentences, its goods, its blocked readings and the engine it talks to.
 * What lives here is the shape all four promise to draw.
 */

// The tone a block wears, named rather than assembled: the escort,
// module and bazaar markets wear the Parley edge, the refit bench its
// own, and the bench's pile and tailors rows the neutral one. A class
// name built at runtime is a class name Tailwind never compiles, so the
// three edges are written out and chosen by key.
const BLOCK_TONES = {
  parley: "border-parley/15",
  refit: "border-refit/15",
  plain: "border-black/5 dark:border-white/10",
} as const;

/**
 * The panel one market stands in: the frame, the centered heading and
 * the intro paragraph that says what this desk sells. Everything a
 * market draws below the paragraph is handed in as children.
 */
export function MarketPanel({
  title,
  intro,
  children,
}: {
  title: React.ReactNode;
  intro: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-parley/15 bg-parley/[0.03] p-4 mb-4">
      <h3 className="text-center font-semibold mb-1 text-sm">{title}</h3>
      <p className="text-center text-[11px] text-muted-foreground mb-3 max-w-xl mx-auto">
        {intro}
      </p>
      {children}
    </div>
  );
}

/**
 * One block inside a market: the posting form, the bench's pile, the
 * tailors' row. Same shape everywhere, framed in the tone the desk
 * wears.
 */
export function MarketBlock({
  tone = "parley",
  children,
}: {
  tone?: keyof typeof BLOCK_TONES;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-background/40 p-3 mb-3",
        BLOCK_TONES[tone],
      )}
    >
      {children}
    </div>
  );
}

/**
 * The line a market shows when its board is empty. The bench keeps its
 * own tighter padding through className; the sentences are the market's
 * own and arrive as children.
 */
export function MarketEmpty({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "text-center text-xs text-muted-foreground",
        className ?? "py-3",
      )}
    >
      {children}
    </p>
  );
}

/**
 * One row of an offer board, read by which side of the offer this captain
 * is on.
 *
 * The row's sentence, its crest or icon and its blocked reading all
 * arrive from the market that owns them. What the row itself carries is
 * the half all three desks had written out three times: the state label
 * an offer wears, the chip an aimed offer wears, the seller's own Cancel
 * press, and the buyer's Take and Turn Down buttons with the refusal note
 * under them.
 *
 * The two readings the row draws its buttons from are deliberately two
 * rather than one. `standing` is whether this row is still an offer somebody
 * may act on, which is what the buttons answer to; `chip` is whether the
 * offer was aimed at one captain rather than at the table, which is what
 * the lock chip answers to. Reading the chip as both would draw no controls
 * at all for an offer posted to the whole harbor, which is the default a
 * seller posts with: not a Take for the table it was offered to, and not a
 * Cancel for the seller who posted it.
 *
 * `state` is a node rather than a string because the two questions a state
 * answers (waiting on whom, settled how) are the market's own, and the row
 * only owes it a place to stand beside the line.
 */
export function OfferRow({
  mine,
  className,
  line,
  state,
  chip,
  standing = false,
  acceptLabel,
  acceptClassName,
  declineLabel,
  blocked,
  onCancel,
  onDecline,
  onAccept,
}: {
  mine: boolean;
  className?: string;
  line: React.ReactNode;
  /** The state this row is in, drawn beside the line. */
  state?: React.ReactNode;
  chip: { forMe: boolean; name?: string | null } | null;
  /** Whether the row is still an offer, which is what draws its buttons. */
  standing?: boolean;
  acceptLabel: React.ReactNode;
  acceptClassName?: string;
  /** The addressed captain's own refusal, where the market has one. */
  declineLabel?: React.ReactNode;
  blocked: string | null;
  onCancel: () => void;
  onDecline?: () => void;
  onAccept: () => void;
}) {
  return (
    <PathDeskRow mine={mine} className={className}>
      <span className="flex items-center gap-1.5 flex-wrap">
        <span className="font-medium">{line}</span>
        {chip && <JustForChip forMe={chip.forMe} name={chip.name} />}
        {state}
      </span>

      {standing &&
        (mine ? (
          <Button
            size="sm"
            variant="destructive"
            className="h-7 px-2.5 text-[10px] rounded shrink-0"
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : (
          <span className="flex flex-col items-end gap-0.5 shrink-0">
            <span className="flex items-center gap-1">
              <Button
                size="sm"
                className={cn(
                  "h-7 px-2.5 text-[10px] rounded",
                  !blocked && acceptClassName,
                )}
                variant={blocked ? "secondary" : "default"}
                disabled={blocked !== null}
                onClick={onAccept}
              >
                {acceptLabel}
              </Button>
              {onDecline && declineLabel && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-[10px] rounded"
                  onClick={onDecline}
                >
                  {declineLabel}
                </Button>
              )}
            </span>
            {blocked && (
              <span className="text-[9px] text-muted-foreground">
                {blocked}
              </span>
            )}
          </span>
        ))}
    </PathDeskRow>
  );
}
