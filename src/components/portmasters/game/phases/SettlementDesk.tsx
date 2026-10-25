"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The frame the two settlement desks are drawn on: the harbor's aid desk
 * and the backing desk beside it.
 *
 * They had been written out twice, frame, heading, rows and press alike,
 * and two copies of a desk is how one of them drifts a shade or a space
 * away from the other without anybody deciding to. The frame, the heading
 * and the note under the rows are here; what each desk says and what it
 * offers stay with the desk that says and offers them.
 */
export function SettlementDesk({
  title,
  note,
  children,
}: {
  title: React.ReactNode;
  /** The sentence under the rows: what a loan settles into, or where a
      pledge goes. */
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-background/50 p-3.5 my-3.5">
      <h3 className="font-semibold mb-2 text-sm">{title}</h3>
      <div className="space-y-1.5">{children}</div>
      {note && <p className="text-[11px] text-muted-foreground mt-2">{note}</p>}
    </div>
  );
}

/**
 * One row of a settlement desk: the ask or the pledge, and the press
 * that answers it.
 *
 * The two desks' rows are one row, down to the frame and the gap beside
 * the press, and the only thing that ever differed was whether the line
 * wraps when the harbor is narrow. That difference is a prop, because a row
 * that wrapped on one desk and not on the other would make the same ask
 * read as two different weights.
 */
export function SettlementDeskRow({
  wrap = false,
  children,
}: {
  /** Whether the row's own line may wrap under the press. */
  wrap?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md px-3 py-2 text-xs border border-black/5 dark:border-white/10 bg-background/60 gap-2",
        wrap && "flex-wrap",
      )}
    >
      {children}
    </div>
  );
}

/**
 * The press a settlement desk answers a row with: the small button that
 * lends the gold or pledges the backing.
 *
 * The purse decides whether the press is live, and the gradient is the
 * reward for it, so a captain who cannot cover the ask is shown the same
 * button grayed rather than a desk with nothing on it. The one press
 * that takes something back rather than granting it wears the alarm
 * instead, and is live whatever the purse holds.
 */
export function SettlementDeskAction({
  label,
  onClick,
  available = true,
  destructive = false,
}: {
  label: React.ReactNode;
  onClick: () => void;
  /** Whether the purse covers the ask, which is what earns the gradient
      and the live press. */
  available?: boolean;
  /** Whether the press takes something back rather than granting it. */
  destructive?: boolean;
}) {
  return (
    <Button
      size="sm"
      className={cn(
        "h-7 px-2.5 text-[10px] rounded shrink-0",
        available && !destructive && "pm-grad-resolve",
      )}
      variant={
        destructive ? "destructive" : available ? "default" : "secondary"
      }
      disabled={!destructive && !available}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
