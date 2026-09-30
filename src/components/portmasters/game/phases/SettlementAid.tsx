"use client";

import { Button } from "@/components/ui/button";
import { QuantityInput } from "@/components/ui/quantity-input";
import { cn } from "@/lib/utils";
import { useLiveAmount } from "@/lib/use-live-amount";
import { HandCoins } from "lucide-react";
import { type PhasePanelProps } from "./PhaseShared";

/**
 * The shortfall desk: the ask this captain may post when the bills are
 * beyond the purse, and the asks the rest of the harbor has posted. It owns
 * the amount being asked for, which follows the shortfall until the captain
 * names a figure of their own; the bills station owns the shortfall itself.
 */
export function HarborAid({
  game,
  aid,
  myUserId,
  shortfall,
  canAfford,
}: Pick<PhasePanelProps, "game" | "aid"> & {
  myUserId: string;
  /** What the bills come to beyond the purse, never below one Gold, read
      here as the starting figure for the ask. */
  shortfall: number;
  /** Whether the captain can cover the round at all. The ask draws only
      when they cannot. */
  canAfford: boolean;
}) {
  const myRequest = aid.requests.find((r) => r.fromUserId === myUserId);
  const otherRequests = aid.requests.filter((r) => r.fromUserId !== myUserId);
  // The ask starts at whatever covers the shortfall and keeps following it for
  // as long as the captain leaves it alone. A trade can land with this panel
  // open, and a completed one moves Gold as readily as goods, so the shortfall
  // worked out a moment ago is not necessarily the shortfall now. Following it
  // is what keeps the field honest. Once the captain names a figure of their
  // own that figure is theirs and a later recalculation does not overwrite it.
  // There is no clamp here, because asking for more than the shortfall is a
  // legitimate thing to want: a captain may be after a wider cushion than the
  // bills alone require, and the House is free to decline. See useLiveAmount.
  const { value: requestAmount, commit: commitRequestAmount } =
    useLiveAmount(shortfall);
  return (
    <>
      {!canAfford && (
        <div className="rounded-xl border border-alarm/30 bg-alarm/[0.04] p-3.5 my-3.5">
          <h3 className="font-semibold text-alarm mb-2 flex items-center gap-1.5">
            <HandCoins className="h-4 w-4" /> Short on Gold? Ask the Harbor for
            Help
          </h3>
          {myRequest ? (
            <div className="flex items-center justify-between text-sm bg-background/50 rounded-lg px-3 py-2">
              <span>
                🆘 Waiting for a captain to lend you{" "}
                <b>{myRequest.amount} Gold</b>…
              </span>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 px-2.5 text-[10px] rounded shrink-0"
                onClick={() => aid.cancel()}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Request</span>
              <QuantityInput
                value={requestAmount}
                onCommit={commitRequestAmount}
                min={1}
                aria-label="Loan amount to request"
                className="w-20 h-9"
              />
              <span className="text-muted-foreground">
                Gold from another captain
              </span>
              <Button
                size="sm"
                className="pm-grad-resolve rounded-lg"
                onClick={() => aid.post(requestAmount)}
              >
                🆘 Request Help
              </Button>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-2">
            A loan transfers instantly if someone helps. Repay it any time
            before the voyage ends, or it is deducted automatically at Round{" "}
            {game.maxRounds} and handed to them.
          </p>
        </div>
      )}

      {otherRequests.length > 0 && (
        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-background/50 p-3.5 my-3.5">
          <h3 className="font-semibold mb-2 text-sm">
            🆘 Captains Asking for Help
          </h3>
          <div className="space-y-1.5">
            {otherRequests.map((r) => {
              const canHelp = game.money >= r.amount;
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-xs border border-black/5 dark:border-white/10 bg-background/60 gap-2"
                >
                  <span>
                    <b>{r.fromName}</b> needs{" "}
                    <span className="text-alarm font-semibold">
                      {r.amount} Gold
                    </span>
                  </span>
                  <Button
                    size="sm"
                    className={cn(
                      "h-7 px-2.5 text-[10px] rounded shrink-0",
                      canHelp && "pm-grad-resolve",
                    )}
                    variant={canHelp ? "default" : "secondary"}
                    disabled={!canHelp}
                    onClick={() => aid.help(r.id)}
                  >
                    🤝 Lend {r.amount} Gold
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
