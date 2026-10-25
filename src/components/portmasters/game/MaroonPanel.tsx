"use client";

// =====================================================================
// The harbor's heavier vote, and the
// hand it leaves behind.
//
// Four surfaces in one file, for the reason the audit's two are in one:
// they are one interaction read at four moments. The card is the vote
// while the harbor still has it. The strip is what the harbor carries
// afterwards, for the rest of the voyage. The shift strip is what the
// table trades against, while it is in force and while it is only a call.
// The console is what the captain it named does with the rounds they have
// left, and it is the only surface here that one captain sees and the
// rest do not.
//
// The card and the strip are drawn on the harbor's own frame (see
// VoteCard and VoteRevealStrip), which the audit wears too: the two
// votes ask the harbor the same question in the same shape, so what is
// left in this file is the maroon's own, which is what it spends and
// what it leaves behind.
//
// It wears `alarm`, which is the palette's meaning for money out at its
// worst (see palette.css, where the token is described as the color of a
// cost, a loss, an error, a bankruptcy, a raid). The audit wears `intel`
// because it reports what somebody knows; this one takes a ship, and
// dressing the two in the same blue would say they cost the same.
// =====================================================================

import { MaroonResult, PortShiftNotice } from "@/types/realtime/maroon";
import { useState } from "react";
import type { PublicUser } from "@/lib/api";
import { t } from "@/lib/game/i18n";
import {
  MAROON_VOTE_SHARE,
  PORT_SHIFT_PERCENT,
  portShiftLine,
} from "@/lib/game/maroon";
import { modeConfig } from "@/lib/game/mode";
import type { GameState } from "@/lib/game/types";
import { nameCount, tallyRows } from "@/lib/voteTally";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { VoteTallyRows } from "@/components/portmasters/game/VoteTallyRows";
import { type Marks } from "@/components/portmasters/game/VoteSeatPicker";
import { VoteCard } from "./VoteCard";
import { VoteRevealStrip } from "./VoteRevealStrip";
import type { Maroon } from "./phases/PhaseShared";
import { RefusalLine } from "../shared";

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
    <VoteCard
      game={game}
      members={members}
      me={me}
      statuses={statuses}
      tone="alarm"
      icon="🏝️"
      title={t("Maroon")}
      open={open}
      // A vote that has already carried is not a vote with fewer things
      // in it, it is a vote that is over, and the card says so in place
      // of the press rather than beside it.
      carried={
        maroon.carried
          ? t(
              "The harbor has already named {maroon.carried.name} this voyage. The vote is spent: nothing more is asked of this table until a new voyage.",
              { "maroon.carried.name": maroon.carried.name },
            )
          : undefined
      }
      // The rule in plain words, and the two consequences a captain
      // cannot read off the board: the vote is spent the moment it
      // carries, and the captain it names is still sitting here.
      // "One vote a voyage" alone would leave a failed vote looking
      // like a spent one. The share is quoted from its one home (see
      // MAROON_VOTE_SHARE) and read through the pack at each print
      // site; it is the same string the server's own threshold is
      // written beside.
      rule={t(
        "{MAROON_VOTE_SHARE} of the captains still sailing, rounded up, can put one captain ashore. The vote is public. Once a vote carries it is spent for the whole voyage, a vote that falls short can be called again on a later round, and the captain who loses it keeps their seat at the table.",
        { MAROON_VOTE_SHARE: t(MAROON_VOTE_SHARE) },
      )}
      closed={t(
        "This vote opens at round {rung}, and this is round {game.currentRound}. {MAROON_VOTE_SHARE} of the captains still sailing, rounded up, then put one captain ashore: the ship and its hold go to the harbor, half their Gold stays aboard, and the Harbormaster's hand is theirs for the rest of the voyage. One vote can carry a voyage, and a vote that falls short can be called again on a later round.",
        {
          rung,
          "game.currentRound": game.currentRound,
          MAROON_VOTE_SHARE: t(MAROON_VOTE_SHARE),
        },
      )}
      picker={{
        selectLabel: t("Captain to maroon"),
        callLabel: t("Call the vote"),
        pickLabel: (name) => t("Put {name} ashore", { name }),
        myVote: maroon.myVote !== null,
        canVote: maroon.canVote,
        onVote: (target) => maroon.vote(target),
      }}
      refusal={{ error: maroon.error, onDismiss: maroon.clearError }}
      tally={
        <VoteTallyRows
          rows={rows}
          census={maroon.census}
          members={members}
          myVote={maroon.myVote}
          nextStep={(needed) =>
            t(
              "{namesNeeded} on one captain puts that captain ashore and spends the vote for the voyage.",
              { namesNeeded: nameCount(needed) },
            )
          }
        />
      }
      footnote={t(
        "{MAROON_VOTE_SHARE} of the captains still in the voyage carry it, rounded up, and the vote is public: every name behind a target is on this board.",
        { MAROON_VOTE_SHARE: t(MAROON_VOTE_SHARE) },
      )}
    />
  );
}

