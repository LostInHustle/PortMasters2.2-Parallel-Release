"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Trophy,
  Coins,
  Crown,
  Skull,
  Receipt,
  Handshake,
  Heart,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { BROKERS_FAVOR_UNLOCK_LEVEL } from "@/lib/game/constants";
import { merchantRatingForScore } from "@/lib/game/engine";
import { meritById } from "@/lib/game/merits";
import { flatWorkerRoster, type GameState } from "@/lib/game/types";
import type { CaptainLegacySummary } from "@/lib/game/legacy";
import type { RivalEntry, VoyageResult } from "@/types/realtime";
import { cn } from "@/lib/utils";
import { Avatar, MeritIcon } from "../../shared";
import { CaptainLegacyCard } from "../../CaptainLegacyCard";
import type { PhasePanelProps } from "./PhaseShared";

// The head to head line the Legacy card draws when both captains are in
// the room. The account has one rivalry list (see /api/rivals), so this
// picks out the partners who sailed this voyage rather than asking for a
// named one. A rivalry with someone who is elsewhere is real, but it says
// nothing about the voyage just finished, so it stays off the card.
function useRivalHere(
  myUserId: string,
  voyageResult: VoyageResult | null | undefined,
): RivalEntry | null {
  const [rivals, setRivals] = useState<RivalEntry[]>([]);

  // The other captains in this voyage, as a set, so the match below is one
  // lookup per rival rather than one scan per rival.
  const partnerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of voyageResult?.standings ?? [])
      if (s.userId !== myUserId) ids.add(s.userId);
    return ids;
  }, [voyageResult, myUserId]);

  useEffect(() => {
    // Nothing to look up until the standings land, so the request waits
    // for them rather than firing an unanswerable one on first paint.
    if (partnerIds.size === 0) return;
    let cancelled = false;
    api
      .listRivals()
      .then((res) => {
        if (!cancelled) setRivals(res.rivals ?? []);
      })
      // A failed read just leaves the line off the card. This is a record
      // of the voyage just sailed, and a rivalry line is a nice extra on
      // it, never something worth showing an error state over.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [partnerIds]);

  // The list arrives newest meeting first, so a captain who has sailed
  // against two of the same partners gets the one they met most recently.
  return rivals.find((r) => partnerIds.has(r.partner.id)) ?? null;
}

type EndgameProps = Pick<
  PhasePanelProps,
  "game" | "phaseSync" | "me" | "room"
> & {
  // The dispatcher in GamePhasePanel only spreads PhasePanelProps in, so
  // these three are wired by the parent (GameRoom) when it renders the
  // Endgame phase: voyageResult is the harbor wide standings payload the
  // server emits on voyage:complete, myLegacy is the captain's post voyage
  // CaptainLegacySummary, and onRestart is the host's "restart voyage"
  // handler. All three are optional so the Endgame panel still renders a
  // sane waiting state when the parent hasn't wired them through yet.
  voyageResult?: VoyageResult | null;
  myLegacy?: CaptainLegacySummary | null;
  onRestart?: () => void;
};

export function Endgame({
  game,
  me,
  room,
  voyageResult,
  myLegacy,
  onRestart,
}: EndgameProps) {
  const myUserId = me.id;
  const isHost = me.id === room.hostId;
  // Mirrors the same rank shown in the Captain's Ledger (see
  // merchantRatingForScore in engine.ts). Checks defaultedDebt first, the
  // one case a plain score lookup can't capture on its own.
  let rating: string;
  if (game.defaultedDebt) {
    rating = "💥 Bankrupt: Defaulted on a Loan";
  } else {
    const r = merchantRatingForScore(game.score);
    rating = `${r.icon} ${r.label}`;
  }
  const mine = voyageResult?.standings.find((s) => s.userId === myUserId);
  const rival = useRivalHere(myUserId, voyageResult);
  return (
    <div className="max-w-md mx-auto text-center py-4">
      <div className="text-2xl font-bold mb-4 font-display pm-text-sea pm-brush">
        🎮 Game Over!
      </div>
      <div className="text-xl font-bold text-teal-700 dark:text-teal-300 my-3 flex items-center justify-center gap-2">
        <Trophy className="h-5 w-5" />
        Final Reputation: {game.score}
      </div>
      <div className="text-lg text-emerald-600 dark:text-emerald-400 my-2 flex items-center justify-center gap-2">
        <Coins className="h-5 w-5" />
        Final Funds: {game.money} Gold
      </div>
      <div className="text-lg text-amber-600 dark:text-amber-400 my-4">
        📈 Merchant Rank: {rating}
      </div>

      {/* Financial Summary */}
      <FinancialSummary game={game} />

      {/* Peer Economy Summary */}
      <PeerEconomySummary game={game} />

      {/* Crew Management Summary */}
      <CrewSummary game={game} />

      {voyageResult ? (
        <div className="space-y-3 mb-5 text-left">
          {mine?.crowned && (
            <div className="rounded-xl border-2 border-amber-400 bg-amber-400/10 px-4 py-3 text-center">
              <div className="text-lg font-bold text-amber-600 dark:text-amber-300 flex items-center justify-center gap-2">
                <Crown className="h-5 w-5" /> Crowned Sea Master!
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Highest Reputation in this harbor&apos;s voyage.
              </div>
            </div>
          )}
          {mine?.brokersFavorUnlocked && (
            <div className="rounded-xl border-2 border-violet-400 bg-violet-400/10 px-4 py-3 text-center">
              <div className="text-lg font-bold text-violet-600 dark:text-violet-300 flex items-center justify-center gap-2">
                🤝 Broker&apos;s Favor Unlocked!
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Renown Level {BROKERS_FAVOR_UNLOCK_LEVEL} reached. Starting next
                voyage, call one in from the Trade Manifest to summon a
                guaranteed buyer.
              </div>
            </div>
          )}
          {mine?.newMerits.map((meritId) => {
            const merit = meritById(meritId);
            if (!merit) return null;
            return (
              <div
                key={meritId}
                className="rounded-xl border-2 border-amber-400 bg-amber-400/10 px-4 py-3 text-center"
              >
                <div className="text-lg font-bold text-amber-600 dark:text-amber-300 flex items-center justify-center gap-2">
                  <MeritIcon id={merit.id} className="h-5 w-5" /> Captain&apos;s
                  Merit: {merit.name}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {merit.desc}
                </div>
              </div>
            );
          })}
          <div className="rounded-xl border border-black/5 dark:border-white/10 overflow-hidden">
            <div className="px-3 py-2 text-xs font-semibold bg-black/[0.03] dark:bg-white/[0.05]">
              🏁 Final Standings
            </div>
            <div className="divide-y divide-black/5 dark:divide-white/10">
              {voyageResult.standings.map((s, i) => (
                <div
                  key={s.userId}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm",
                    s.userId === myUserId && "bg-teal-500/[0.06]",
                  )}
                >
                  <span className="text-xs text-muted-foreground w-4 shrink-0">
                    {i + 1}
                  </span>
                  <Avatar hue={s.avatarHue} name={s.displayName} size={22} />
                  <span className="flex-1 truncate font-medium">
                    {s.displayName}
                  </span>
                  {s.crowned && (
                    <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  )}
                  {s.bankrupt && (
                    <Skull className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  )}
                  <span className="text-xs text-muted-foreground shrink-0">
                    {s.reputation} Rep.
                  </span>
                </div>
              ))}
            </div>
          </div>

          {myLegacy && (
            <div>
              {mine && (
                <div className="text-xs text-center text-muted-foreground mb-1.5">
                  +{mine.xpGained} Renown XP this voyage
                  {mine.leveledUp ? " · Renown level up!" : ""}
                </div>
              )}
              <CaptainLegacyCard
                legacy={myLegacy}
                rival={
                  rival
                    ? {
                        displayName: rival.partner.displayName,
                        meetings: rival.meetings,
                        // The route projects the viewer as position "a", so
                        // its wins are this captain's and its losses are the
                        // partner's (see /api/rivals).
                        myWins: rival.wins,
                        theirWins: rival.losses,
                        ties: rival.ties,
                      }
                    : null
                }
              />
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground mb-5">
          ⏳ Waiting on the rest of the harbor to finish their voyage before Sea
          Master is crowned…
        </div>
      )}

      {isHost ? (
        <Button
          className="pm-grad-primary text-white rounded-xl px-8"
          onClick={onRestart}
          disabled={!onRestart}
        >
          🔄 Restart Voyage
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Waiting for the host to restart the voyage…
        </p>
      )}
    </div>
  );
}

/**
 * Financial Summary. A breakdown of the voyage's income and expenses,
 * shown at the end of a voyage so a captain can see where their Gold
 * came from and where it went.
 *
 * Income: totalRevenue (trade orders), plus any emergency loan boon
 * Gold if it was taken. Expenses: totalCosts (purchases, transport),
 * workerWages, maintenanceCosts, vatPaid, incomeTaxPaid.
 *
 * The net figure should roughly track the final Gold minus the
 * starting Gold, though rounding and per round resets mean it is a
 * summary rather than a precise reconciliation.
 */
function FinancialSummary({ game }: { game: GameState }) {
  const income = [
    {
      label: "Trade Revenue",
      value: game.totalRevenue,
      icon: "🤝",
      tone: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Emergency Loan",
      value: game.modifierFlags?.instant_gold ?? 0,
      icon: "💰",
      tone: "text-amber-600 dark:text-amber-400",
    },
  ].filter((r) => r.value > 0);

  const expenses = [
    {
      label: "Purchases & Transport",
      value: game.totalCosts,
      icon: "📦",
      tone: "text-rose-600 dark:text-rose-400",
    },
    {
      label: "Worker Wages",
      value: game.workerWages,
      icon: "👥",
      tone: "text-orange-600 dark:text-orange-400",
    },
    {
      label: "Ship Maintenance",
      value: game.maintenanceCosts,
      icon: "🔧",
      tone: "text-orange-600 dark:text-orange-400",
    },
    {
      label: "VAT Paid",
      value: game.vatPaid,
      icon: "🧾",
      tone: "text-rose-600 dark:text-rose-400",
    },
    {
      label: "Income Tax",
      value: game.incomeTaxPaid,
      icon: "🏛️",
      tone: "text-rose-600 dark:text-rose-400",
    },
  ].filter((r) => r.value > 0);

  const totalIncome = income.reduce((s, r) => s + r.value, 0);
  const totalExpenses = expenses.reduce((s, r) => s + r.value, 0);
  const net = totalIncome - totalExpenses;

  return (
    <div className="rounded-xl border border-border/40 bg-background/40 px-4 py-3 my-4 text-left">
      <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
        <Receipt className="h-3.5 w-3.5" />
        Financial Summary
      </div>
      <div className="grid grid-cols-2 gap-3">
        {/* Income column */}
        <div>
          <div className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mb-1">
            Income
          </div>
          <div className="space-y-0.5">
            {income.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between text-[11px]"
              >
                <span className="text-muted-foreground">
                  {r.icon} {r.label}
                </span>
                <span className={cn("font-semibold tabular-nums", r.tone)}>
                  +{r.value}
                </span>
              </div>
            ))}
            {income.length === 0 && (
              <div className="text-[10px] text-muted-foreground/50">
                No income recorded
              </div>
            )}
          </div>
        </div>
        {/* Expenses column */}
        <div>
          <div className="text-[10px] font-medium text-rose-600 dark:text-rose-400 mb-1">
            Expenses
          </div>
          <div className="space-y-0.5">
            {expenses.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between text-[11px]"
              >
                <span className="text-muted-foreground">
                  {r.icon} {r.label}
                </span>
                <span className={cn("font-semibold tabular-nums", r.tone)}>
                  -{r.value}
                </span>
              </div>
            ))}
            {expenses.length === 0 && (
              <div className="text-[10px] text-muted-foreground/50">
                No expenses recorded
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Net total */}
      <div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-between">
        <span className="text-xs font-semibold">Net Cash Flow</span>
        <span
          className={cn(
            "font-display text-sm font-bold tabular-nums",
            net >= 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400",
          )}
        >
          {net >= 0 ? "+" : ""}
          {net} Gold
        </span>
      </div>
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
function PeerEconomySummary({ game }: { game: GameState }) {
  const loansGiven = game.loansGiven ?? [];
  const debts = game.debts ?? [];
  const totalLent = loansGiven.reduce((s, l) => s + l.amount, 0);
  const totalBorrowed = debts.reduce((s, l) => s + l.amount, 0);
  const outstandingLent = loansGiven.length;
  const outstandingBorrowed = debts.length;
  const helperRep = game.helperReputationEarned ?? 0;

  // Only show if there was any peer economy activity
  if (totalLent === 0 && totalBorrowed === 0 && helperRep === 0) return null;

  return (
    <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.03] px-4 py-3 my-3 text-left">
      <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-1.5">
        <Handshake className="h-3.5 w-3.5" />
        Peer Economy
      </div>
      <div className="grid grid-cols-2 gap-3">
        {/* Lending */}
        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-2.5">
          <div className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300 mb-1">
            Lending
          </div>
          <div className="font-display text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {totalLent}
            <span className="text-[10px] font-normal text-muted-foreground ml-0.5">
              Gold
            </span>
          </div>
          {outstandingLent > 0 && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {outstandingLent} loan{outstandingLent === 1 ? "" : "s"} still out
            </div>
          )}
        </div>
        {/* Borrowing */}
        <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-2.5">
          <div className="text-[10px] font-medium text-amber-700 dark:text-amber-300 mb-1">
            Borrowing
          </div>
          <div className="font-display text-lg font-bold text-amber-600 dark:text-amber-400">
            {totalBorrowed}
            <span className="text-[10px] font-normal text-muted-foreground ml-0.5">
              Gold
            </span>
          </div>
          {outstandingBorrowed > 0 && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {outstandingBorrowed} loan{outstandingBorrowed === 1 ? "" : "s"}{" "}
              still owed
            </div>
          )}
        </div>
      </div>
      {helperRep > 0 && (
        <div className="mt-2 pt-2 border-t border-indigo-500/10 flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground flex items-center gap-1">
            <Heart className="h-3 w-3" />
            Helper Reputation earned
          </span>
          <span className="font-bold text-indigo-600 dark:text-indigo-400">
            +{Math.round(helperRep)} Rep
          </span>
        </div>
      )}
      {game.defaultedDebt && (
        <div className="mt-1.5 text-[10px] text-rose-500 font-medium">
          Loan defaulted, no Renown banked this voyage.
        </div>
      )}
    </div>
  );
}

