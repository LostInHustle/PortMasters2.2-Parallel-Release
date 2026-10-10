"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { PublicUser } from "@/lib/api";
import { ICONS } from "@/lib/game/constants/brand";
import {
  RUMOR_COOLDOWN_ROUNDS,
  RUMOR_SHIFT_PERCENT,
} from "@/lib/game/constants/paths";
import {
  BAZAAR_SELLER_PATH,
  bazaarGoods,
  canPublishRumor,
  rumorCanLand,
  rumorClosingLine,
  rumorCooldownLeft,
  rumorDirectionLine,
  rumorNextLeg,
  type PublicRumor,
  type RumorDirection,
} from "@/lib/game/engine";
// The three readers the desk names and reads its legs with, taken from the
// module that states the rule rather than from the engine barrel: the
// barrel's bazaar block carries the readers it already had, and these are
// the desk's own naming of a leg, which is where the rule and the sentence
// about it were one edit apart until they moved here.
import {
  rumorLandedLine,
  rumorLandsOn,
  rumorWaitLine,
} from "@/lib/game/engine/bazaar";
import { bazaarRumorsOn } from "@/lib/game/flags";
import { pathConfig } from "@/lib/game/paths";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { RefusalLine } from "../shared";
import { MarketBlock, MarketEmpty, MarketPanel } from "./OfferBoard";
import type { Bazaar } from "./phases/PhaseShared";

// The speaking path's own record, resolved once at module load rather than
// on every row, the same way the escort market and the bench resolve
// theirs. The assertion is only the type checker asking for a proof it
// cannot see through a lookup by value (see pathConfig).
const SELLER_PATH = pathConfig(BAZAAR_SELLER_PATH)!;

/**
 * [D5: Aroma: the Bazaar Rumor] The desk, drawn at the Parley table under
 * the protection market because it is the third thing sold at this table
 * and the only one of the three that sells information rather than a
 * promise.
 *
 * The paragraph at the top is doing real work rather than decorating the
 * panel, which is worth stating because it is the one part of this feature
 * the plan argues for by name: "If every price move is treated as a
 * confession, the rumor is not loud enough in the interface." So the
 * screen says three things plainly, in this order: what a rumor does to
 * the next port, that the fleet is told who spoke and which good they
 * named, and that the direction stays with the speaker until the market
 * answers it. A captain who reads that paragraph understands the mechanic
 * well enough to be suspicious of a price correctly, which is the whole
 * measurement the plan sets.
 *
 * Every reader is then handed the desk's own answer to the one question
 * they came here with, whichever of the two readers they are. That block
 * is the half of this panel that was missing, and it is missing from a
 * market this shape more easily than from the two above it: an escort and
 * a refit are bought and sold by captains who hold no path, so their desks
 * have something to draw for everybody, while a rumor is one path's single
 * action. So the block below says, for the captain who may speak, whether
 * they may speak now and, if not, exactly why and which leg the wait ends
 * on; and for the captain who may not, that this seat is not theirs and
 * what reading the board is for. Neither answer is a decoration: the plan's
 * own worry is a table that cannot tell the feature from a defect, and a
 * captain who holds no path has no other way to learn that the silence is
 * somebody else's turn rather than a broken button.
 *
 * Everything a captain can do here is one socket frame and nothing else.
 * The desk draws the same rules the server enforces (the cooldown, the
 * goods the coming market trades, the path, and the closing leg that has
 * no market left to move) so that a refusal is read before the click
 * rather than after it, and none of those readings makes the row: the
 * server's own check is what puts a rumor on the board.
 *
 * A captain who holds no path reads the board and nothing else, which is
 * what makes this a market rather than a screen: the fleet needs to see
 * who spoke whichever path they sail, and that is the half of the feature
 * that makes a price move attributable.
 */
