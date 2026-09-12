"use client";

import { useState } from "react";
import {
  COMMODITIES,
  CONVOY_VENTURE_MAX_CONTRIBUTOR_SHARE,
  CONVOY_VENTURE_MAX_ROUNDS_AHEAD,
  CONVOY_VENTURE_MAX_TARGET,
  CONVOY_VENTURE_MIN_ROUNDS_AHEAD,
  CONVOY_VENTURE_MIN_TARGET,
  PRODUCT_PRICES,
} from "@/lib/game/constants";
import { getHireCost } from "@/lib/game/engine";
import type { GameState } from "@/lib/game/types";
import { difficultyConfig } from "@/lib/game/difficulty";
import {
  unlockedProducts,
  unlockedResources,
  unlockedWorkerTypes,
} from "@/lib/game/pools";
import type { ConvoyVenture } from "@/lib/use-convoy";
import { cn } from "@/lib/utils";
import { itemColorResolver } from "@/lib/use-color-preference";
import { Term } from "../Term";
import { VoyageTimeline } from "./VoyageTimeline";
import { priceAwareTermContent } from "./PriceTooltips";
import { GameLogPanel } from "./GameLogPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ItemIcon } from "../shared";
import { Coins } from "lucide-react";

/**
 * The captain's own rail.
 *
 * This used to be five sections stacked in a single narrow column (Captain's
 * Log, Vessel Status, Cargo Hold, Outstanding Loans, Round End Obligations)
 * with the ledger dropped underneath all of it. In a rail roughly 260px wide
 * that is unavoidably a long vertical scroll, and the ledger, which a captain
 * consults constantly, sat furthest from the eye.
 *
 * So the handful of numbers that are checked every few seconds (round, waters,
 * funds, reputation, and what is owed at round end) are pinned at the top and
 * never scroll, and everything else is a tab. Each tab is short enough to read
 * without scrolling in the common case and scrolls inside its own box when it
 * is not, so the page itself never grows. The ledger becomes a peer tab rather
 * than a footnote below the fold.
 *
 * The pinned "Due" figure carries the safe/short tone, because that is the one
 * number that decides whether a captain is about to go bankrupt, and it should
 * be readable without opening anything.
 */