/**
 * Crew Management Summary. Shows worker productivity stats at voyage
 * end: total workers hired, how many reached skilled status, total
 * items produced, and the wages paid.
 */
function CrewSummary({ game }: { game: GameState }) {
  const allWorkers = flatWorkerRoster(game);
  const totalHired = allWorkers.length;
  const skilledCount = allWorkers.filter((w) => w.isSkilled).length;
  const totalWages = game.workerWages ?? 0;

  // Estimate total items produced from worker producedCount
  const totalProduced = allWorkers.reduce(
    (s, w) => s + (w.producedCount ?? 0),
    0,
  );

  if (totalHired === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] px-4 py-3 my-3 text-left">
      <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5" />
        Crew Summary
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center rounded-lg bg-black/5 dark:bg-white/5 p-2">
          <div className="font-display text-lg font-bold text-amber-600 dark:text-amber-400">
            {totalHired}
          </div>
          <div className="text-[9px] text-muted-foreground">Workers Hired</div>
        </div>
        <div className="text-center rounded-lg bg-black/5 dark:bg-white/5 p-2">
          <div className="font-display text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {skilledCount}
          </div>
          <div className="text-[9px] text-muted-foreground">Skilled</div>
        </div>
        <div className="text-center rounded-lg bg-black/5 dark:bg-white/5 p-2">
          <div className="font-display text-lg font-bold text-teal-600 dark:text-teal-400">
            {totalProduced}
          </div>
          <div className="text-[9px] text-muted-foreground">Items Made</div>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-amber-500/10 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Total Wages Paid</span>
        <span className="font-bold text-orange-600 dark:text-orange-400">
          {totalWages} Gold
        </span>
      </div>
    </div>
  );
}