export function BazaarRumors({
  game,
  bazaar,
  me,
}: {
  game: GameState;
  bazaar: Bazaar;
  me: PublicUser;
}) {
  // Both held above the switch check so this component's hooks never
  // depend on the build it is in, the rule the escort panel states.
  const [good, setGood] = useState("");
  const [direction, setDirection] = useState<RumorDirection>(1);

  if (!bazaarRumorsOn(game.mode)) return null;

  // The leg a rumor spoken right now would be priced by, read through the
  // one reader for it (see rumorLandsOn) rather than counted here: the
  // goods list below is read against this leg and so is every line this
  // desk prints about it, so a desk whose two readings of one leg came
  // apart is not a shape this file can take.
  const landsOn = rumorLandsOn({ round: game.currentRound });
  // The goods the market being priced next will trade, which is the list
  // the server checks a publish against and the only list this desk may
  // offer. Read one leg ahead because that is the leg a rumor moves, which
  // is the same reading bazaarGoods itself makes of the leg it is handed.
  const goods = bazaarGoods(game.difficulty, landsOn);
  // A selection that is no longer on the list reads as the list's first
  // good rather than as a stale one, which is what keeps the select from
  // drawing a choice the button would then be refused for. A tier that
  // unlocks a good between two legs is the ordinary way to reach this.
  const chosen = goods.includes(good) ? good : (goods[0] ?? "");
  const mine = canPublishRumor(game);
  const cooldown = rumorCooldownLeft(bazaar.rumors, me.id, game.currentRound);
  // The leg the bazaar hears this captain again, read off the same rows
  // the server counts the refusal off. A count of legs answers how long
  // and not when, and "when" is the question a captain brings to a desk
  // with the legs already numbered above it.
  const nextLeg = rumorNextLeg(bazaar.rumors, me.id);
  // The leg the hush a publish right now would end on, read through the
  // same reader the confirmation below reports with: the row this click
  // would write stands in for itself, so the form's promise and the
  // receipt that answers it a moment later are one number rather than two
  // counts that agree until one of them is edited.
  const quietUntil = rumorNextLeg(
    [...bazaar.rumors, { publisherUserId: me.id, round: game.currentRound }],
    me.id,
  );
  // The one leg of a voyage where a rumor would move nothing, read off the
  // pinned length on this captain's own state: the same reading the server
  // makes off the room (see rumorCanLand). The voyage length is pinned
  // rather than recomputed for the reason every reader of it is (see
  // maxRounds in the game types).
  const closesHere = !rumorCanLand(game.currentRound, game.maxRounds);
  const canSpeak = mine && !closesHere && cooldown < 1 && goods.length > 0;
  // This captain's own row for the leg the room is standing in, which is
  // the confirmation: a publish is answered by a broadcast rather than by
  // an acknowledgement, so the desk reads the room's own board back rather
  // than remembering what it asked for. A client that kept its own receipt
  // would be a second record of a fact the server already holds.
  const myRow = bazaar.rumors.find(
    (row) => row.publisherUserId === me.id && row.round === game.currentRound,
  );
  const myLean = myRow?.direction ?? null;
  // The reason the desk is quiet, in the one sentence that knows how long
  // the wait is and whether this voyage reaches the leg it ends on (see
  // rumorWaitLine): a captain who spoke late enough to be quiet past the
  // last round is told the voyage is the reason, rather than sent to a leg
  // that never opens.
  const closedOn =
    cooldown >= 1
      ? rumorWaitLine(bazaar.rumors, me.id, game.currentRound, game.maxRounds)
      : "";

  return (
    <MarketPanel
      title={`${SELLER_PATH.crest} ${SELLER_PATH.name} Bazaar`}
      intro={
        <>
          Once every {RUMOR_COOLDOWN_ROUNDS} legs, each {SELLER_PATH.name}{" "}
          captain may spread a word about one commodity, here at the Parley. The
          next port prices that good against it, by up to {RUMOR_SHIFT_PERCENT}{" "}
          percent, which is the same hand the Harbormaster leans a port with.
          The whole harbor is told who spoke and which good they named, and only
          the speaker knows which way they leaned until the port they named has
          priced it.
        </>
      }
    >
      <MarketBlock>
        {mine ? (
          <>
            {canSpeak ? (
              <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                <span className="text-muted-foreground">Speak for</span>
                <Select
                  value={chosen}
                  onChange={(e) => setGood(e.target.value)}
                  aria-label="Good the rumor is about"
                >
                  {goods.map((g) => (
                    <option key={g} value={g}>
                      {ICONS[g]} {g}
                    </option>
                  ))}
                </Select>
                <span className="text-muted-foreground">leaning</span>
                {/* Both directions are buttons rather than a toggle, for the
                    reason the Harbormaster's console gives: the two are the
                    whole of the choice, and a captain reading this for the
                    first time should see that a price can be pushed either
                    way. The selected one wears the phase's gradient. */}
                <Button
                  size="sm"
                  className={cn(
                    "h-9 rounded-lg",
                    direction === 1 && "pm-grad-parley",
                  )}
                  variant={direction === 1 ? "default" : "secondary"}
                  onClick={() => setDirection(1)}
                >
                  📈 Higher
                </Button>
                <Button
                  size="sm"
                  className={cn(
                    "h-9 rounded-lg",
                    direction === -1 && "pm-grad-parley",
                  )}
                  variant={direction === -1 ? "default" : "secondary"}
                  onClick={() => setDirection(-1)}
                >
                  📉 Lower
                </Button>
                <Button
                  className="rounded-lg pm-grad-parley"
                  onClick={() => bazaar.publish(chosen, direction)}
                >
                  {SELLER_PATH.crest} Publish
                </Button>
              </div>
            ) : myLean !== null && myRow ? (
              // The confirmation, read off the board the server sent back
              // rather than off anything this screen remembers: the row is
              // the receipt, and it is also the only place this captain is
              // owed the direction they chose.
              <p className="text-center text-xs leading-relaxed">
                <span className="font-semibold text-due">Spoken.</span> Your
                rumor is on the board and the harbor has your name and{" "}
                {myRow.good}. Only you know which way it leans:{" "}
                {rumorDirectionLine({ good: myRow.good, direction: myLean })}.
                The table reads it the moment the port of leg{" "}
                {rumorLandsOn(myRow)} prices it. The bazaar is quiet for you
                until leg {nextLeg}.
              </p>
            ) : (
              // Every way of being unable to speak, in the order the
              // reasons are true: the closing leg first, then a route with
              // nothing to name on it, then the hush a recent publish
              // left. The desk never draws silence here, because a drawer
              // with nothing in it reads as a broken button rather than as
              // the turn somebody else is holding.
              <p className="text-center text-[11px] text-muted-foreground">
                {closesHere
                  ? rumorClosingLine()
                  : goods.length === 0
                    ? "No commodity on this route is traded yet, so there is nothing to say."
                    : closedOn}
              </p>
            )}
            {canSpeak && (
              // The two legs this click is about, said under the form
              // rather than discovered after it: the port the rumor would
              // be priced by, and the leg the hush it costs ends on. Both
              // come off the engine's own readers, the first through
              // rumorLandsOn and the second through the same reader the
              // confirmation reports with, so the promise made here and
              // the receipt that answers it are one pair of numbers.
              <p className="text-center text-[11px] text-muted-foreground mt-1.5">
                The port of leg {landsOn} prices it. Speaking now quiets the
                bazaar for you until leg {quietUntil}.
              </p>
            )}
          </>
        ) : (
          // The reader who may not speak, told so rather than left to work
          // it out from a form that is not there. What this captain is owed
          // is not the action but the read: the path may be held by more
          // than one captain at this table, and the whole point of the
          // board is that everyone who did not speak can see who did and
          // what they named. The cadence stays the intro's to state, so
          // this paragraph carries the refusal and the pointer rather than
          // spelling the rule a second time.
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            Speaking at the bazaar belongs to the {SELLER_PATH.name} path, and
            you do not hold it this voyage. Whoever holds it is named in the
            voyage log, and the board below names them the moment they speak.
          </p>
        )}
      </MarketBlock>

      <RefusalLine
        className="text-center mb-2"
        error={bazaar.error}
        onDismiss={bazaar.clearError}
      />

      <RumorList rumors={bazaar.rumors} me={me} game={game} />
    </MarketPanel>
  );
}

