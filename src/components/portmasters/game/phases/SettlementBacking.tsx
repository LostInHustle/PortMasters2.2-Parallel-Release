"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { QuantityInput } from "@/components/ui/quantity-input";
import { cn } from "@/lib/utils";
import { Term } from "../../Term";
import { type PhasePanelProps } from "./PhaseShared";

/**
 * The backing desk: the loans already posted by two other captains that
 * this one could stand behind. It owns the pledges being drafted, because
 * nothing outside the desk reads them.
 */
export function LoanBacking({
  game,
  backing,
  myUserId,
}: Pick<PhasePanelProps, "game" | "backing"> & { myUserId: string }) {
  // [MANIFEST 05: Backing] Only a loan neither side of, and not already
  // backed by someone else, is actually mine to back.
  const backableLoans = backing.loans.filter(
    (l) => l.borrowerId !== myUserId && l.lenderId !== myUserId && !l.backerId,
  );
  const [backAmounts, setBackAmounts] = useState<Record<string, number>>({});

  if (backableLoans.length === 0) return null;

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-background/50 p-3.5 my-3.5">
      <h3 className="font-semibold mb-2 text-sm">🛡️ Loans You Could Back</h3>
      <div className="space-y-1.5">
        {backableLoans.map((l) => {
          // Both ends of the range are held by the field itself: it
          // clamps to max={l.amount} before it commits, and the value
          // it takes over from is l.amount to begin with, so there is
          // nothing left for a clamp to do here.
          const pledge = backAmounts[l.debtId] ?? l.amount;
          const canBack = game.money >= pledge;
          return (
            <div
              key={l.debtId}
              className="flex flex-wrap items-center justify-between rounded-md px-3 py-2 text-xs border border-black/5 dark:border-white/10 bg-background/60 gap-2"
            >
              <span>
                <b>{l.lenderName}</b> lent <b>{l.borrowerName}</b>{" "}
                <span className="text-alarm font-semibold">
                  {l.amount} Gold
                </span>
              </span>
              <div className="flex items-center gap-1.5">
                <QuantityInput
                  value={pledge}
                  onCommit={(v) =>
                    setBackAmounts((prev) => ({ ...prev, [l.debtId]: v }))
                  }
                  min={1}
                  max={l.amount}
                  aria-label={`Gold to pledge backing ${l.lenderName}'s loan to ${l.borrowerName}`}
                  className="w-16 h-7"
                />
                <Button
                  size="sm"
                  className={cn(
                    "h-7 px-2.5 text-[10px] rounded shrink-0",
                    canBack && "pm-grad-resolve",
                  )}
                  variant={canBack ? "default" : "secondary"}
                  disabled={!canBack}
                  onClick={() => backing.offer(l.debtId, pledge)}
                >
                  🛡️ Back {pledge} Gold
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">
        Pledged Gold is <Term term="Escrow">escrowed</Term> now, only spent if
        the loan actually defaults, up to what you pledged. Never called on? It
        all comes back, plus a small Reputation bonus.
      </p>
    </div>
  );
}
