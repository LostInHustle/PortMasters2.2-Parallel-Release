"use client";

// =====================================================================
// [H7: Maroon and the Harbormaster] The harbor's heavier vote, and the
// hand it leaves behind.
//
// Four surfaces in one file, for the reason the audit's two are in one:
// they are one interaction read at four moments. The card is the vote
// while the room still has it. The strip is what the room carries
// afterwards, for the rest of the voyage. The shift strip is what the
// table trades against, while it is in force and while it is only a call.
// The console is what the captain it named does with the legs they have
// left, and it is the only surface here that one captain sees and the
// rest do not.
//
// It wears `alarm`, which is the palette's meaning for money out at its
// worst (see palette.css, where the token is described as the colour of a
// cost, a loss, an error, a bankruptcy, a raid). The audit wears `intel`
// because it reports what somebody knows; this one takes a ship, and
// dressing the two in the same blue would say they cost the same.
// =====================================================================

import { MaroonResult, PortShiftNotice } from "@/types/realtime/maroon";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PublicUser } from "@/lib/api";
import { portShiftLine } from "@/lib/game/maroon";
import { modeConfig } from "@/lib/game/mode";
import type { GameState } from "@/lib/game/types";
import type { useMaroon } from "@/lib/use-maroon";
import { tallyRows } from "@/lib/voteTally";
import { VoteTallyRows } from "@/components/portmasters/game/VoteTallyRows";
import { seatMarks, type SeatStatus } from "@/lib/seatMarks";

type Maroon = ReturnType<typeof useMaroon>;

// What the card needs to know about the rest of the room, and nothing
// else: the two marks a vote may not be aimed at. Taken as a structural
// type rather than as the roster hook's whole record so the card cannot
// reach for anything it has no business reading.
type Marks = Record<string, SeatStatus>;

