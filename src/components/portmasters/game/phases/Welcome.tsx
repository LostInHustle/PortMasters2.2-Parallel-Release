"use client";

import { Button } from "@/components/ui/button";
import { APP_NAME, STARTING_STOCK } from "@/lib/game/constants";
import { INCOME_TAX_RATE } from "@/lib/game/engine";
import { difficultyConfig, pirateChanceFor } from "@/lib/game/difficulty";
import { modeConfig } from "@/lib/game/mode";
import { cn } from "@/lib/utils";
import { Ship, BookOpen } from "lucide-react";
import type { PublicUser } from "@/lib/api";
import { Avatar } from "../../shared";
import type { PhasePanelProps } from "./PhaseShared";

// The pre voyage lobby roster: just avatars and a headcount, no ready/not
// ready state since there's nothing to ready up for yet. Separate from
// ReadyBar (used everywhere else) on purpose, since reusing its check
// marks here would imply a vote that doesn't exist for this screen.
function HarborRoster({
  members,
  ids,
}: {
  members: PublicUser[];
  ids: string[];
}) {
  if (ids.length === 0) return null;
  const byId = new Map(members.map((m) => [m.id, m]));
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-1.5">
        {ids.map((id) => {
          const m = byId.get(id);
          return m ? (
            <Avatar
              key={id}
              hue={m.avatarHue}
              name={m.displayName}
              size={28}
              ring
            />
          ) : null;
        })}
      </div>
      <div className="text-xs text-muted-foreground">
        {ids.length} captain{ids.length !== 1 ? "s" : ""} in the harbor
      </div>
    </div>
  );
}

// Named for the meaning each one carries rather than the colour it
// happens to be, the same way ActionSuggester's tones are: the colour
// follows the meaning, and a rename of the palette should not have to
// reach into this file.
const INFO_TONES: Record<"gain" | "warn" | "sea" | "alarm", string> = {
  gain: "bg-gain/[0.06] border-gain/20",
  warn: "bg-warn/[0.06] border-warn/20",
  sea: "bg-sea/[0.06] border-sea/20",
  alarm: "bg-alarm/[0.06] border-alarm/20",
};

function InfoCard({
  tone,
  title,
  rows,
}: {
  tone: "gain" | "warn" | "sea" | "alarm";
  title: string;
  rows: string[];
}) {
  return (
    <div className={cn("rounded-lg border p-3", INFO_TONES[tone])}>
      <div className="font-semibold text-sm mb-1">{title}</div>
      {rows.map((r, i) => (
        <div key={i} className="text-xs">
          {r}
        </div>
      ))}
    </div>
  );
}

// Welcome is the pre voyage lobby. The voyage has not started yet, so it
// ignores act/ctx and the other in voyage hooks; it only reads the room
// (to derive whether the viewer is the host), the roster (for the harbor
// avatars) and phaseSync (for the startGame action and the ready list).
// onTutorialOpen is the one extra beyond PhasePanelProps.
export function Welcome({
  game,
  phaseSync,
  members,
  me,
  room,
  onTutorialOpen,
}: Pick<PhasePanelProps, "game" | "phaseSync" | "members" | "me" | "room"> & {
  onTutorialOpen?: () => void;
}) {
  const harborIds = phaseSync.ready?.requiredUserIds ?? [];
  // Solo Practice Mode: a captain may start the voyage alone. The
  // server allows a single captain to set sail so the game is playable
  // without a second human. The ready check protocol advances with
  // just the one captain.
  const canStart = harborIds.length >= 1;
  const isHost = me.id === room.hostId;
  // The InfoCard numbers derive from the room's difficulty tier rather
  // than the old hardcoded founding trade figures. Fair Winds reads
  // exactly like the original (20% raid, 15 Gold maintenance), while
  // Open Waters and Monsoon advertise their real dials.
  const cfg = difficultyConfig(game.difficulty);
  const stockLine = ["Hemp", "Silk", "Tea"]
    .map((r) => `${r}×${STARTING_STOCK[r]}`)
    .join(", ");
  const raidPct = Math.round(
    pirateChanceFor(game.difficulty, 1, game.maxRounds) * 100,
  );
  // income tax is not yet a DifficultyConfig dial: every charter still
  // uses the founding 10%, which is what calcIncomeTax charges.
  const taxRate = INCOME_TAX_RATE;
  return (
    <div className="max-w-3xl mx-auto text-center py-4">
      <div className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-1">
        <span className="text-welcome">⚓ {APP_NAME} 🚢</span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        🌊 {cfg.rounds} Voyages await, become the Sea Master!
      </p>
      <div className="flex flex-col items-center gap-3 mb-6">
        <HarborRoster members={members} ids={harborIds} />
        {isHost ? (
          <>
            <Button
              size="lg"
              className={cn(
                "rounded-xl h-12 px-8 text-base",
                canStart && "pm-grad-welcome",
              )}
              variant={canStart ? "default" : "secondary"}
              disabled={!canStart}
              onClick={() => phaseSync.startGame()}
            >
              <Ship className="h-5 w-5 mr-2" />
              {canStart
                ? harborIds.length === 1
                  ? "Start Solo Practice Voyage"
                  : "Start the Voyage"
                : `Need at least one captain in the harbor`}
            </Button>
            {phaseSync.startError && (
              <p className="text-xs text-alarm">{phaseSync.startError}</p>
            )}
          </>
        ) : (
          <div className="text-sm text-muted-foreground">
            ⏳ Waiting for the host to start the voyage… ({harborIds.length} in
            harbor)
          </div>
        )}
        <Button variant="ghost" className="rounded-xl" onClick={onTutorialOpen}>
          <BookOpen className="h-4 w-4 mr-2" />
          New Player Tutorial
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left max-w-2xl mx-auto">
        <InfoCard
          tone="gain"
          title="🚀 Starting Resources"
          rows={[
            `📦 ${stockLine}`,
            `💰 ${cfg.startingGold} Gold starting funds`,
          ]}
        />
        <InfoCard
          tone="warn"
          title="⏱️ Production Delay"
          rows={[
            "Assign task now → item arrives at Phase 3",
            "Workers don't produce instantly!",
          ]}
        />
        <InfoCard
          tone="sea"
          title="💸 Round End Costs"
          rows={[
            `🔧 ${cfg.maintenance} Gold ship maintenance per round`,
            "👥 Wages settled at Phase 3, not on hire",
          ]}
        />
        <InfoCard
          tone="alarm"
          title="🧾 Taxes Explained"
          rows={[
            "VAT: 5% of finished good profit margin",
            `Income Tax: ${Math.round(taxRate * 100)}% income tax`,
          ]}
        />
        <InfoCard
          tone="warn"
          title="🏴‍☠️ Pirates & Borrowing"
          rows={[
            `${raidPct}% chance of losing all Gold on hand`,
            "Hire an escort, or ask the harbor for a loan",
          ]}
        />
      </div>
      <div className="max-w-2xl mx-auto mt-3 space-y-2">
        <div className="rounded-lg bg-sea/[0.06] border border-sea/15 px-3.5 py-2.5 text-xs">
          <strong>🔄 4 Phases per Voyage:</strong>{" "}
          {modeConfig(game.mode).lapBlurb}
        </div>
        <div className="rounded-lg bg-intel/[0.06] border border-intel/15 px-3.5 py-2.5 text-xs">
          <strong>💡 New Player Tip:</strong> Rely on raw material orders early.
          Hire artisans only when you can sustain at least 2 rounds of wages.
          Always keep funds &gt; Maintenance + All Wages.
        </div>
      </div>
    </div>
  );
}
