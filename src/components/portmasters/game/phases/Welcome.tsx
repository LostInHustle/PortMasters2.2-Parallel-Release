"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/game/constants/brand";
import { STARTING_STOCK } from "@/lib/game/constants/goods";
import { INCOME_TAX_RATE } from "@/lib/game/engine";
import { openingPhase } from "@/lib/game/checkpoint";
import { difficultyConfig, pirateChanceFor } from "@/lib/game/difficulty";
import { modeConfig } from "@/lib/game/mode";
import { phaseFace } from "@/lib/game/phases";
import { cn } from "@/lib/utils";
import { Ship, BookOpen } from "lucide-react";
import type { PublicUser } from "@/lib/api";
import { Avatar } from "../../shared";
import { FoldRow } from "../FoldRow";
import { RoundFlow } from "../RoundFlow";
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
  // The captains in the harbor, read from room membership rather than
  // from the ready check's roster. The two were the same list until the
  // waiting roster learned to exclude the pier (the harbor is not a seat
  // the room readies out of, see waitingRosterSet in
  // src/server/realtime/checkpoint.ts): every captain standing here fell
  // out of it, the start button disabled itself with "Need at least one
  // captain in the harbor" for a host standing in a full one, and the
  // server's own guard, which counts membership, would have taken the
  // start. Who is in the harbor is a fact about the room; the roster is
  // an answer about the seat.
  const harborIds = members.map((m) => m.id);
  // Solo Practice Mode: a captain may start the voyage alone. The
  // server allows a single captain to set sail so the game is playable
  // without a second human. The ready check protocol advances with
  // just the one captain.
  const canStart = harborIds.length >= 1;
  const isHost = me.id === room.hostId;
  // One shape or the other, and the mode record is what decides which:
  // the screen renders the briefing a mode hands it rather than choosing
  // a shape on the mode's behalf. See ModeBriefing in src/lib/game/mode.
  //
  // The record itself is read once and its fields are used below, so the
  // panel that names the mode and the panel that charts its round cannot
  // describe two different voyages.
  const play = modeConfig(game.mode);
  const briefing = play.briefing;
  // The seat the departure walks the room into, read off the mode's own
  // lap rather than named here (see openingPhase). For a dealing Gambit
  // build it is the path draft, and the round pill below names it as the
  // first thing that will be asked of the captain.
  const opening = openingPhase(game.mode);
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
  const [briefingOpen, setBriefingOpen] = useState(false);
  return (
    <div className="max-w-3xl mx-auto text-center py-4">
      <div className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-1">
        <span className="text-harbor">⚓ {APP_NAME} 🚢</span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {/* The voyage's own length, read from the state the captain is
            sailing rather than from the tier: a Gambit voyage is twelve
            rounds on every tier, so the tier's ladder would greet the crew
            with the length of a voyage they are not on (see voyageLegs in
            src/lib/game/mode).

            It counts rounds, and it used to call them voyages, which is
            the one word this game cannot afford to blur: a voyage is the
            whole run and a round is one lap of it, and a captain reading
            "8 Voyages await" on the first screen of an eight round voyage
            had been told the wrong thing about the game before it began. */}
        🌊 {game.maxRounds} rounds await, become the Sea Master!
      </p>
      <div className="flex flex-col items-center gap-3 mb-6">
        <HarborRoster members={members} ids={harborIds} />
        {isHost ? (
          <>
            <Button
              size="lg"
              className={cn(
                "rounded-xl h-12 px-8 text-base",
                canStart && "pm-grad-harbor",
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
      <div className="max-w-2xl mx-auto mt-3 space-y-2">
        {/* The count this label used to carry is gone, and its absence is
            the fix rather than an omission. It read "4 Phases per Voyage"
            above a mode record that counts its own steps, and the Gambit
            record lists five, so the headline contradicted the sentence it
            was introducing, on one row of one pill. A number that has to
            agree with a list beside it is a second copy of that list, and
            the label is the copy that rots: a mode changes its lap and
            rewrites its own description, and nobody remembers the number
            on the pill above it. So the legs are counted where they are
            written, and the label introduces them without one. The wording
            avoids "in Order" for the same reason it avoids a count: in
            this game Order is a noun, and the leg the mode moved is the
            one that carries it.

            What follows the label is whatever shape the mode briefs in,
            and the shape is the mode's decision rather than this screen's:
            a line for the mode that has always printed one, and the chart
            for the mode whose whole design is the order its legs run in.
            A line and a chart are two renderings of one record, not two
            records, which is why this branch is a branch on the data
            rather than a second panel beside the first. */}
        {/* One pill for the two questions this screen exists to answer,
            what you are playing and what it costs you to fail (W4): the
            round and the mode's own line were two tinted boxes saying
            one thing, and a captain reading their first lobby met three
            competing pills before they met the start button. The badge
            line rides under the round chart as a lighter wing of the
            same box, and the list of what a mode changes is still not
            printed here: it belongs on the surfaces built for lists, and
            this panel says where it is rather than carrying another copy
            of it. */}
        <div className="rounded-lg bg-sea/[0.06] border border-sea/15 px-3.5 py-2.5 text-xs">
          <strong>🔄 How a Round Runs:</strong>{" "}
          {briefing.kind === "line" ? (
            briefing.text
          ) : (
            <RoundFlow legs={briefing.legs} closes={briefing.closes} />
          )}
          {/* The first seat, named: a captain who has read the chart
              knows the shape of the lap and not what standing in its
              first seat asks of them, and for the mode whose lap opens
              with the deal this is the one sentence that turns the
              chart's first box into a thing with cards in it. It reads
              the opening off the mode's own lap rather than naming a
              phase here, so a mode that opens elsewhere draws no such
              line and needs no edit. */}
          {opening === "path_draft" && (
            <span className="block mt-1">
              Your first seat is the {phaseFace("path_draft").label}: three
              cards dealt face down, and the one you keep is the path you sail.
            </span>
          )}
          <span className="block mt-1.5 pt-1.5 border-t border-sea/15">
            <strong>🧭 {play.badge}:</strong> {play.tagline} {play.failureRule}
            {/* It points at the button without a direction, because the
                button sits above this panel rather than below it. */}
            {play.differences.length > 0 &&
              " The New Player Tutorial lists everything this mode changes."}
          </span>
        </div>
        <div className="rounded-lg bg-intel/[0.06] border border-intel/15 px-3.5 py-2.5 text-xs">
          <strong>💡 New Player Tip:</strong> Keep your purse above maintenance
          plus all wages, and hire artisans only when you can sustain them.
        </div>
      </div>
      {/* The five founding numbers, folded to a row at the foot of the
          screen, below the round chart and the mode's own line because
          those two are what this screen is for and these are what a
          captain looks up. They used to stand open under the start
          button: five cards of figures above the one thing the screen
          exists for (getting the table sailing), read once and never
          again, on the first screen of the voyage. Folded, the pier
          opens on the button and the figures wait a press away. */}
      <div className="max-w-2xl mx-auto mt-3">
        <FoldRow
          tone="harbor"
          icon="📋"
          title="Harbor Briefing"
          gist="Starting resources, round costs, taxes and the pirate odds."
          open={briefingOpen}
          onToggle={() => setBriefingOpen((v) => !v)}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
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
                "Assign task now → item arrives at Resolve",
                "Workers don't produce instantly!",
              ]}
            />
            <InfoCard
              tone="sea"
              title="💸 Round End Costs"
              rows={[
                `🔧 ${cfg.maintenance} Gold ship maintenance per round`,
                "👥 Wages settled at Resolve, not on hire",
              ]}
            />
            <InfoCard
              tone="alarm"
              title="🧾 Taxes Explained"
              rows={[
                "VAT: 5% of finished goods profit margin",
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
        </FoldRow>
      </div>
    </div>
  );
}
