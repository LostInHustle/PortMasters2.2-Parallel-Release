"use client";

import { useState } from "react";
import { QuantityInput } from "@/components/ui/quantity-input";
import { t } from "@/lib/game/i18n";
import { Term } from "../../Term";
import { type PhasePanelProps } from "./PhaseShared";
import {
  SettlementDesk,
  SettlementDeskAction,
  SettlementDeskRow,
} from "./SettlementDesk";

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
  // Only a loan neither side of, and not already
  // backed by someone else, is actually mine to back.
  const backableLoans = backing.loans.filter(
    (l) => l.borrowerId !== myUserId && l.lenderId !== myUserId && !l.backerId,
  );
  const [backAmounts, setBackAmounts] = useState<Record<string, number>>({});

  if (backableLoans.length === 0) return null;

  return (
    <SettlementDesk
      title={t("🛡️ Loans You Could Back")}
      note={
        <>
          {t("Pledged Gold is")} <Term term="Escrow">{t("escrowed")}</Term>{" "}
          {t(
            "now, only spent if the loan actually defaults, up to what you pledged. Never called on? It all comes back, plus a small Reputation bonus.",
          )}
        </>
      }
    >
      {backableLoans.map((l) => {
        // Both ends of the range are held by the field itself: it
        // clamps to max={l.amount} before it commits, and the value
        // it takes over from is l.amount to begin with, so there is
        // nothing left for a clamp to do here.
        const pledge = backAmounts[l.debtId] ?? l.amount;
        const canBack = game.money >= pledge;
        return (
          <SettlementDeskRow key={l.debtId} wrap>
            <span>
              <b>{l.lenderName}</b> {t("lent")} <b>{l.borrowerName}</b>{" "}
              <span className="text-alarm font-semibold">
                {t("{contract.fee} Gold", { "contract.fee": l.amount })}
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
                aria-label={t(
                  "Gold to pledge backing {l.lenderName}'s loan to {l.borrowerName}",
                  {
                    "l.lenderName": l.lenderName,
                    "l.borrowerName": l.borrowerName,
                  },
                )}
                className="w-16 h-7"
              />
              <SettlementDeskAction
                label={t("🛡️ Back {pledge} Gold", { pledge })}
                available={canBack}
                onClick={() => backing.offer(l.debtId, pledge)}
              />
            </div>
          </SettlementDeskRow>
        );
      })}
    </SettlementDesk>
  );
}
