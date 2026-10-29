"use client";

import { t } from "@/lib/game/i18n";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Term } from "../../Term";
import { PanelLabel, stateInk } from "../../shared";
import { loanSettleLine } from "../phases/SettlementAid";
import { PanelTotal } from "../phases/PhasePanels";
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
  atHarbor,
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
  atHarbor: boolean;
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
          <Row
            label={
              <Term term="Maintenance">{t("🔧 Ship Maintenance Fee")}</Term>
            }
          >
            <b>{t("{contract.fee} Gold", { "contract.fee": pendMaint })}</b>
          </Row>
          <Row
            label={
              <Term term="Wages">
                👥 {t("Wages")}
                {workerCount > 0
                  ? t(" ({count} artisans)", { count: workerCount })
                  : ""}
              </Term>
            }
          >
            <b>
              {workerCount > 0
                ? t("{contract.fee} Gold", { "contract.fee": pendWages })
                : "…"}
            </b>
          </Row>
          {roster
            .filter((r) => r.due > 0)
            .map((r) => (
              <SubRow
                key={r.id}
                label={t("↳ {r.list.length}× {r.label}", {
                  "r.list.length": r.list.length,
                  "r.label": t(r.label),
                })}
                value={t("{r.due} Gold", { "r.due": r.due })}
              />
            ))}
          <PanelTotal
            tone={safe ? "border-gain/20" : "border-alarm/30"}
            className="mt-1"
            label={
              <span className="text-xs font-semibold">{t("💸 Total Due")}</span>
            }
          >
            <span className={cn("font-bold", stateInk(safe))}>
              {t("{contract.fee} Gold", { "contract.fee": pendTotal })}
            </span>
          </PanelTotal>
          {safe ? (
            <div className="mt-1.5 text-center text-[10px] text-gain">
              {t("✅ Enough Gold for round end")}
            </div>
          ) : (
            <div className="mt-1.5 rounded-md bg-alarm/5 py-1 text-center text-[10px] text-alarm">
              {t("🚨 Risk: Gold may fall short at round end!")}
            </div>
          )}
        </>
      ) : atHarbor ? (
        <p className="py-2 text-[11px] text-muted-foreground">
          {t("Nothing is owed until the voyage is under way.")}
        </p>
      ) : null}

      {hasLoans && (
        <div className="mt-3 border-t border-black/5 pt-2 dark:border-white/10">
          <PanelLabel tone="text-muted-foreground" className="mb-1">
            {t("━━ Outstanding Loans ━━")}
          </PanelLabel>
          {debts.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-1.5 py-0.5"
            >
              <span className="text-[12px] text-muted-foreground">
                {t("You owe")}{" "}
                <b className="text-foreground">{d.counterpartyName}</b>
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-[12px] font-bold text-alarm">
                  {t("{contract.fee} Gold", { "contract.fee": d.amount })}
                </span>
                {onRepayLoan && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-6 rounded px-2 text-[10px]"
                    disabled={money < d.amount}
                    onClick={() => onRepayLoan(d.id)}
                  >
                    {t("Repay")}
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
                  {t("Owed by")} <b>{l.counterpartyName}</b>
                </span>
              }
            >
              <span className="font-bold text-gain">
                {t("{contract.fee} Gold", { "contract.fee": l.amount })}
              </span>
            </Row>
          ))}
          <p className="pt-1 text-[10px] text-muted-foreground">
            {loanSettleLine(maxRounds)}
          </p>
        </div>
      )}
    </>
  );
}
