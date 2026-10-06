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
import type { PublicUser } from "@/lib/api";
import {
  MAROON_VOTE_SHARE,
  PORT_SHIFT_FRACTION,
  portShiftLine,
} from "@/lib/game/maroon";
import { modeConfig } from "@/lib/game/mode";
import type { GameState } from "@/lib/game/types";
import type { useMaroon } from "@/lib/use-maroon";
import { nameCount, tallyRows } from "@/lib/voteTally";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { VoteTallyRows } from "@/components/portmasters/game/VoteTallyRows";
import {
  VoteSeatPicker,
  type Marks,
} from "@/components/portmasters/game/VoteSeatPicker";
import { VoteCardShell, VoteRefusal } from "./VoteCardShell";

type Maroon = ReturnType<typeof useMaroon>;

/**
 * The two questions the Parley board asks about this vote, answered once
 * beside the vote itself so the card and the Harbor Business fold that
 * holds it cannot disagree about when the harbor is voting (see
 * Parley.tsx).
 */
export function maroonVoteOpen(game: GameState, maroon: Maroon): boolean {
  const rung = modeConfig(game.mode).maroonFrom;
  return rung !== null && maroon.result === null && game.currentRound >= rung;
}

export function maroonCardShown(game: GameState, maroon: Maroon): boolean {
  const rung = modeConfig(game.mode).maroonFrom;
  if (rung === null || game.phase !== "parley") return false;
  // The open window, or a window this voyage can still reach. A carried
  // vote is neither, and it leaves the board because the result strip
  // carries it from there.
  return (
    maroonVoteOpen(game, maroon) ||
    (maroon.result === null && rung <= game.maxRounds)
  );
}

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
  // The leg is carried with the pick rather than reset by an effect: a
  // target chosen in a leg the vote fell short in is not a target this
  // leg's card keeps one press away, and a reading that cannot represent
  // a stale choice beats one cleared a frame after it showed.
  const [pick, setPick] = useState({ round: -1, target: "" });
  const target = pick.round === game.currentRound ? pick.target : "";

  // The visibility rule is the reader's (maroonCardShown): the open
  // window, or a window still ahead this voyage. The body still explains
  // the vote before the rung, for the reason the audit card's does: a
  // mode whose headline mechanic nobody has heard of is a mechanic nobody
  // uses, and inside the Harbor Business fold that explanation costs the
  // board nothing (see Parley.tsx).
  const rung = modeConfig(game.mode).maroonFrom;
  if (rung === null) return null;
  if (!maroonCardShown(game, maroon)) return null;
  const open = maroonVoteOpen(game, maroon);
  const rows = tallyRows(maroon.votes, members);

  return (
    <VoteCardShell tone="alarm" icon="🏝️" title="Maroon">
      {open ? (
        maroon.carried ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            The harbor has already named {maroon.carried.name} this voyage. The
            vote is spent: nothing more is asked of this table until a new
            voyage.
          </p>
        ) : (
          <>
            {/* The rule in plain words, and the two consequences a captain
              cannot read off the board: the vote is spent the moment it
              carries, and the captain it names is still sitting here.
              "One vote a voyage" alone would leave a failed vote looking
              like a spent one. The share is quoted from its one home (see
              MAROON_VOTE_SHARE), which is the same string the server's own
              threshold is written beside. */}
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              {`${MAROON_VOTE_SHARE} of the captains still sailing, rounded up, can put one captain ashore. The vote is public. Once a vote carries it is spent for the whole voyage, a vote that falls short can be called again on a later leg, and the captain who loses it keeps their seat at the table.`}
            </p>
            <VoteSeatPicker
              selectLabel="Captain to maroon"
              target={target}
              onPick={(id) => setPick({ round: game.currentRound, target: id })}
              members={members}
              me={me}
              statuses={statuses}
              myVote={maroon.myVote !== null}
              canVote={maroon.canVote}
              onVote={() => maroon.vote(target)}
              callLabel="Call the vote"
              pickLabel={(name) => `Put ${name} ashore`}
            />
            <VoteRefusal error={maroon.error} onDismiss={maroon.clearError} />
            {/* The block below owns every word of the count, the captain's
                own name and what the vote does with the names it needs:
                a panel's own half of that reading would be a second
                answer to one question. */}
            <VoteTallyRows
              rows={rows}
              census={maroon.census}
              members={members}
              myVote={maroon.myVote}
              nextStep={(needed) =>
                `${nameCount(needed)} on one captain puts that captain ashore and spends the vote for the voyage.`
              }
            />
            <p className="text-[10px] text-muted-foreground/80 mt-2">
              {`${MAROON_VOTE_SHARE} of the captains still in the voyage carry it, rounded up, and the vote is public: every name behind a target is on this board.`}
            </p>
          </>
        )
      ) : (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {`This vote opens at leg ${rung}, and this is leg ${game.currentRound}. ${MAROON_VOTE_SHARE} of the captains still sailing, rounded up, then put one captain ashore: the ship and its hold go to the harbor, half their Gold stays aboard, and the Harbormaster's hand is theirs for the rest of the voyage. One vote can carry a voyage, and a vote that falls short can be called again on a later leg.`}
        </p>
      )}
    </VoteCardShell>
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
    <div className="rounded-2xl px-3 py-2 border border-alarm/40 bg-alarm/[0.06] ring-1 ring-alarm/20">
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
        {`Voted ashore by ${MAROON_VOTE_SHARE.toLowerCase()} of the harbor. The ship and everything on it went to the harbor, half their Gold stayed aboard, and the Harbormaster's hand is theirs for the rest of the voyage.`}
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
    <div className="rounded-2xl px-3 py-2 border border-alarm/30 bg-alarm/[0.05]">
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
 *
 * It carries its own refusal block, the same one the two vote cards
 * print: this is the only place a call can be refused and this is the
 * only surface the captain who made it is looking at (see the shiftError
 * in use-maroon for why it is not the card's block that answers here).
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
        port and lean every price at it by{" "}
        {Math.round(PORT_SHIFT_FRACTION * 100)} percent, up or down. The call is
        public, and the market that opens next leg is the one that answers it.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <Select
          value={port}
          onChange={(e) => setPort(e.target.value)}
          aria-label="Port to lean"
        >
          <option value="">Choose a port</option>
          {maroon.ports.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
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
      <VoteRefusal
        error={maroon.shiftError}
        onDismiss={maroon.clearShiftError}
      />
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
