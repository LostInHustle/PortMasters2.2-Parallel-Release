"use client";

import { Handshake, Heart, Receipt } from "lucide-react";
import { cardByFlag, cardText } from "@/lib/game/cards";
import { t } from "@/lib/game/i18n";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { SummaryHeading } from "./PhaseShared";

// One line of the ledger: what it is, what it came to, and the hue its
// figure wears. Both columns and both blocks below are drawn from these.
type LedgerRow = {
  label: string;
  value: number;
  icon: string;
  tone: string;
};

// The two columns of the cash flow block: the same row, the same rule, and
// a sign in front of the figure. The heading's hue and the sign are the two
// things the sides decide.
function LedgerColumn({
  title,
  titleTone,
  rows,
  sign,
  empty,
}: {
  title: string;
  titleTone: string;
  rows: LedgerRow[];
  sign: string;
  empty: string;
}) {
  return (
    <div>
      <div className={cn("text-[10px] font-medium mb-1", titleTone)}>
        {title}
      </div>
      <div className="space-y-0.5">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between text-[11px]"
          >
            {/* One read for the whole line: the pack carries the glyph and
                the label as a single template, and the label arrives
                already read for this language. */}
            <span className="text-muted-foreground">
              {t("{r.icon} {r.label}", {
                "r.icon": r.icon,
                "r.label": t(r.label),
              })}
            </span>
            <span className={cn("font-semibold tabular-nums", r.tone)}>
              {sign}
              {r.value}
            </span>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="text-[10px] text-muted-foreground">{empty}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Financial Summary. A breakdown of the voyage's income and expenses,
 * shown at the end of a voyage so a captain can see where their Gold
 * came from and where it went.
 *
 * Income: totalRevenue (trade orders, gross of VAT), plus the boon Gold
 * the voyage was granted (game.boonGoldEarned, the Emergency Loan's grant
 * today).
 * Expenses: totalCosts (purchases, freight), wagesPaid,
 * maintenancePaid, finesPaid, vatPaid, incomeTaxPaid. The wage,
 * maintenance and fine rows read the voyage totals rather than the round
 * fields of the same name, which endRound has already cleared by the time
 * this sheet opens.
 *
 * The net figure should roughly track the final Gold minus the
 * starting Gold, though rounding and per round resets mean it is a
 * summary rather than a precise reconciliation.
 */
export function FinancialSummary({ game }: { game: GameState }) {
  // The income row names the boon that granted the Gold rather than
  // spelling it here, the way the pricing breakdowns name the source of
  // an adjustment: the record is where that name lives.
  const instantGold = cardByFlag("instant_gold");
  const income: LedgerRow[] = [
    {
      label: "Trade Revenue",
      value: game.totalRevenue,
      icon: "🤝",
      tone: "text-gain",
    },
    {
      // The figure is the voyage's own tally of the grants (see
      // boonGoldEarned in the state), not the round flag the grant wrote:
      // the flag is rebuilt away at every round's end, so this row used
      // to vanish from the closing sheet of every voyage that took the
      // loan before its final round.
      label: instantGold === null ? "Boon Gold" : cardText(instantGold).name,
      value: game.boonGoldEarned,
      icon: instantGold === null ? "💰" : instantGold.icon,
      tone: "text-due",
    },
  ].filter((r) => r.value > 0);

  const expenses: LedgerRow[] = [
    {
      label: "Purchases & Freight",
      value: game.totalCosts,
      icon: "📦",
      tone: "text-alarm",
    },
    {
      label: "Artisan Wages",
      value: game.wagesPaid,
      icon: "👥",
      tone: "text-due",
    },
    {
      label: "Ship Maintenance Fee",
      value: game.maintenancePaid,
      icon: "🔧",
      tone: "text-due",
    },
    {
      label: "Fines",
      value: game.finesPaid,
      icon: "🚨",
      tone: "text-alarm",
    },
    {
      label: "VAT Paid",
      value: game.vatPaid,
      icon: "🧾",
      tone: "text-alarm",
    },
    {
      label: "Income Tax",
      value: game.incomeTaxPaid,
      icon: "🏛️",
      tone: "text-alarm",
    },
  ].filter((r) => r.value > 0);

  const totalIncome = income.reduce((s, r) => s + r.value, 0);
  const totalExpenses = expenses.reduce((s, r) => s + r.value, 0);
  const net = totalIncome - totalExpenses;

  return (
    <div className="rounded-xl border border-border/40 bg-background/40 px-4 py-3 my-4 text-left">
      <SummaryHeading tone="text-muted-foreground">
        <Receipt className="h-3.5 w-3.5" />
        {t("Financial Summary")}
      </SummaryHeading>
      <div className="grid grid-cols-2 gap-3">
        {/* Income column */}
        <LedgerColumn
          title={t("Income")}
          titleTone="text-gain"
          rows={income}
          sign="+"
          empty={t("No income recorded")}
        />
        {/* Expenses column */}
        <LedgerColumn
          title={t("Expenses")}
          titleTone="text-alarm"
          rows={expenses}
          sign="-"
          empty={t("No expenses recorded")}
        />
      </div>
      {/* Net total */}
      <div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-between">
        <span className="text-xs font-semibold">{t("Net Cash Flow")}</span>
        <span
          className={cn(
            "font-display text-sm font-bold tabular-nums",
            net >= 0 ? "text-gain" : "text-alarm",
          )}
        >
          {net >= 0 ? "+" : ""}
          {t("{contract.fee} Gold", { "contract.fee": net })}
        </span>
      </div>
    </div>
  );
}

// The two sides of the peer economy, in the same tile, in the hue of the
// direction the Gold moved. Written out twice before, once for lending and
// once for borrowing, with nothing but the hue and the two words differing.
const ECONOMY_TONES = {
  gain: {
    tile: "rounded-lg bg-gain/5 border border-gain/10 p-2.5",
    ink: "text-gain",
  },
  due: {
    tile: "rounded-lg bg-due/5 border border-due/10 p-2.5",
    ink: "text-due",
  },
} as const;

function EconomyTile({
  tone,
  label,
  amount,
  note,
}: {
  tone: keyof typeof ECONOMY_TONES;
  label: string;
  amount: React.ReactNode;
  note: React.ReactNode;
}) {
  return (
    <div className={ECONOMY_TONES[tone].tile}>
      <div
        className={cn("text-[10px] font-medium mb-1", ECONOMY_TONES[tone].ink)}
      >
        {label}
      </div>
      <div
        className={cn(
          "font-display text-lg font-bold",
          ECONOMY_TONES[tone].ink,
        )}
      >
        {amount}
        <span className="text-[10px] font-normal text-muted-foreground ml-0.5">
          {t("Gold")}
        </span>
      </div>
      {note && (
        <div className="text-[10px] text-muted-foreground mt-0.5">{note}</div>
      )}
    </div>
  );
}

/**
 * Peer Economy Summary. Shows the captain's lending and borrowing
 * activity across the voyage: total Gold lent, total Gold borrowed,
 * loans still outstanding, and the Reputation earned from helping
 * other captains (lending and backing combined, subject to the helper
 * reputation cap).
 */
export function PeerEconomySummary({ game }: { game: GameState }) {
  const loansGiven = game.loansGiven;
  const debts = game.debts;
  const totalLent = loansGiven.reduce((s, l) => s + l.amount, 0);
  const totalBorrowed = debts.reduce((s, l) => s + l.amount, 0);
  const outstandingLent = loansGiven.length;
  const outstandingBorrowed = debts.length;
  const helperRep = game.helperReputationEarned;

  // Only show if there was any peer economy activity
  if (totalLent === 0 && totalBorrowed === 0 && helperRep === 0) return null;

  return (
    <div className="rounded-xl border border-intel/20 bg-intel/[0.03] px-4 py-3 my-3 text-left">
      <SummaryHeading tone="text-intel">
        <Handshake className="h-3.5 w-3.5" />
        {t("Peer Economy")}
      </SummaryHeading>
      <div className="grid grid-cols-2 gap-3">
        {/* Lending */}
        <EconomyTile
          tone="gain"
          label={t("Lending")}
          amount={totalLent}
          note={
            outstandingLent > 0
              ? t("{outstandingLent} loan{pluralS} still out", {
                  outstandingLent,
                  pluralS: outstandingLent === 1 ? "" : "s",
                })
              : null
          }
        />
        {/* Borrowing */}
        <EconomyTile
          tone="due"
          label={t("Borrowing")}
          amount={totalBorrowed}
          note={
            outstandingBorrowed > 0
              ? t("{outstandingBorrowed} loan{pluralS} still owed", {
                  outstandingBorrowed,
                  pluralS: outstandingBorrowed === 1 ? "" : "s",
                })
              : null
          }
        />
      </div>
      {helperRep > 0 && (
        <div className="mt-2 pt-2 border-t border-intel/10 flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground flex items-center gap-1">
            <Heart className="h-3 w-3" />
            {t("Helper Reputation earned")}
          </span>
          <span className="font-bold text-favor">
            {t("+{rep} Rep", { rep: Math.round(helperRep) })}
          </span>
        </div>
      )}
      {game.defaultedDebt && (
        <div className="mt-1.5 text-[10px] text-alarm font-medium">
          {t("Loan defaulted, no Renown banked this voyage.")}
        </div>
      )}
    </div>
  );
}
