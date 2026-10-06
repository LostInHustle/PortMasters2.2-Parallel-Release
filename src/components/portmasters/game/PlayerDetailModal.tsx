"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cardText } from "@/lib/game/cards";
import type { Difficulty } from "@/lib/game/difficulty";
import {
  unlockedProducts,
  unlockedResources,
  unlockedWorkerTypes,
} from "@/lib/game/pools";
import type { PlayerDetailData } from "@/lib/use-player-detail";
import type { PublicUser } from "@/lib/api";
import type { CaptainLegacySummary } from "@/lib/game/legacy";
import { phaseLabel } from "@/lib/game/engine";
import { SKILLED_LEGEND } from "@/lib/game/status-copy";
import { cn } from "@/lib/utils";
import { itemColorResolver } from "@/lib/use-color-preference";
import { Avatar, Pill, ItemIcon } from "../shared";
import { workerStatusLine } from "./phases/WorkerList";
import { FoldRow } from "./FoldRow";
import { CaptainLegacyCard } from "../CaptainLegacyCard";
import { CloseFooter } from "./CloseFooter";
import { Coins, Trophy, Ship, Loader2, Eye } from "lucide-react";

// One stat, its own tile instead of a pill sharing a row with three
// others. Reused for every number the profile leads with (Gold,
// Reputation, Ship Level), so a future stat is one more tile, not a
// rework of a cramped row.
function ProfileStatTile({
  icon,
  value,
  label,
  toneClassName,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  toneClassName: string;
}) {
  return (
    <div className="rounded-lg bg-black/[0.03] dark:bg-white/[0.05] py-2 text-center">
      <div
        className={cn(
          "text-sm font-semibold flex items-center justify-center gap-1",
          toneClassName,
        )}
      >
        {icon} {value}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

/**
 * One line of a captain's cargo: the good's icon, its name in the good's
 * own colour, and the count the popup was told. One component rather than
 * one row under Raw Materials and another under Finished Goods, because
 * the two lists are the same kind of thing and their rows should not be
 * two chances to drift.
 *
 * The colour is resolved by the caller rather than looked up here, because
 * the resolver comes from the viewer's own colour preference and belongs to
 * the screen rather than to a row of it. It is allowed to be absent, which
 * is the resolver's own answer for a good it has no colour for: the name
 * then draws in the panel's text colour.
 */
function CargoRow({
  item,
  count,
  color,
}: {
  item: string;
  count: number;
  color: string | undefined;
}) {
  return (
    <div className="flex items-center text-[12px] py-0.5">
      <ItemIcon item={item} className="mr-1.5 h-3.5 w-3.5" />
      <span className="flex-1" style={{ color }}>
        {item}
      </span>
      <b style={{ color }}>{count}</b>
    </div>
  );
}

/**
 * The "click a collapsed roster bar, see everything" popup. Doubles as a
 * bankrupt captain's spectator window. There's no separate read only
 * board, watching the rest of the room just means opening their popups.
 *
 * Laid out as a profile: the standings first (an identity header, the
 * headline figures, the comparison against your own seat and the legacy
 * card), and the reference half (cargo, workers, modules and the log)
 * folded behind them. The figures a captain opens this to compare are
 * readable without a press, and the lists they might look up are one
 * press away.
 */
export function PlayerDetailModal({
  open,
  onOpenChange,
  player,
  isMe,
  detail,
  loading,
  legacy,
  difficulty,
  colorFor,
  myDetail,
  myPlayer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  player: PublicUser | null;
  isMe: boolean;
  detail: PlayerDetailData | null | undefined;
  loading: boolean;
  legacy: CaptainLegacySummary | null | undefined;
  difficulty: Difficulty;
  colorFor?: (item: string) => string | undefined;
  myDetail?:
    | PlayerDetailData
    | {
        money: number;
        score: number;
        shipLevel: number;
        inventory: Record<string, number>;
      }
    | null
    | undefined;
  myPlayer?: PublicUser | null;
}) {
  const resolveColor = itemColorResolver(colorFor);
  const [refOpen, setRefOpen] = useState(false);
  const workerGroups = detail
    ? unlockedWorkerTypes(difficulty, detail.round).map((w) => {
        const list = detail.workers?.[w.id] ?? [];
        return {
          icon: w.icon,
          name: w.plural,
          list,
          skilled: list.filter((x) => x.isSkilled).length,
        };
      })
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Capped and scrollable. This panel is the tallest dialog in the
          game: header, stat tiles, comparison bar, legacy card, cargo,
          workers, modules and a log box. Uncapped it ran taller than a
          laptop viewport, and because the dialog is vertically centred
          with the page scroll locked, both the title and the Close
          button were off screen with no way to reach them. */}
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto pm-scroll">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {player && (
                <Avatar
                  hue={player.avatarHue}
                  name={player.displayName}
                  size={44}
                />
              )}
              <div>
                <DialogTitle className="flex items-center gap-2 text-base">
                  {player?.displayName ?? "Captain"}
                  {isMe && (
                    <span className="text-xs text-muted-foreground font-normal">
                      (you)
                    </span>
                  )}
                </DialogTitle>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {detail
                    ? phaseLabel({
                        phase: detail.phase,
                        currentRound: detail.round,
                      })
                    : loading
                      ? "Loading…"
                      : "Unavailable"}
                </div>
              </div>
            </div>
            {detail?.phase === "bankruptcy" && (
              <Pill tone="alarm" className="shrink-0">
                💥 Bankrupt, spectating
              </Pill>
            )}
            {detail?.phase === "endgame" && (
              <Pill tone="gain" className="shrink-0">
                🏁 Voyage complete
              </Pill>
            )}
          </div>
          <DialogDescription className="sr-only">
            Detailed voyage status
          </DialogDescription>
        </DialogHeader>

        {!detail ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-10">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Asking the harbor
                master…
              </>
            ) : (
              "Not available right now, they may have stepped away."
            )}
          </div>
        ) : (
          <div className="space-y-3.5">
            <div className="grid grid-cols-3 gap-2">
              <ProfileStatTile
                icon={<Coins className="h-3.5 w-3.5" />}
                value={detail.money}
                label="Gold"
                toneClassName="text-gold-ink"
              />
              <ProfileStatTile
                icon={<Trophy className="h-3.5 w-3.5" />}
                value={detail.score}
                label="Reputation"
                toneClassName="text-favor"
              />
              <ProfileStatTile
                icon={<Ship className="h-3.5 w-3.5" />}
                value={detail.shipLevel}
                label="Ship Level"
                toneClassName="text-sea"
              />
            </div>

            {/* Captain comparison bar */}
            {myDetail && !isMe && myPlayer && (
              <ComparisonBar
                myDetail={myDetail}
                theirDetail={detail}
                theirPlayer={player}
              />
            )}

            {legacy && <CaptainLegacyCard legacy={legacy} compact />}

            {/* The reference half, behind one fold: cargo, workers,
                modules and the log would run this popup well past a
                laptop viewport under the figures it exists to show, and
                the figures are what a captain opens it for. */}
            <FoldRow
              tone="profile"
              icon="🗂️"
              title="The Ship's Books"
              gist="Cargo, artisans, equipped modules and the recent log."
              open={refOpen}
              onToggle={() => setRefOpen((v) => !v)}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                <div className="space-y-3.5">
                  <div className="rounded-xl border border-profile/15 bg-profile/[0.03] p-3.5">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                      📦 Cargo
                    </h4>
                    <div className="grid grid-cols-2 gap-x-4">
                      <div>
                        <div className="text-[10px] font-medium text-muted-foreground mb-1">
                          Raw Materials
                        </div>
                        {unlockedResources(difficulty, detail.round).map(
                          (r) => (
                            <CargoRow
                              key={r}
                              item={r}
                              count={detail.inventory[r] || 0}
                              color={resolveColor(r)}
                            />
                          ),
                        )}
                      </div>
                      <div>
                        <div className="text-[10px] font-medium text-muted-foreground mb-1">
                          Finished Goods
                        </div>
                        {unlockedProducts(difficulty, detail.round).map((r) => (
                          <CargoRow
                            key={r}
                            item={r}
                            count={detail.inventory[r] || 0}
                            color={resolveColor(r)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-black/10 dark:border-white/10 p-3.5">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                      👥 Workers
                    </h4>
                    {/* The star the idle rows carry, defined where it
                        appears for the same reason the bench carries the
                        legend: this modal draws the same roster, and a
                        mark should not be met here without the sentence
                        that explains it anywhere on the screen. */}
                    {workerGroups.some((g) =>
                      g.list.some((w) => w.isSkilled),
                    ) && (
                      <p className="mb-2 text-[11px] text-muted-foreground">
                        {SKILLED_LEGEND}
                      </p>
                    )}
                    {workerGroups.every((g) => g.list.length === 0) ? (
                      <p className="text-xs text-muted-foreground">
                        No artisans hired yet.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {workerGroups
                          .filter((g) => g.list.length > 0)
                          .map((g) => (
                            <div key={g.name}>
                              <div className="text-[11px] font-semibold mb-1">
                                {g.icon} {g.name} ({g.list.length})
                              </div>
                              {g.list.map((w, i) => (
                                <div
                                  key={i}
                                  className="text-[11px] text-muted-foreground"
                                >
                                  {workerStatusLine(w, detail.round)}
                                </div>
                              ))}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div className="rounded-xl border border-black/10 dark:border-white/10 p-3.5">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                      🔧 Equipped Modules
                    </h4>
                    {detail.equippedModules.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No modules installed.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {detail.equippedModules.map((card) => {
                          const text = cardText(card);
                          return (
                            <div key={card.id} className="text-[12px]">
                              {card.icon} <strong>{text.name}</strong>:{" "}
                              {text.desc}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-black/10 dark:border-white/10 p-3.5">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" /> Recent Log
                    </h4>
                    <ScrollArea className="h-40 pr-2">
                      {detail.logs.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                          Nothing logged yet.
                        </p>
                      ) : (
                        <div className="space-y-0.5 font-mono text-[11px] leading-relaxed">
                          {detail.logs.map((l, i) => (
                            <div
                              key={i}
                              className="whitespace-pre-wrap break-words"
                            >
                              {l}
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </div>
              </div>
            </FoldRow>
          </div>
        )}

        <CloseFooter onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Captain comparison bar. Shows two captains' key stats side by side
 * with visual bars so a captain can see at a glance how they stack up
 * against a peer. Compares Gold, Reputation, Ship Level, and Cargo
 * value (sum of all inventory).
 */
function ComparisonBar({
  myDetail,
  theirDetail,
  theirPlayer,
}: {
  myDetail: {
    money: number;
    score: number;
    shipLevel: number;
    inventory: Record<string, number>;
  };
  // Their detail is not optional: the only call site renders this inside
  // its `detail` arm, so by the time the bar draws there is a detail to
  // draw. Their player is the half that can still be missing, because a
  // captain can leave the harbor between the peek opening and the reply
  // landing.
  theirDetail: PlayerDetailData;
  theirPlayer: PublicUser | null;
}) {
  if (!theirPlayer) return null;

  // Cargo is counted in items, not in Gold, so a hold reads the same
  // whichever goods it happens to be carrying.
  const myCargoValue = Object.values(myDetail.inventory).reduce(
    (sum, qty) => sum + qty,
    0,
  );
  const theirCargoValue = Object.values(theirDetail.inventory).reduce(
    (sum, qty) => sum + qty,
    0,
  );

  const stats: ComparisonStat[] = [
    {
      label: "Gold",
      mine: myDetail.money,
      theirs: theirDetail.money,
      tone: "text-gold-ink",
      barClass: "bg-gold",
    },
    {
      label: "Reputation",
      mine: myDetail.score,
      theirs: theirDetail.score,
      tone: "text-favor",
      barClass: "bg-favor",
    },
    {
      label: "Ship Lv",
      mine: myDetail.shipLevel,
      theirs: theirDetail.shipLevel,
      tone: "text-sea",
      barClass: "bg-sea",
    },
    {
      label: "Cargo",
      mine: myCargoValue,
      theirs: theirCargoValue,
      tone: "text-intel",
      barClass: "bg-intel",
    },
  ];

  return (
    <div className="rounded-xl border border-border/40 bg-black/[0.02] p-3.5 dark:bg-white/[0.02]">
      <div className="mb-2.5 flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground">
          Captain Comparison
        </h4>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>You</span>
          <span>vs</span>
          <span>{theirPlayer.displayName}</span>
        </div>
      </div>
      <div className="space-y-2">
        {stats.map((s) => (
          <ComparisonRow key={s.label} stat={s} />
        ))}
      </div>
    </div>
  );
}

// One colour for both captains: the bar compares two numbers, and the
// tint names the stat rather than the captain. Two tone fields, one per
// captain, would read as an invitation to give one captain a different
// colour from the other, which is not what the bar does.
type ComparisonStat = {
  label: string;
  mine: number;
  theirs: number;
  tone: string;
  barClass: string;
};

function ComparisonRow({ stat }: { stat: ComparisonStat }) {
  const max = Math.max(stat.mine, stat.theirs, 1);
  const myPct = (stat.mine / max) * 100;
  const theirPct = (stat.theirs / max) * 100;
  const iWin = stat.mine > stat.theirs;
  const theyWin = stat.theirs > stat.mine;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <div className="flex w-20 items-center justify-end gap-1">
        <span className={cn("font-bold tabular-nums", stat.tone)}>
          {stat.mine}
        </span>
        {iWin && <span className="text-[8px]">{"<"}</span>}
      </div>
      <div className="flex flex-1 items-center gap-0.5">
        <div className="flex flex-1 justify-end">
          <div
            className={cn("h-3 rounded-l-full transition-all", stat.barClass)}
            style={{ width: `${myPct}%`, opacity: iWin ? 1 : 0.5 }}
          />
        </div>
        <div className="flex flex-1">
          <div
            className={cn("h-3 rounded-r-full transition-all", stat.barClass)}
            style={{ width: `${theirPct}%`, opacity: theyWin ? 1 : 0.5 }}
          />
        </div>
      </div>
      <div className="flex w-20 items-center gap-1">
        {theyWin && <span className="text-[8px]">{">"}</span>}
        <span className={cn("font-bold tabular-nums", stat.tone)}>
          {stat.theirs}
        </span>
      </div>
    </div>
  );
}
