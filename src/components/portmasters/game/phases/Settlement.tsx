"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { QuantityInput } from "@/components/ui/quantity-input";
import { WORKER_TYPES } from "@/lib/game/constants";
import { difficultyConfig, roundsFor } from "@/lib/game/difficulty";
import {
  escortCost,
  finishSettlement,
  getHireCost,
  hireEscort,
  pirateChance,
  resolvePirateAttack,
} from "@/lib/game/engine";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, HandCoins, ShieldCheck, Skull, X } from "lucide-react";
import { ReadyBar } from "../ReadyBar";
import { type PhasePanelProps } from "./PhaseShared";

function PirateAttack({
  game,
  act,
}: {
  game: GameState;
  act: (fn: (g: GameState, logs: string[]) => void) => void;
}) {
  // Both figures come straight from the engine, off the same two functions
  // the charge itself goes through (see hireEscort and resolvePirateAttack).
  // The panel used to rebuild each one by hand and had drifted away from
  // them: the odds left out the Escort Pact and the Persian Dome Compass,
  // and the fee left out the Pact, so a captain was quoted a risk and a
  // price that were not the ones on offer.
  const escortFee = escortCost(game);
  const raidPct = Math.round(pirateChance(game) * 100);
  // Read only to explain the note below. The leak is already inside the
  // figure above, so this tells the captain why the odds look as high as
  // they do rather than showing a second, separate number.
  const leak = game.brokerTippedPirates
    ? difficultyConfig(game.difficulty).brokerCorruptionRisk
    : 0;
  return (
    <div className="max-w-xl mx-auto text-center py-4">
      <div className="text-5xl mb-2">🏴‍☠️</div>
      <div className="text-2xl font-bold mb-1 font-display pm-text-sea pm-brush">
        Pirate Waters Ahead
      </div>
      <div className="mb-5 space-y-2">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Before this round&apos;s bills come due, your ship has to clear open
          water. There is a {raidPct}% chance pirates find you and take every
          coin in your hold. Hire an escort to sail through safely, or risk it
          and save the Gold.
        </p>
        {leak > 0 && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            🕵️ A corrupt broker leaked your position this round, so the odds
            above are already raised.
          </p>
        )}
      </div>

      {/* Risk Assessment */}
      <div className="max-w-md mx-auto mb-4 rounded-xl border border-border/40 bg-background/40 p-3.5">
        <div className="text-[10px] font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          Risk Assessment
        </div>
        <div className="grid grid-cols-3 gap-2">
          {/* Raid probability */}
          <div className="text-center rounded-lg bg-black/5 dark:bg-white/5 p-2">
            <div
              className={cn(
                "font-display text-lg font-bold tabular-nums",
                raidPct >= 30
                  ? "text-rose-600 dark:text-rose-400"
                  : raidPct >= 20
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {raidPct}%
            </div>
            <div className="text-[9px] text-muted-foreground">Raid Chance</div>
          </div>
          {/* Gold at risk */}
          <div className="text-center rounded-lg bg-black/5 dark:bg-white/5 p-2">
            <div className="font-display text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums">
              {game.money}
            </div>
            <div className="text-[9px] text-muted-foreground">Gold at Risk</div>
          </div>
          {/* Expected loss */}
          <div className="text-center rounded-lg bg-black/5 dark:bg-white/5 p-2">
            <div className="font-display text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              {Math.round((game.money * raidPct) / 100)}
            </div>
            <div className="text-[9px] text-muted-foreground">
              Expected Loss
            </div>
          </div>
        </div>
        {/* Recommendation */}
        {(() => {
          const expectedLoss = (game.money * raidPct) / 100;
          const recommend = escortFee < expectedLoss && game.money > 0;
          if (!recommend) return null;
          return (
            <div className="mt-2 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[10px] text-emerald-700 dark:text-emerald-300">
              Escort costs {escortFee}g but expected loss is{" "}
              {Math.round(expectedLoss)}g. Hiring the escort saves Gold on
              average.
            </div>
          );
        })()}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
        <Button
          size="lg"
          className="pm-grad-primary text-white rounded-xl h-14"
          onClick={() => act((g, l) => hireEscort(g, l))}
        >
          <ShieldCheck className="h-5 w-5 mr-2" /> Hire Escort ({escortFee}{" "}
          Gold)
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="rounded-xl h-14"
          onClick={() => act((g, l) => resolvePirateAttack(g, l))}
        >
          <Skull className="h-5 w-5 mr-2" /> Set Sail Anyway
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground mt-3">
        Escort cost scales with your current Gold ({game.money}), so it is
        cheapest exactly when you have the least to lose.
      </p>
    </div>
  );
}

function SettlementBills({
  game,
  act,
  aid,
  backing,
  me,
  phaseSync,
  members,
}: Pick<
  PhasePanelProps,
  "game" | "act" | "aid" | "backing" | "me" | "phaseSync" | "members"
>) {
  const myUserId = me.id;
  // One pass over the whole roster, deliberately mirroring payWages in
  // engine.ts rather than listing artisans by hand. This screen used to total
  // only the three founding types, so once a charter opened a Coppersmith,
  // Potter, Perfumer or Jeweler, the bill shown here was lower than the bill
  // actually charged a moment later. That also silently gated the aid request
  // below, since canAfford decides whether it appears at all: a captain who
  // genuinely could not pay was told they could, never got the chance to ask
  // the harbor for help, and went bankrupt anyway.
  const roster = WORKER_TYPES.map((w) => (game.workers[w.id] ?? []).length);
  const wagesDue = WORKER_TYPES.reduce(
    (sum, w, i) => sum + roster[i] * getHireCost(game, w.id),
    0,
  );
  const nWorkers = roster.reduce((sum, n) => sum + n, 0);
  const maintCost = game.fixedCost + game.maintenancePenalty;
  const totalDue = wagesDue + maintCost;
  const canAfford = game.money >= totalDue;
  const balanceAfter = game.money - totalDue;

  const myRequest = aid.requests.find((r) => r.fromUserId === myUserId);
  const otherRequests = aid.requests.filter((r) => r.fromUserId !== myUserId);
  const shortfall = Math.max(1, totalDue - game.money);
  const [requestAmount, setRequestAmount] = useState(shortfall);

  // [MANIFEST 05: Backing] Only a loan neither side of, and not already
  // backed by someone else, is actually mine to back.
  const backableLoans = backing.loans.filter(
    (l) => l.borrowerId !== myUserId && l.lenderId !== myUserId && !l.backerId,
  );
  const [backAmounts, setBackAmounts] = useState<Record<string, number>>({});

  // The two Settle Bills variants. Calm (canAfford) is the jade "pay the
  // bills" button a captain reaches for at the end of a normal round. The
  // force pay variant is the destructive call: the captain cannot cover
  // wages plus maintenance, has either no open aid request or no captain
  // willing to back them in time, and is about to go bankrupt the moment
  // they confirm. A vermilion gradient plus an AlertTriangle icon and a
  // "Force Payment and Risk Bankruptcy" label front loads the consequence
  // so it cannot be mistaken for the calm variant, which used to share the
  // same amber stripe and could be tapped by reflex.
  const settleLabel = canAfford
    ? `💸 Settle Bills: ${totalDue} Gold`
    : `Force Payment and Risk Bankruptcy (${game.money}/${totalDue} Gold)`;
  const settleClassName = canAfford
    ? "pm-grad-jade text-white h-12 px-8"
    : "pm-grad-vermilion text-white h-12 px-8 font-semibold";
  const settleIcon = canAfford ? null : <AlertTriangle className="h-4 w-4" />;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-2xl font-bold text-center mb-4 font-display pm-text-sea pm-brush">
        🔧 Phase 3: Round Settlement
      </div>

      {game.pirateAttackResolved && (
        <div
          className={cn(
            "rounded-xl border p-3 my-3.5 text-center text-sm",
            game.escortHired
              ? "border-teal-500/20 bg-teal-500/[0.04]"
              : "border-black/10 dark:border-white/10 bg-background/40",
          )}
        >
          {game.escortHired
            ? "🛡️ Escort hired, you sailed through safely this round."
            : "🌊 You sailed without an escort this round."}
        </div>
      )}

      <div className="rounded-xl bg-amber-500/[0.06] border border-amber-500/20 p-3.5 my-3.5">
        <h3 className="font-semibold text-orange-700 dark:text-orange-300 mb-2">
          ⏳ Bills Due This Round
        </h3>
        <div className="flex justify-between text-[13px] py-0.5">
          <span>
            👥 Worker Wages ({nWorkers} worker{nWorkers !== 1 ? "s" : ""})
          </span>
          <span className="font-bold">{wagesDue} Gold</span>
        </div>
        <div className="flex justify-between text-sm py-0.5">
          <span>🔧 Ship Maintenance Fee</span>
          <span className="font-bold">{maintCost} Gold</span>
        </div>
        {game.maintenancePenalty > 0 && (
          <div className="text-[11px] text-muted-foreground pl-2.5">
            ↳ Base {game.fixedCost}g + Overdrive Engine penalty{" "}
            {game.maintenancePenalty}g
          </div>
        )}
        <div className="flex justify-between text-sm py-0.5 border-t border-orange-500/20 pt-1.5 mt-1.5 font-bold">
          <span>💸 Total Due</span>
          <span className="text-orange-600 dark:text-orange-400">
            {totalDue} Gold
          </span>
        </div>
      </div>

      <div className="rounded-xl bg-teal-500/[0.04] border border-teal-500/15 p-3.5 my-3.5">
        <h3 className="font-semibold mb-2">💹 Balance Summary</h3>
        <div className="flex justify-between text-[13px] py-0.5">
          <span>Current Funds</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
            {game.money} Gold
          </span>
        </div>
        <div className="flex justify-between text-[13px] py-0.5">
          <span>After Settlement</span>
          <span
            className={cn(
              "font-bold",
              balanceAfter >= 0
                ? "text-teal-700 dark:text-teal-300"
                : "text-rose-600 dark:text-rose-400",
            )}
          >
            {balanceAfter} Gold
          </span>
        </div>
        <div className="flex justify-between text-[13px] py-0.5">
          <span>Round Revenue</span>
          <span className="text-emerald-600 dark:text-emerald-400">
            +{game.roundRevenue} Gold
          </span>
        </div>
      </div>

      {!canAfford && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.04] p-3.5 my-3.5">
          <h3 className="font-semibold text-rose-700 dark:text-rose-300 mb-2 flex items-center gap-1.5">
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
                onCommit={setRequestAmount}
                min={1}
                aria-label="Loan amount to request"
                className="w-20 h-9"
              />
              <span className="text-muted-foreground">
                Gold from another captain
              </span>
              <Button
                size="sm"
                className="pm-grad-primary text-white rounded-lg"
                onClick={() => aid.post(requestAmount)}
              >
                🆘 Request Help
              </Button>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-2">
            A loan transfers instantly if someone helps. Repay it any time
            before the voyage ends, or it is deducted automatically at Round{" "}
            {roundsFor(game.difficulty)} and handed to them.
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
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">
                      {r.amount} Gold
                    </span>
                  </span>
                  <Button
                    size="sm"
                    className={cn(
                      "h-7 px-2.5 text-[10px] rounded shrink-0",
                      canHelp && "pm-grad-jade text-white",
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

      {backableLoans.length > 0 && (
        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-background/50 p-3.5 my-3.5">
          <h3 className="font-semibold mb-2 text-sm">
            🛡️ Loans You Could Back
          </h3>
          <div className="space-y-1.5">
            {backableLoans.map((l) => {
              const pledge = Math.min(
                backAmounts[l.debtId] ?? l.amount,
                l.amount,
              );
              const canBack = game.money >= pledge && pledge >= 1;
              return (
                <div
                  key={l.debtId}
                  className="flex flex-wrap items-center justify-between rounded-md px-3 py-2 text-xs border border-black/5 dark:border-white/10 bg-background/60 gap-2"
                >
                  <span>
                    <b>{l.lenderName}</b> lent <b>{l.borrowerName}</b>{" "}
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">
                      {l.amount} Gold
                    </span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <QuantityInput
                      value={pledge}
                      onCommit={(v) =>
                        setBackAmounts((prev) => ({
                          ...prev,
                          [l.debtId]: Math.min(v, l.amount),
                        }))
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
                        canBack && "pm-grad-jade text-white",
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
            Pledged Gold is escrowed now, only spent if the loan actually
            defaults, up to what you pledged. Never called on? It all comes
            back, plus a small Reputation bonus.
          </p>
        </div>
      )}

      {backing.error && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/25 px-3.5 py-2 mb-3.5 text-xs text-rose-600 dark:text-rose-300 flex items-center justify-between">
          <span>⚠️ {backing.error}</span>
          <button onClick={backing.clearError} aria-label="Dismiss error">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {aid.error && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/25 px-3.5 py-2 mb-3.5 text-xs text-rose-600 dark:text-rose-300 flex items-center justify-between">
          <span>⚠️ {aid.error}</span>
          <button onClick={aid.clearError} aria-label="Dismiss error">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* The destructive Force Pay variant needs an inline icon, which the
          shared ReadyFooter does not accept (its idleLabel is a plain
          string). Rather than widen the shared footer's API for one screen,
          we inline the same waiting/idle structure here so the vermilion
          AlertTriangle button stays visually distinct from the jade Settle
          Bills button on the calm path. */}
      {phaseSync.waiting ? (
        <div className="mt-5 space-y-3 text-center">
          <div className="text-sm font-medium text-amber-700 dark:text-amber-300">
            Waiting for the rest of the crew
          </div>
          <ReadyBar
            ready={phaseSync.ready}
            members={members}
            className="justify-center"
          />
          <Button
            variant="secondary"
            className="rounded-xl"
            onClick={phaseSync.cancelReady}
          >
            Not ready yet
          </Button>
        </div>
      ) : (
        <div className="mt-5 text-center">
          <Button
            className={cn("rounded-xl px-6", settleClassName)}
            onClick={() =>
              phaseSync.markReady((g, l) => finishSettlement(g, l))
            }
          >
            {settleIcon}
            <span className="ml-1.5">{settleLabel}</span>
          </Button>
        </div>
      )}
    </div>
  );
}

export function Settlement({
  game,
  act,
  aid,
  backing,
  me,
  phaseSync,
  members,
}: Pick<
  PhasePanelProps,
  "game" | "act" | "aid" | "backing" | "me" | "phaseSync" | "members"
>) {
  if (!game.pirateAttackResolved) return <PirateAttack game={game} act={act} />;
  return (
    <SettlementBills
      game={game}
      act={act}
      aid={aid}
      backing={backing}
      me={me}
      phaseSync={phaseSync}
      members={members}
    />
  );
}