export function MaroonVoteCard({
  game,
  members,
  me,
  maroon,
  statuses,
}: {
  game: GameState;
  members: PublicUser[];
  me: PublicUser;
  maroon: Maroon;
  statuses?: Marks;
}) {
  const [target, setTarget] = useState("");

  // Three states, and the panel is worth showing in all of them, for the
  // reason the audit's is: a mode whose headline mechanic nobody has heard
  // of is a mechanic nobody uses. Before the rung it explains itself,
  // during it offers the vote, and once the vote has carried it says so
  // rather than going quiet.
  const rung = modeConfig(game.mode).maroonFrom;
  if (rung === null || game.phase !== "parley") return null;
  const spent = maroon.result !== null;
  const open = game.currentRound >= rung;
  const rows = tallyRows(maroon.votes, members);
  const nameOf = (id: string) =>
    members.find((m) => m.id === id)?.displayName ?? "a captain";
  // The server refuses a vote aimed at a captain it has already written
  // off, so the list does not offer one: an option that quietly does
  // nothing is worse than no option. The rule itself lives in seatMarks,
  // beside the two other panels that read the same marks.
  const marked = (id: string) => seatMarks(statuses?.[id]).writtenOff;

  return (
    <div className="rounded-xl border border-alarm/25 bg-alarm/[0.04] p-4 mb-4">
      <h3 className="text-center font-semibold mb-1 text-sm">🏝️ Maroon</h3>
      {spent || !open ? (
        <p className="text-center text-xs text-muted-foreground leading-relaxed">
          {spent
            ? "This voyage's maroon has been called. The harbor gets one."
            : `From leg ${rung}, two thirds of the captains still sailing may put one captain ashore. The ship and its hold go to the harbor, half their Gold stays aboard, and the captain is handed the Harbormaster's hand for the rest of the voyage. The harbor gets one vote a voyage.`}
        </p>
      ) : (
        <>
          <p className="text-center text-xs text-muted-foreground mb-3 leading-relaxed">
            Two thirds of the captains still sailing can put one captain ashore.
            The vote is public, it is spent for the whole voyage, and the
            captain who loses it keeps their seat at the table.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              aria-label="Captain to maroon"
            >
              <option value="">Choose a captain</option>
              {members
                .filter((m) => !marked(m.id))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id === me.id ? `${m.displayName} (you)` : m.displayName}
                  </option>
                ))}
            </select>
            <Button
              variant="outline"
              disabled={!target || !maroon.canVote}
              onClick={() => maroon.vote(target)}
            >
              Call the vote
            </Button>
          </div>
          {maroon.myVote && (
            <p className="text-center text-[11px] text-muted-foreground mt-2">
              You named {nameOf(maroon.myVote)}. Waiting on the rest of the
              harbor.
            </p>
          )}
          <VoteTallyRows rows={rows} />
          <p className="text-center text-[10px] text-muted-foreground/80 mt-2">
            Two thirds of the captains still in the voyage carries it.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * What the harbor did, kept on every screen for the rest of the voyage.
 *
 * It stays because the marooned captain is still at the table and still
 * on this screen: a room that forgets the vote the moment it lands would
 * read the empty chair as an accident rather than as a decision the room
 * made together.
 */
export function MaroonResultStrip({ result }: { result: MaroonResult | null }) {
  // Held by the result it applies to, exactly as the audit strip is, so a
  // dismissed vote cannot silence the next voyage's.
  const [dismissed, setDismissed] = useState<string | null>(null);
  if (!result) return null;
  const key = `${result.round}:${result.target.userId}`;
  if (dismissed === key) return null;

  return (
    <div className="rounded-2xl px-3 py-2 mb-3 border border-alarm/40 bg-alarm/[0.06] ring-1 ring-alarm/20">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm leading-none" aria-hidden>
          🏝️
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-alarm">
          Maroon · Leg {result.round}
        </span>
        <span className="font-display text-sm font-semibold">
          {result.target.name} put ashore
        </span>
        <button
          type="button"
          className="ml-auto text-muted-foreground hover:text-foreground"
          onClick={() => setDismissed(key)}
          aria-label="Hide the vote"
        >
          ✕
        </button>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/80">
        Voted ashore by two thirds of the harbor. The ship and everything on it
        went to the harbor, half their Gold stayed aboard, and the
        Harbormaster&apos;s hand is theirs for the rest of the voyage.
      </p>
    </div>
  );
}

/**
 * The market condition the table is trading against.
 *
 * Two tenses from one notice, which is why the leg comes in with it: a
 * call made this leg has not opened a market yet, and a call made last
 * leg is the one every price on screen was drawn from. The strip is not
 * dismissible while it is in force, because it is not news: it is a rule
 * about the numbers on the cards in every captain's hand.
 */
export function PortShiftStrip({
  shift,
  round,
}: {
  shift: PortShiftNotice | null;
  round: number;
}) {
  if (!shift) return null;
  const landed = shift.round < round;
  return (
    <div className="rounded-2xl px-3 py-2 mb-3 border border-alarm/30 bg-alarm/[0.05]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm leading-none" aria-hidden>
          🧭
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-alarm">
          Harbormaster · {landed ? "in force" : "called"}
        </span>
        <span className="font-display text-sm font-semibold">
          {shift.by.name}
        </span>
        <span className="text-[11px] font-medium rounded-lg px-1.5 py-0.5 border border-alarm/25 tabular-nums">
          {portShiftLine(shift)}
        </span>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/80">
        {landed
          ? `Called in leg ${shift.round}. Every price at that port this leg was drawn against it.`
          : `Called in leg ${shift.round}. The market that opens next leg is the one that answers it, and a later call in this leg replaces it.`}
      </p>
    </div>
  );
}

/**
 * The hand itself, offered only to the captain the harbor put ashore.
 *
 * Both directions are buttons rather than a toggle beside one button,
 * because the two are the whole of the power and a captain reading this
 * for the first time should see that prices can be pushed either way.
 */
export function HarbormasterConsole({
  game,
  maroon,
}: {
  game: GameState;
  maroon: Maroon;
}) {
  const [port, setPort] = useState("");
  if (!maroon.canShift) return null;
  const pending =
    maroon.shift?.round === game.currentRound ? maroon.shift : null;

  return (
    <div className="rounded-xl border border-alarm/25 bg-alarm/[0.04] p-4 mb-4">
      <h3 className="text-center font-semibold mb-1 text-sm">
        🧭 The Harbormaster&apos;s Hand
      </h3>
      <p className="text-center text-xs text-muted-foreground mb-3 leading-relaxed">
        The harbor put you ashore and left you its own lever: once a leg, name a
        port and lean every price at it by a tenth, up or down. The call is
        public, and the market that opens next leg is the one that answers it.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <select
          value={port}
          onChange={(e) => setPort(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          aria-label="Port to lean"
        >
          <option value="">Choose a port</option>
          {maroon.ports.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          disabled={!port}
          onClick={() => maroon.callShift(port, 1)}
        >
          Lean prices up
        </Button>
        <Button
          variant="outline"
          disabled={!port}
          onClick={() => maroon.callShift(port, -1)}
        >
          Lean prices down
        </Button>
      </div>
      {pending && (
        <p className="text-center text-[11px] mt-2">
          Your call stands for leg {pending.round + 1}:{" "}
          <span className="font-medium">{portShiftLine(pending)}</span>
        </p>
      )}
      <p className="text-center text-[10px] text-muted-foreground/80 mt-2">
        A later call in this leg replaces this one.
      </p>
    </div>
  );
}
