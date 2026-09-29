"use client";

import { VoyageResult, VoyageReveal } from "@/types/realtime/voyage";
import { RivalEntry } from "@/types/realtime/standings";
import { Anchor, Crown, Skull } from "lucide-react";
import { BROKERS_FAVOR_UNLOCK_LEVEL } from "@/lib/game/constants/world";
import { meritById } from "@/lib/game/merits";
import type { CaptainLegacySummary } from "@/lib/game/legacy";
import { cn } from "@/lib/utils";
import { Avatar, MeritIcon } from "../../shared";
import { CaptainLegacyCard } from "../../CaptainLegacyCard";
import { RevealPanel } from "../RevealPanel";

type Standing = VoyageResult["standings"][number];

/**
 * The board the voyage ends on: the harbor's standings, with the crown,
 * the bankruptcy skull and the maroon anchor each said in their own glyph.
 */
function Standings({
  standings,
  myUserId,
}: {
  standings: Standing[];
  myUserId: string;
}) {
  return (
    <div className="rounded-xl border border-black/5 dark:border-white/10 overflow-hidden">
      <div className="px-3 py-2 text-xs font-semibold bg-black/[0.03] dark:bg-white/[0.05]">
        🏁 Final Standings
      </div>
      <div className="divide-y divide-black/5 dark:divide-white/10">
        {standings.map((s, i) => (
          <div
            key={s.userId}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-sm",
              s.userId === myUserId && "bg-endgame/[0.06]",
            )}
          >
            <span className="text-xs text-muted-foreground w-4 shrink-0">
              {i + 1}
            </span>
            <Avatar hue={s.avatarHue} name={s.displayName} size={22} />
            <span className="flex-1 truncate font-medium">{s.displayName}</span>
            {s.crowned && (
              <Crown className="h-3.5 w-3.5 text-gold-ink shrink-0" />
            )}
            {s.bankrupt && (
              <Skull className="h-3.5 w-3.5 text-alarm shrink-0" />
            )}
            {/* [H7: Maroon and the Harbormaster] The other way a
                voyage can go wrong, and a different icon rather
                than a second use of the skull: a captain can be
                put ashore and still be solvent, and the standings
                are the last place that should blur the two. */}
            {s.marooned && (
              <Anchor className="h-3.5 w-3.5 text-alarm shrink-0" />
            )}
            <span className="text-xs text-muted-foreground shrink-0">
              {s.reputation} Rep.
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * What the voyage left behind, once the harbor has finished: the crown, the
 * favor, the merits, the cards turned face up, the standings and the
 * captain's own legacy. Before the standings land, the reveal is the whole
 * of it and the screen says what it is waiting on.
 *
 * A captain who reloads onto a finished voyage is handed the reveal and
 * nothing else of the conclusion, since the standings are a frame and not a
 * record. They have not been waiting on the harbor by then, so the waiting
 * line is what is wrong on that screen rather than what is missing.
 */
export function EndgameResults({
  voyageResult,
  reveal,
  myLegacy,
  myUserId,
  mine,
  rival,
}: {
  voyageResult?: VoyageResult | null;
  reveal?: VoyageReveal | null;
  myLegacy?: CaptainLegacySummary | null;
  myUserId: string;
  mine?: Standing;
  rival: RivalEntry | null;
}) {
  if (!voyageResult) {
    return (
      <div className="space-y-3 mb-5 text-left">
        {reveal ? (
          <RevealPanel reveal={reveal} myUserId={myUserId} />
        ) : (
          <div className="text-sm text-center text-muted-foreground">
            ⏳ Waiting on the rest of the harbor to finish their voyage before
            Sea Master is crowned…
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3 mb-5 text-left">
      {mine?.crowned && (
        <div className="pm-grad-gold rounded-xl px-4 py-3 text-center">
          <div className="text-lg font-bold flex items-center justify-center gap-2">
            <Crown className="h-5 w-5" /> Crowned Sea Master!
          </div>
          <div className="text-xs opacity-80 mt-0.5">
            Highest Reputation in this harbor&apos;s voyage.
          </div>
        </div>
      )}
      {mine?.brokersFavorUnlocked && (
        <div className="rounded-xl border-2 border-favor/40 bg-favor/5 px-4 py-3 text-center">
          <div className="text-lg font-bold text-favor flex items-center justify-center gap-2">
            🤝 Broker&apos;s Favor Unlocked!
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Renown Level {BROKERS_FAVOR_UNLOCK_LEVEL} reached. Starting next
            voyage, call one in from the Trade Manifest to summon a guaranteed
            buyer.
          </div>
        </div>
      )}
      {mine?.newMerits.map((meritId) => {
        const merit = meritById(meritId);
        if (!merit) return null;
        return (
          <div
            key={meritId}
            className="pm-grad-endgame rounded-xl px-4 py-3 text-center"
          >
            <div className="text-lg font-bold flex items-center justify-center gap-2">
              <MeritIcon id={merit.id} className="h-5 w-5" /> Captain&apos;s
              Merit: {merit.name}
            </div>
            <div className="text-xs opacity-80 mt-0.5">{merit.desc}</div>
          </div>
        );
      })}
      {/* [H8: the reveal and the replay ledger] The cards come down
          before the standings, because the reveal is what the evening
          was for and the standings are the record of it. A harbor that
          dealt no cards, which is every Classic harbor, is sent no
          reveal and matches none of this. */}
      {reveal && <RevealPanel reveal={reveal} myUserId={myUserId} />}
      <Standings standings={voyageResult.standings} myUserId={myUserId} />

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
  );
}
