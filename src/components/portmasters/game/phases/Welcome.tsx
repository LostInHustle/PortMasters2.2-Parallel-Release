"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/game/constants/brand";
import { START_VOYAGE } from "@/lib/game/constants/copy";
import { RESOURCES_TIER0, STARTING_STOCK } from "@/lib/game/constants/goods";
import { INCOME_TAX_RATE, VAT_RATE } from "@/lib/game/engine";
import { openingPhase } from "@/lib/game/checkpoint";
import { difficultyConfig, pirateOddsLabel } from "@/lib/game/difficulty";
import { listJoiner, t } from "@/lib/game/i18n";
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
        {t("{count} captain{pluralS} in the harbor", {
          count: ids.length,
          pluralS: ids.length !== 1 ? "s" : "",
        })}
      </div>
    </div>
  );
}

// Named for the meaning each one carries rather than the color it
// happens to be, the same way ActionSuggester's tones are: the color
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
// ignores act/ctx and the other in voyage hooks; it only reads the harbor
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
  // The captains in the harbor, read from harbor membership rather than
  // from the ready check's roster. The two were the same list until the
  // waiting roster learned to exclude the pier (the harbor is not a seat
  // the harbor readies out of, see waitingRosterSet in
  // src/server/realtime/checkpoint.ts): every captain standing here fell
  // out of it, the start button disabled itself with "Need at least one
  // captain in the harbor" for a host standing in a full one, and the
  // server's own guard, which counts membership, would have taken the
  // start. Who is in the harbor is a fact about the harbor; the roster is
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
  // The seat the departure walks the harbor into, read off the mode's own
  // lap rather than named here (see openingPhase). For a dealing Gambit
  // build it is the path draft, and the round pill below names it as the
  // first thing that will be asked of the captain.
  const opening = openingPhase(game.mode);
  // The InfoCard numbers derive from the harbor's difficulty tier, so each
  // tier advertises its real dials: Fair Winds reads exactly like the
  // founding trade figures (20% raid, 15 Gold maintenance), while Open
  // Waters and Monsoon print their own.
  const cfg = difficultyConfig(game.difficulty);
  // The three starting goods as the card prints them: each pair reads
  // through its own row (see manual.048 in the pack), and the list joins
  // with the separator the language writes a list with. The goods are the
  // founding tier's own list rather than a second copy of it, so a
  // change to what a voyage opens with reaches this card.
  const stockLine = RESOURCES_TIER0.map((r) =>
    t("{r}×{stockQty}", { r: t(r), stockQty: STARTING_STOCK[r] }),
  ).join(listJoiner());
  // income tax is not yet a DifficultyConfig dial: every charter still
  // uses the founding 10%, which is what calcIncomeTax charges.
  const taxRate = INCOME_TAX_RATE;
  // The odds row carries the percent sign after its token, while the label
  // answers with the sign already on (one rung, or two where the tier
  // steps up), so the label is handed over without it.
  const oddsLine = t("{raidPct}% chance of losing all Gold on hand", {
    raidPct: pirateOddsLabel(cfg).replace(/%$/, ""),
  });
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
            with the length of a voyage they are not on (see voyageRounds in
            src/lib/game/mode).

            It counts rounds rather than voyages: a voyage is the whole
            run and a round is one lap of it, and this is the one word
            the first screen of the game cannot afford to blur. */}
        {t("🌊 {rounds} rounds await, become the Sea Master!", {
          rounds: game.maxRounds,
        })}
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
                  ? t("Start Solo Practice")
                  : t(START_VOYAGE)
                : t("Need at least one captain in the harbor")}
            </Button>
            {phaseSync.startError && (
              <p className="text-xs text-alarm">{phaseSync.startError}</p>
            )}
          </>
        ) : (
          <div className="text-sm text-muted-foreground">
            {t(
              "⏳ Waiting for the host to start the voyage… ({harborIds.length} in harbor)",
              { "harborIds.length": harborIds.length },
            )}
          </div>
        )}
        <Button variant="ghost" className="rounded-xl" onClick={onTutorialOpen}>
          <BookOpen className="h-4 w-4 mr-2" />
          {t("New Captain Tutorial")}
        </Button>
      </div>
      <div className="max-w-2xl mx-auto mt-3 space-y-2">
        {/* The label carries no count of the rounds: they are counted where
            they are written, in the mode record. A number that has to agree
            with a list beside it is a second copy of that list, and the
            label is the copy that rots: a mode changes its lap and rewrites
            its own description, and nobody remembers the number on the pill
            above it. The wording avoids "in Order" for the same reason it
            avoids a count: in this game Order is a noun, and the round the
            mode moved is the one that carries it.

            What follows the label is whatever shape the mode briefs in,
            and the shape is the mode's decision rather than this screen's:
            a line for the mode that has always printed one, and the chart
            for the mode whose whole design is the order its rounds run in.
            A line and a chart are two renderings of one record, not two
            records, which is why this branch is a branch on the data
            rather than a second panel beside the first. */}
        {/* One pill for the two questions this screen exists to answer,
            what you are playing and what it costs you to fail: the
            round and the mode's own line are one thing said twice, and a
            captain reading their first lobby should meet the start button
            before a stack of competing pills. The badge line rides under
            the round chart as a lighter wing of the same box, and the list
            of what a mode changes is still not printed here: it belongs on
            the surfaces built for lists, and this panel says where it is
            rather than carrying another copy of it. */}
        <div className="rounded-lg bg-sea/[0.06] border border-sea/15 px-3.5 py-2.5 text-xs">
          <strong>{t("🔄 How a Round Runs:")}</strong>{" "}
          {briefing.kind === "line" ? (
            t(briefing.text)
          ) : (
            <RoundFlow phases={briefing.phases} closes={briefing.closes} />
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
              {t(
                "Your first seat is the {label}: three cards dealt face down, and the one you keep is the path you sail.",
                { label: t(phaseFace("path_draft").label) },
              )}
            </span>
          )}
          <span className="block mt-1.5 pt-1.5 border-t border-sea/15">
            <strong>
              🧭 {t(play.badge)}
              {t(": ")}
            </strong>{" "}
            {t(play.tagline)} {t(play.failureRule)}
            {/* It points at the button without a direction, because the
                button sits above this panel rather than below it. */}
            {play.differences.length > 0 &&
              " " +
                t(
                  "The New Captain Tutorial lists everything this mode changes.",
                )}
          </span>
        </div>
        <div className="rounded-lg bg-intel/[0.06] border border-intel/15 px-3.5 py-2.5 text-xs">
          <strong>{t("💡 New Captain Tip:")}</strong>{" "}
          {t(
            "Keep your purse above maintenance plus all wages, and hire artisans only when you can sustain them.",
          )}
        </div>
      </div>
      {/* The five founding numbers, folded to a row at the foot of the
          screen, below the round chart and the mode's own line because
          those two are what this screen is for and these are what a
          captain looks up. Standing open under the start button, five
          cards of figures would sit above the one thing the screen exists
          for (getting the table sailing), read once and never again, on
          the first screen of the voyage. Folded, the pier opens on the
          button and the figures wait a press away. */}
      <div className="max-w-2xl mx-auto mt-3">
        <FoldRow
          tone="harbor"
          icon="📋"
          title={t("Harbor Briefing")}
          gist={t(
            "Starting resources, round costs, taxes and the pirate odds.",
          )}
          open={briefingOpen}
          onToggle={() => setBriefingOpen((v) => !v)}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
            <InfoCard
              tone="gain"
              title={t("🚀 Starting Resources")}
              rows={[
                t("📦 {stock}", { stock: stockLine }),
                t("💰 {gold} starting Gold", { gold: cfg.startingGold }),
              ]}
            />
            <InfoCard
              tone="warn"
              title={t("⏱️ Production Delay")}
              rows={[
                t("Assign task now → item arrives at Resolve"),
                t("Artisans don't produce instantly!"),
              ]}
            />
            <InfoCard
              tone="sea"
              title={t("💸 Round End Costs")}
              rows={[
                t("🔧 {cfg.maintenance} Gold ship maintenance fee per round", {
                  "cfg.maintenance": cfg.maintenance,
                }),
                t("👥 Wages settled at Resolve, not on hire"),
              ]}
            />
            <InfoCard
              tone="alarm"
              title={t("🧾 Taxes Explained")}
              rows={[
                t("VAT: {vatPct}% of finished goods profit margin", {
                  vatPct: Math.round(VAT_RATE * 100),
                }),
                t("Income Tax: {incomeTaxPct}% income tax", {
                  incomeTaxPct: Math.round(taxRate * 100),
                }),
              ]}
            />
            <InfoCard
              tone="warn"
              title={t("🏴‍☠️ Pirates & Borrowing")}
              rows={[
                oddsLine,
                t("Hire an escort, or ask the harbor for a loan"),
              ]}
            />
          </div>
        </FoldRow>
      </div>
    </div>
  );
}