export function GameStatusPanel({
  game,
  logs,
  onRepayLoan,
  convoy,
  myUserId,
  colorFor,
}: {
  game: GameState;
  logs: string[];
  onRepayLoan?: (debtId: string) => void;
  convoy?: {
    ventures: ConvoyVenture[];
    locked: boolean;
    error: string | null;
    clearError: () => void;
    post: (targetGold: number, deadlineRound: number) => void;
    contribute: (ventureId: string, amount: number) => void;
  };
  myUserId?: string;
  colorFor?: (item: string) => string | undefined;
}) {
  const resolveColor = itemColorResolver(colorFor);
  const discount = game.shipLevel * 5;
  const showObligations = ![0, 5, "endgame", "bankruptcy"].includes(game.phase);

  // Summed across the whole unlocked roster, not the three founding types.
  const roster = unlockedWorkerTypes(game.difficulty, game.currentRound).map(
    (w) => {
      const list = game.workers[w.id] ?? [];
      return { ...w, list, due: list.length * getHireCost(game, w.id) };
    },
  );
  const pendWages = roster.reduce((sum, r) => sum + r.due, 0);
  const pendMaint = game.fixedCost + game.maintenancePenalty;
  const pendTotal = pendWages + pendMaint;
  const safe = game.money >= pendTotal;
  const nW = roster.reduce((sum, r) => sum + r.list.length, 0);
  const cfg = difficultyConfig(game.difficulty);
  const hasLoans = game.debts.length > 0 || game.loansGiven.length > 0;
  const duesAlert = (showObligations && !safe) || game.debts.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Pinned: never scrolls, so the numbers a captain checks constantly
          are always in the same place. */}
      <div className="shrink-0">
        <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            {/* Voyage progress ring */}
            {(() => {
              const progress = Math.min(1, game.currentRound / game.maxRounds);
              const radius = 8;
              const circumference = 2 * Math.PI * radius;
              const offset = circumference * (1 - progress);
              return (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  className="shrink-0"
                >
                  <circle
                    cx="10"
                    cy="10"
                    r={radius}
                    fill="none"
                    className="stroke-black/10 dark:stroke-white/10"
                    strokeWidth="2"
                  />
                  <circle
                    cx="10"
                    cy="10"
                    r={radius}
                    fill="none"
                    className="stroke-celadon"
                    strokeWidth="2"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform="rotate(-90 10 10)"
                    style={{ transition: "stroke-dashoffset 0.5s ease" }}
                  />
                </svg>
              );
            })()}
            Voyage{" "}
            <b className="text-foreground">
              {game.currentRound}/{game.maxRounds}
            </b>
          </span>
          <span className="pm-truncate text-foreground" title={cfg.name}>
            {cfg.icon} {cfg.name}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Stat
            label="Funds"
            value={`${game.money}`}
            className="text-gold-ink"
          />
          <Stat
            label="Reputation"
            value={`${game.score}`}
            className="text-favor"
          />
          {showObligations ? (
            <Stat
              label="Due"
              value={`${pendTotal}`}
              className={cn(safe ? "text-foreground" : "text-alarm")}
            />
          ) : (
            <Stat
              label="Ship"
              value={`Lv ${game.shipLevel}`}
              className="text-sea"
            />
          )}
        </div>
        <VoyageTimeline
          currentRound={game.currentRound}
          maxRounds={game.maxRounds}
          phase={game.phase}
          className="mt-2"
        />
      </div>

      <Tabs
        defaultValue="hold"
        className="mt-2.5 flex min-h-0 flex-1 flex-col gap-2"
      >
        <TabsList className="grid w-full shrink-0 grid-cols-4">
          <TabsTrigger value="hold" className="text-[11px]">
            Hold
          </TabsTrigger>
          <TabsTrigger value="ship" className="text-[11px]">
            Ship
          </TabsTrigger>
          <TabsTrigger value="dues" className="text-[11px]">
            Dues
            {duesAlert && (
              <span
                className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-alarm"
                aria-label="attention needed"
              />
            )}
          </TabsTrigger>
          <TabsTrigger value="log" className="text-[11px]">
            Ledger
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="hold"
          className="pm-scroll min-h-0 flex-1 overflow-y-auto"
        >
          {/* Cargo Value Estimator */}
          {(() => {
            let totalValue = 0;
            let totalItems = 0;
            for (const item of Object.keys(game.inventory)) {
              const qty = game.inventory[item] || 0;
              if (qty <= 0) continue;
              const range =
                COMMODITIES[item]?.basePrice ?? PRODUCT_PRICES[item];
              if (range) {
                const avg = (range[0] + range[1]) / 2;
                totalValue += avg * qty;
                totalItems += qty;
              }
            }
            totalValue = Math.round(totalValue);
            if (totalItems === 0) return null;
            return (
              <div className="mb-2 rounded-lg border border-ship/15 bg-ship/[0.04] px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Coins className="h-3 w-3 text-gold-ink" />
                  Hold Value
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {totalItems} items
                  </span>
                  <span className="font-display text-sm font-bold text-gold-ink tabular-nums">
                    ~{totalValue}g
                  </span>
                </div>
              </div>
            );
          })()}
          <div className="text-[10px] font-semibold tracking-wide text-muted-foreground mb-0.5">
            ━━ Raw Materials ━━
          </div>
          {unlockedResources(game.difficulty, game.currentRound).map((r) => (
            <InvItem
              key={r}
              icon={<ItemIcon item={r} className="h-3.5 w-3.5" />}
              name={r}
              color={resolveColor(r)}
              count={game.inventory[r] || 0}
              priceContent={priceAwareTermContent(game, r)}
            />
          ))}
          <div className="text-[10px] font-semibold tracking-wide text-muted-foreground mt-2 mb-0.5">
            ━━ Finished Goods ━━
          </div>
          {unlockedProducts(game.difficulty, game.currentRound).map((r) => (
            <InvItem
              key={r}
              icon={<ItemIcon item={r} className="h-3.5 w-3.5" />}
              name={r}
              color={resolveColor(r)}
              count={game.inventory[r] || 0}
              priceContent={priceAwareTermContent(game, r)}
            />
          ))}
          {nW > 0 ? (
            <>
              <div className="text-[10px] font-semibold tracking-wide text-muted-foreground mt-2 mb-0.5">
                ━━ Artisans ━━
              </div>
              {roster
                .filter((r) => r.list.length > 0)
                .map((r) => (
                  <InvItem
                    key={r.id}
                    icon={r.icon}
                    name={r.plural}
                    term={r.label}
                    count={r.list.length}
                    skilled={r.list.filter((x) => x.isSkilled).length}
                    muted
                  />
                ))}
            </>
          ) : null}
          {/* Cargo composition bar */}
          {(() => {
            const rawCount = unlockedResources(
              game.difficulty,
              game.currentRound,
            ).reduce((s, r) => s + (game.inventory[r] || 0), 0);
            const productCount = unlockedProducts(
              game.difficulty,
              game.currentRound,
            ).reduce((s, p) => s + (game.inventory[p] || 0), 0);
            const total = rawCount + productCount;
            if (total === 0) return null;
            const rawPct = Math.round((rawCount / total) * 100);
            const productPct = 100 - rawPct;
            return (
              <div className="mt-2 rounded-lg border border-border/30 bg-black/[0.02] p-2 dark:bg-white/[0.02]">
                <div className="mb-1 flex items-center justify-between text-[9px] text-muted-foreground">
                  <span>Cargo Composition</span>
                  <span>{total} items</span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div
                    className="bg-sea transition-all duration-300"
                    style={{ width: `${rawPct}%` }}
                    title={`Raw Materials: ${rawCount} (${rawPct}%)`}
                  />
                  <div
                    className="bg-warn transition-all duration-300"
                    style={{ width: `${productPct}%` }}
                    title={`Finished Goods: ${productCount} (${productPct}%)`}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[9px]">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-sea" />
                    <span className="text-muted-foreground">
                      Raw {rawCount}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground">
                      Products {productCount}
                    </span>
                    <span className="inline-block h-2 w-2 rounded-full bg-warn" />
                  </span>
                </div>
              </div>
            );
          })()}
        </TabsContent>

        <TabsContent
          value="ship"
          className="pm-scroll min-h-0 flex-1 overflow-y-auto"
        >
          <Row label={<Term term="Ship Level">Class</Term>}>
            <b>Level {game.shipLevel}</b>
          </Row>
          <Row label={<Term term="Freight">Freight</Term>}>
            <span className="text-[10px] text-muted-foreground">
              max(5, n×2 minus {discount})
            </span>
          </Row>
          <Row label="Modules">
            <b>
              {game.equippedModules.length}/{game.shipLevel}
            </b>
          </Row>
          {game.equippedModules.length === 0 ? (
            <p className="pt-1 text-[10px] text-muted-foreground">
              No modules installed. Upgrade the ship in the Shipyard to unlock
              slots.
            </p>
          ) : (
            game.equippedModules.map((m) => (
              <div key={m.id} className="py-0.5 text-[11px]">
                <span className="mr-1">{m.icon}</span>
                <span className="text-foreground">{m.name}</span>
                <div className="pl-5 text-[10px] text-muted-foreground">
                  {m.desc}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent
          value="dues"
          className="pm-scroll min-h-0 flex-1 overflow-y-auto"
        >
          {showObligations ? (
            <>
              <Row label={<Term term="Maintenance">🔧 Maintenance</Term>}>
                <b>{pendMaint} Gold</b>
              </Row>
              <Row
                label={
                  <Term term="Wages">
                    👥 Wages{nW > 0 ? ` (${nW} workers)` : ""}
                  </Term>
                }
              >
                <b>{nW > 0 ? `${pendWages} Gold` : "…"}</b>
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
              {game.debts.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-1.5 py-0.5"
                >
                  <span className="text-[12px] text-muted-foreground">
                    You owe{" "}
                    <b className="text-foreground">{d.counterpartyName}</b>
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
                        disabled={game.money < d.amount}
                        onClick={() => onRepayLoan(d.id)}
                      >
                        Repay
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {game.loansGiven.map((l) => (
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
                Unpaid loans settle automatically at the end of Round{" "}
                {game.maxRounds}.
              </p>
            </div>
          )}

          {convoy && myUserId && (
            <ConvoyVenturesSection
              game={game}
              convoy={convoy}
              myUserId={myUserId}
            />
          )}
        </TabsContent>

        <TabsContent value="log" className="min-h-0 flex-1">
          <GameLogPanel logs={logs} embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg bg-black/[0.03] px-2 py-1.5 text-center dark:bg-white/[0.05]">
      <div className={cn("text-[15px] font-bold leading-tight", className)}>
        {value}
      </div>
      <div className="text-[9px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{children}</span>
    </div>
  );
}

function SubRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5 pl-3 text-[10px] text-muted-foreground">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// [MANIFEST 04: Convoy Ventures] Lives in the Dues tab, right beside
// Outstanding Loans, since both are peer to peer Gold commitments a captain
// is tracking against the rest of the harbor.
function ConvoyVenturesSection({
  game,
  convoy,
  myUserId,
}: {
  game: GameState;
  convoy: {
    ventures: ConvoyVenture[];
    locked: boolean;
    error: string | null;
    clearError: () => void;
    post: (targetGold: number, deadlineRound: number) => void;
    contribute: (ventureId: string, amount: number) => void;
  };
  myUserId: string;
}) {
  const [target, setTarget] = useState("");
  const [roundsAhead, setRoundsAhead] = useState(
    String(CONVOY_VENTURE_MIN_ROUNDS_AHEAD),
  );
  const [contributions, setContributions] = useState<Record<string, string>>(
    {},
  );

  const maxRoundsAhead = Math.min(
    CONVOY_VENTURE_MAX_ROUNDS_AHEAD,
    game.maxRounds - 1 - game.currentRound,
  );
  const tooLateToPost = maxRoundsAhead < CONVOY_VENTURE_MIN_ROUNDS_AHEAD;

  function submitPost() {
    const t = Math.floor(Number(target));
    const r = Math.floor(Number(roundsAhead));
    if (!Number.isFinite(t) || !Number.isFinite(r)) return;
    convoy.post(t, game.currentRound + r);
    setTarget("");
    setRoundsAhead(String(CONVOY_VENTURE_MIN_ROUNDS_AHEAD));
  }

  function submitContribute(ventureId: string) {
    const raw = contributions[ventureId];
    const amount = Math.floor(Number(raw));
    if (!Number.isFinite(amount) || amount <= 0) return;
    convoy.contribute(ventureId, amount);
    setContributions((c) => ({ ...c, [ventureId]: "" }));
  }

  return (
    <div className="mt-3 border-t border-black/5 pt-2 dark:border-white/10">
      <div className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground">
        ━━ Convoy Ventures ━━
      </div>

      {convoy.error && (
        <div className="mb-1.5 rounded bg-alarm/5 px-2 py-1 text-[10px] text-alarm">
          {convoy.error}
        </div>
      )}

      {convoy.locked ? (
        <p className="mb-2 rounded bg-black/[0.03] px-2 py-1.5 text-[10px] text-muted-foreground dark:bg-white/[0.04]">
          This harbor has already used its one Convoy Venture for this voyage.
          It opens again on a fresh voyage or a restart.
        </p>
      ) : tooLateToPost ? (
        <p className="mb-2 rounded bg-black/[0.03] px-2 py-1.5 text-[10px] text-muted-foreground dark:bg-white/[0.04]">
          Too late in this voyage to post a new Convoy Venture: there is no
          round left that would leave time to spend the reward.
        </p>
      ) : (
        <>
          <div className="mb-2 flex items-end gap-1.5">
            <div className="flex-1">
              <label className="mb-0.5 block text-[9px] text-muted-foreground">
                Target Gold
              </label>
              <Input
                type="number"
                min={CONVOY_VENTURE_MIN_TARGET}
                max={CONVOY_VENTURE_MAX_TARGET}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={`${CONVOY_VENTURE_MIN_TARGET}+`}
                className="h-7 text-[11px]"
              />
            </div>
            <div className="flex-1">
              <label className="mb-0.5 block text-[9px] text-muted-foreground">
                Rounds to fill
              </label>
              <Input
                type="number"
                min={CONVOY_VENTURE_MIN_ROUNDS_AHEAD}
                max={maxRoundsAhead}
                value={roundsAhead}
                onChange={(e) => setRoundsAhead(e.target.value)}
                className="h-7 text-[11px]"
              />
            </div>
            <Button
              size="sm"
              className="h-7 rounded px-2 text-[10px]"
              onClick={submitPost}
            >
              Post
            </Button>
          </div>

          {game.currentRound + Number(roundsAhead || 0) > 0 && (
            <p className="mb-2 text-[9px] text-muted-foreground">
              Fills by Round{" "}
              {game.currentRound + (Math.floor(Number(roundsAhead)) || 0)}. Miss
              it and every contributor only gets back a partial refund. This
              harbor only gets one venture per voyage, so make it count.
            </p>
          )}
        </>
      )}

      {convoy.ventures.length === 0 ? (
        <p className="py-1 text-[11px] text-muted-foreground">
          {convoy.locked
            ? "No ventures open. This voyage's one chance has already been used."
            : "No ventures open right now. Post one, or wait for another captain to."}
        </p>
      ) : (
        <div className="space-y-2">
          {convoy.ventures.map((v) => {
            const pct = Math.min(
              100,
              Math.round((v.total / v.targetGold) * 100),
            );
            const mine = v.contributions.find((c) => c.userId === myUserId);
            const myShareCap = Math.ceil(
              v.targetGold * CONVOY_VENTURE_MAX_CONTRIBUTOR_SHARE,
            );
            const myRemainingShare = myShareCap - (mine?.amount ?? 0);
            const atMyShareCap = myRemainingShare <= 0;
            return (
              <div
                key={v.id}
                className="rounded-lg border border-black/5 bg-black/[0.02] p-2 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">
                    {v.posterId === myUserId ? "Your venture" : v.posterName}
                  </span>
                  <span className="font-semibold">
                    {v.total} / {v.targetGold}g
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-sea"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground">
                  <span>By Round {v.deadlineRound}</span>
                  {mine && <span>You have backed {mine.amount}g</span>}
                </div>
                {atMyShareCap ? (
                  <p className="mt-1.5 text-[9px] text-muted-foreground">
                    You have backed this as much as any single captain can. It
                    needs another captain to fund the rest.
                  </p>
                ) : (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      max={myRemainingShare}
                      value={contributions[v.id] ?? ""}
                      onChange={(e) =>
                        setContributions((c) => ({
                          ...c,
                          [v.id]: e.target.value,
                        }))
                      }
                      placeholder="Gold"
                      className="h-6 text-[10px]"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-6 shrink-0 rounded px-2 text-[10px]"
                      onClick={() => submitContribute(v.id)}
                    >
                      Back it
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InvItem({
  icon,
  name,
  term,
  color,
  count,
  muted,
  skilled,
  priceContent,
}: {
  icon: React.ReactNode;
  name: string;
  term?: string;
  color?: string;
  count: number;
  muted?: boolean;
  skilled?: number;
  priceContent?: React.ReactNode;
}) {
  return (
    <div className="flex items-center py-0.5 text-[11px]">
      <span className="mr-1.5 inline-flex items-center text-[14px]">
        {icon}
      </span>
      <span className="flex-1" style={{ color: muted ? undefined : color }}>
        <Term term={term ?? name} content={priceContent}>
          {name}
        </Term>
      </span>
      {skilled !== undefined && skilled > 0 && (
        <span
          className="mr-1.5 text-[10px] text-warn"
          title={`${skilled} of ${count} trained: each produces 2 per round`}
        >
          ⭐{skilled}
        </span>
      )}
      <span
        className="min-w-[30px] text-right font-bold"
        style={{ color: muted ? undefined : color }}
      >
        {count}
      </span>
    </div>
  );
}
