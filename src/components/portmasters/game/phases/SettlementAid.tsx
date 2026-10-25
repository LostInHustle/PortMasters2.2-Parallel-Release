"use client";

import { Button } from "@/components/ui/button";
import { QuantityInput } from "@/components/ui/quantity-input";
import { t } from "@/lib/game/i18n";
import { useLiveAmount } from "@/lib/use-live-amount";
import { HandCoins } from "lucide-react";
import { type PhasePanelProps } from "./PhaseShared";
import {
  SettlementDesk,
  SettlementDeskAction,
  SettlementDeskRow,
} from "./SettlementDesk";

/**
 * What happens to a loan nobody repays, as the one sentence every surface
 * that shows a loan renders: the ask this desk posts, the list of asks
 * beside it, and the Dues tab on the rail. The round is the voyage's own
 * last one, read off maxRounds, so the sentence names the round this voyage
 * settles on rather than a figure typed in beside it, and the borrower and
 * the lender read one wording of one rule. The sentence reads through the
 * pack here, at the composer all three surfaces share, so the wording and
 * the language stay one answer.
 */
export function loanSettleLine(maxRounds: number): string {
  return t(
    "Unpaid loans settle automatically at the end of Round {maxRounds}, and the Gold goes to the lender.",
    { maxRounds },
  );
}

/**
 * The shortfall desk: the ask this captain may post when the bills are
 * beyond the purse, and the asks the rest of the harbor has posted. It owns
 * the amount being asked for, which follows the shortfall until the captain
 * names a figure of their own; the bills station owns the shortfall itself.
 *
 * A one-captain harbor (a Solo Practice Voyage, or a table nobody else
 * joined) has no one who could answer the ask: the lending side of the
 * desk would be a button that can only fail, so the desk is replaced by
 * the one sentence that is true alone (see the `alone` prop).
 */
export function HarborAid({
  game,
  aid,
  myUserId,
  shortfall,
  canAfford,
  alone,
}: Pick<PhasePanelProps, "game" | "aid"> & {
  myUserId: string;
  /** What the bills come to beyond the purse, never below one Gold, read
      here as the starting figure for the ask. */
  shortfall: number;
  /** Whether the captain can cover the round at all. The ask draws only
      when they cannot. */
  canAfford: boolean;
  /** Whether every other seat in the harbor is empty. The ask is not
      drawn at all when it is: there is no captain to answer it. */
  alone: boolean;
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
            <HandCoins className="h-4 w-4" />
            {alone
              ? t("Short on Gold?")
              : t("Short on Gold? Ask the Harbor for Help")}
          </h3>
          {alone && (
            <p className="text-sm text-muted-foreground">
              {t(
                "No other captain is aboard, so there is no one to lend. The bills must be settled alone: Force Payment below covers what the purse holds, and the shortfall is the risk it names.",
              )}
            </p>
          )}
          {!alone &&
            (myRequest ? (
              <div className="flex items-center justify-between text-sm bg-background/50 rounded-lg px-3 py-2">
                <span>
                  {t(
                    "🆘 Waiting for a captain to lend you {myRequest.amount} Gold…",
                    { "myRequest.amount": myRequest.amount },
                  )}
                </span>
                <SettlementDeskAction
                  label={t("Cancel")}
                  destructive
                  onClick={() => aid.cancel()}
                />
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t("Request")}</span>
                <QuantityInput
                  value={requestAmount}
                  onCommit={commitRequestAmount}
                  min={1}
                  aria-label={t("Loan amount to request")}
                  className="w-20 h-9"
                />
                <span className="text-muted-foreground">
                  {t("Gold from another captain")}
                </span>
                <Button
                  size="sm"
                  className="pm-grad-resolve rounded-lg"
                  onClick={() => aid.post(requestAmount)}
                >
                  {t("🆘 Request Help")}
                </Button>
              </div>
            ))}
          {!alone && (
            <p className="text-[11px] text-muted-foreground mt-2">
              {t(
                "A loan transfers instantly if someone helps. Repay it any time before the voyage ends. {loanDue}",
                { loanDue: loanSettleLine(game.maxRounds) },
              )}
            </p>
          )}
        </div>
      )}

      {otherRequests.length > 0 && (
        <SettlementDesk
          title={t("🆘 Captains Asking for Help")}
          note={loanSettleLine(game.maxRounds)}
        >
          {otherRequests.map((r) => {
            const canHelp = game.money >= r.amount;
            return (
              <SettlementDeskRow key={r.id}>
                <span>
                  {/* The name is the captain's own, so the sentence reads
                      plain: React escapes whatever arrives in {fromName}. */}
                  {t("{fromName} needs {amount} Gold", {
                    fromName: r.fromName,
                    amount: r.amount,
                  })}
                </span>
                <SettlementDeskAction
                  label={t("🤝 Lend {amount} Gold", { amount: r.amount })}
                  available={canHelp}
                  onClick={() => aid.help(r.id)}
                />
              </SettlementDeskRow>
            );
          })}
        </SettlementDesk>
      )}
    </>
  );
}
