"use client";

import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Term } from "../../Term";
import { Row, SubRow } from "./Rows";
import type { RosterEntry } from "../GameStatusPanel";

/**
 * The Dues tab: what this captain owes at the round end, broken down by the
 * crew the wages are owed to, and then the loans in both directions, the
 * ones taken and the ones given. Before the voyage is under way there is
 * nothing to settle, and the tab says so rather than printing a row of
 * zeroes.
 */
export function DuesTab({
  showObligations,
  workerCount,
  pendWages,
  pendMaint,
  pendTotal,
  safe,
  roster,
  debts,
  loansGiven,
  money,
  maxRounds,
  onRepayLoan,
}: {
  showObligations: boolean;
  workerCount: number;
  pendWages: number;
  pendMaint: number;
  pendTotal: number;
  safe: boolean;
  roster: RosterEntry[];
  debts: GameState["debts"];
  loansGiven: GameState["loansGiven"];
  money: number;
  maxRounds: number;
  onRepayLoan?: (debtId: string) => void;
}) {
  const hasLoans = debts.length > 0 || loansGiven.length > 0;
  return (
    <>
      {showObligations ? (
        <>
          <Row label={<Term term="Maintenance">🔧 Maintenance</Term>}>
            <b>{pendMaint} Gold</b>
          </Row>
          <Row
            label={
              <Term term="Wages">
                👥 Wages{workerCount > 0 ? ` (${workerCount} workers)` : ""}
              </Term>
            }
          >
            <b>{workerCount > 0 ? `${pendWages} Gold` : "…"}</b>
          </Row>
          {roster
            .filter((r) => r.due > 0)
            .map((r) => (
              <SubRow
                key={r.id}
                label={`↳ ${r.list.length}× ${r.label}`}
                value={`${r.due}g`}
              />
            ))}
          <div
            className={cn(
              "mt-1 flex items-center justify-between border-t pt-2",
              safe ? "border-gain/20" : "border-alarm/30",
            )}
          >
            <span className="text-xs font-semibold">💸 Total Due</span>
            <span
              className={cn("font-bold", safe ? "text-gain" : "text-alarm")}
            >
              {pendTotal} Gold
            </span>
          </div>
          {safe ? (
            <div className="mt-1.5 text-center text-[10px] text-gain">
              ✅ Funds sufficient for round end
            </div>
          ) : (
            <div className="mt-1.5 rounded-md bg-alarm/5 py-1 text-center text-[10px] text-alarm">
              🚨 Risk: Funds may fall short at round end!
            </div>
          )}
        </>
      ) : (
        <p className="py-2 text-[11px] text-muted-foreground">
          Nothing is owed until the voyage is under way.
        </p>
      )}

      {hasLoans && (
        <div className="mt-3 border-t border-black/5 pt-2 dark:border-white/10">
          <div className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground">
            ━━ Outstanding Loans ━━
          </div>
          {debts.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-1.5 py-0.5"
            >
              <span className="text-[12px] text-muted-foreground">
                You owe <b className="text-foreground">{d.counterpartyName}</b>
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-[12px] font-bold text-alarm">
                  {d.amount}g
                </span>
                {onRepayLoan && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-6 rounded px-2 text-[10px]"
                    disabled={money < d.amount}
                    onClick={() => onRepayLoan(d.id)}
                  >
                    Repay
                  </Button>
                )}
              </div>
            </div>
          ))}
          {loansGiven.map((l) => (
            <Row
              key={l.id}
              label={
                <span>
                  Owed by <b>{l.counterpartyName}</b>
                </span>
              }
            >
              <span className="font-bold text-gain">{l.amount}g</span>
            </Row>
          ))}
          <p className="pt-1 text-[10px] text-muted-foreground">
            Unpaid loans settle automatically at the end of Round {maxRounds}.
          </p>
        </div>
      )}
    </>
  );
}