/**
 * What the harbor did, kept on every screen for the rest of the voyage.
 *
 * It stays because the marooned captain is still at the table and still
 * on this screen: a harbor that forgets the vote the moment it lands would
 * read the empty chair as an accident rather than as a decision the harbor
 * made together.
 */
export function MaroonResultStrip({ result }: { result: MaroonResult | null }) {
  return (
    <VoteRevealStrip
      tone="alarm"
      icon="🏝️"
      title={t("Maroon")}
      finding={result}
      headline={
        result ? t("{name} put ashore", { name: result.target.name }) : null
      }
      dismissLabel={t("Hide the vote")}
    >
      {result ? (
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/80">
          {t(
            "Voted ashore by {voteShare} of the harbor. The ship and everything on it went to the harbor, half their Gold stayed aboard, and the Harbormaster's hand is theirs for the rest of the voyage.",
            { voteShare: t(MAROON_VOTE_SHARE).toLowerCase() },
          )}
        </p>
      ) : null}
    </VoteRevealStrip>
  );
}

/**
 * The market condition the table is trading against.
 *
 * Two tenses from one notice, which is why the round comes in with it: a
 * call made this round has not opened a market yet, and a call made last
 * round is the one every price on screen was drawn from. The strip is not
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
          {t("Harbormaster")} · {landed ? t("in force") : t("called")}
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
          ? t(
              "Called in round {shift.round}. Every price at that port this round was drawn against it.",
              { "shift.round": shift.round },
            )
          : t(
              "Called in round {shift.round}. The market that opens next round is the one that answers it, and a later call in this round replaces it.",
              { "shift.round": shift.round },
            )}
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
        {t("🧭 The Harbormaster's Hand")}
      </h3>
      <p className="text-center text-xs text-muted-foreground mb-3 leading-relaxed">
        {t(
          "The harbor put you ashore and left you its own lever: once a round, name a port and lean every price at it by {shiftPct} percent, up or down. The call is public, and the market that opens next round is the one that answers it.",
          { shiftPct: PORT_SHIFT_PERCENT },
        )}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <Select
          value={port}
          onChange={(e) => setPort(e.target.value)}
          aria-label={t("Port to lean")}
        >
          <option value="">{t("Choose a port")}</option>
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
          {t("Lean prices up")}
        </Button>
        <Button
          variant="outline"
          disabled={!port}
          onClick={() => maroon.callShift(port, -1)}
        >
          {t("Lean prices down")}
        </Button>
      </div>
      <RefusalLine
        className="mt-2"
        error={maroon.shiftError}
        onDismiss={maroon.clearShiftError}
      />
      {pending && (
        <p className="text-center text-[11px] mt-2">
          {t("Your call stands for round {round}:", {
            round: pending.round + 1,
          })}{" "}
          <span className="font-medium">{portShiftLine(pending)}</span>
        </p>
      )}
      <p className="text-center text-[10px] text-muted-foreground/80 mt-2">
        {t("A later call in this round replaces this one.")}
      </p>
    </div>
  );
}