/**
 * The board itself: what the harbor has been told lately, newest first.
 *
 * Two legs of it and no more. A rumor is a claim about the next port, so
 * the rows that matter are the ones still standing and the ones the market
 * just answered; a rumor from leg two is a fact about a price three legs
 * ago that the fleet has already traded through. Slicing here rather than
 * on the server keeps the cooldown honest: the client holds every row of
 * the voyage, because the wait between two of a captain's own rumors is
 * measured off them, and what a screen draws is a different question from
 * what the rule needs.
 *
 * The window is the reason the empty board's claim is read off the whole
 * list rather than off the two legs it draws. "Nobody has spoken yet this
 * voyage" is a claim about every row the room holds, and it would be false
 * the moment a captain speaks and then lets a leg or two go by: the
 * fleet's own rumor would be off the board while the board announced that
 * the voyage had been silent. So the claim is read off the whole list and
 * the branch below says which of the two situations the reader is in.
 */
function RumorList({
  rumors,
  me,
  game,
}: {
  rumors: PublicRumor[];
  me: PublicUser;
  game: GameState;
}) {
  const shown = rumors.filter((r) => r.round >= game.currentRound - 1);
  if (shown.length === 0) {
    return (
      <MarketEmpty>
        {rumors.length === 0
          ? "Nobody has spoken at the bazaar yet this voyage."
          : "Nobody has spoken in this leg or the one before it. The board keeps those two legs and no more. Older rows moved markets the room has already priced and traded through."}
      </MarketEmpty>
    );
  }
  // Newest first, and within one leg the last captain to speak first. The
  // list arrives in the order the room heard it, so a reverse is the whole
  // of the ordering rather than a sort with a tie break to get wrong.
  const ordered = [...shown].reverse();
  return (
    <div className="space-y-1.5">
      {ordered.map((row) => (
        <RumorRow key={row.id} row={row} me={me} game={game} />
      ))}
    </div>
  );
}

/**
 * One row, read by whether the market has answered it and by whose it is.
 *
 * The direction is drawn as the clause the engine writes (see
 * rumorDirectionLine) rather than as a sentence built here, so the number a
 * captain reads and the number the market applied are one number. A row
 * whose direction this captain is not owed yet is drawn without the clause
 * and says so in words, because the absence is the mechanic: the fleet is
 * meant to know that somebody moved a price and not which way, and a row
 * that simply showed nothing would read as a rumor that did nothing.
 */
function RumorRow({
  row,
  me,
  game,
}: {
  row: PublicRumor;
  me: PublicUser;
  game: GameState;
}) {
  const mine = row.publisherUserId === me.id;
  const standing = row.round >= game.currentRound;
  // Narrowed once rather than tested inside the markup, because the clause
  // below reads the direction and a row that has not been answered yet
  // carries none: what the two cases draw is the whole of the difference
  // between a rumor the table is still guessing at and one it has priced.
  const direction = row.direction;
  // The leg this row's market opens in, off the one reader for it (see
  // rumorLandsOn), so the leg the chip names and the leg the footnote
  // under it names are the same leg rather than the same arithmetic
  // written twice.
  const landsOn = rumorLandsOn(row);
  // The port's own answer to the row, which is readable on exactly the leg
  // it priced the row and off exactly the cards this captain holds: from
  // the next leg on, the state's market is the leg the room is standing
  // in, and the reader answers null for a market that has not been drawn
  // (see rumorLandedLine). It is drawn on this captain's own rows because
  // it is written about their own rumor: a rumor moves each reader's own
  // draw, so the outcome a captain can check is the outcome of their own
  // call, and the rest of the table is owed the reveal rather than a
  // sentence about somebody else's market.
  const outcome =
    mine && !standing ? rumorLandedLine(row, game.resourceCards) : null;
  return (
    <div
      className={cn(
        "rounded-md px-3 py-2 text-xs border",
        mine
          ? "bg-due/[0.06] border-due/20"
          : "bg-background/60 border-black/5 dark:border-white/10",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm leading-none" aria-hidden>
          {SELLER_PATH.crest}
        </span>
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            standing ? "text-parley" : "text-muted-foreground",
          )}
        >
          Bazaar ·{" "}
          {standing
            ? "waiting"
            : `spoken in leg ${row.round} · priced at leg ${landsOn}`}
        </span>
        <span className="font-display text-sm font-semibold">
          {mine ? "You" : row.publisherName}
        </span>
        {direction !== null && (
          <span className="text-[11px] font-medium rounded-lg px-1.5 py-0.5 border border-parley/25 tabular-nums">
            {rumorDirectionLine({ good: row.good, direction })}
          </span>
        )}
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/80">
        {standing
          ? mine
            ? "Spoken in this leg. The next port prices this good against it, and the table reads which way you leaned the moment it does."
            : "Spoken in this leg. The direction belongs to the speaker until the next port prices it, so nobody at this table can tell a call from a lie yet."
          : `The market of this leg was priced against it, so the direction is public now.${
              outcome ? ` ${outcome}` : ""
            }`}
      </p>
    </div>
  );
}
