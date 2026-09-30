"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { PublicUser } from "@/lib/api";
import { ICONS } from "@/lib/game/constants/brand";
import {
  RUMOR_COOLDOWN_ROUNDS,
  RUMOR_SHIFT_FRACTION,
} from "@/lib/game/constants/paths";
import {
  BAZAAR_SELLER_PATH,
  bazaarGoods,
  canPublishRumor,
  rumorCooldownLeft,
  rumorCooldownLine,
  rumorDirectionLine,
  type PublicRumor,
  type RumorDirection,
} from "@/lib/game/engine";
import { bazaarRumorsOn } from "@/lib/game/flags";
import { pathConfig } from "@/lib/game/paths";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
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
 * Everything a captain can do here is one socket frame and nothing else.
 * The desk draws the same rules the server enforces (the cooldown, the
 * goods the coming market trades, the path) so that a refusal is read
 * before the click rather than after it, and none of those readings makes
 * the row: the server's own check is what puts a rumor on the board.
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

  // The goods the market being priced next will trade, which is the list
  // the server checks a publish against and the only list this desk may
  // offer. Read one leg ahead because that is the leg a rumor moves, which
  // is the same reading bazaarGoods itself makes of the leg it is handed.
  const goods = bazaarGoods(game.difficulty, game.currentRound + 1);
  // A selection that is no longer on the list reads as the list's first
  // good rather than as a stale one, which is what keeps the select from
  // drawing a choice the button would then be refused for. A tier that
  // unlocks a good between two legs is the ordinary way to reach this.
  const chosen = goods.includes(good) ? good : (goods[0] ?? "");
  const mine = canPublishRumor(game);
  const cooldown = rumorCooldownLeft(bazaar.rumors, me.id, game.currentRound);
  const canSpeak = mine && cooldown < 1 && goods.length > 0;

  return (
    <div className="rounded-xl border border-parley/15 bg-parley/[0.03] p-4 mb-4">
      <h3 className="text-center font-semibold mb-1 text-sm">
        {SELLER_PATH.crest} {SELLER_PATH.name} Bazaar
      </h3>
      <p className="text-center text-[11px] text-muted-foreground mb-3 max-w-xl mx-auto">
        Once every {RUMOR_COOLDOWN_ROUNDS} legs, an {SELLER_PATH.name} captain
        may spread a word about one commodity. The next port prices that good
        against it, by up to {Math.round(RUMOR_SHIFT_FRACTION * 100)} percent,
        which is the same hand the Harbormaster leans a port with. The whole
        harbor is told who spoke and which good they named, and only the speaker
        knows which way they leaned until the market answers it.
      </p>

      {mine && (
        <div className="rounded-lg border border-parley/15 bg-background/40 p-3 mb-3">
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
                className={cn("rounded-lg pm-grad-parley")}
                onClick={() => bazaar.publish(chosen, direction)}
              >
                {SELLER_PATH.crest} Publish
              </Button>
            </div>
          ) : (
            <p className="text-center text-[11px] text-muted-foreground">
              {goods.length === 0
                ? "No commodity on this route is traded yet, so there is nothing to say."
                : rumorCooldownLine(cooldown)}
            </p>
          )}
          <p className="text-center text-[11px] text-muted-foreground mt-1.5">
            The harbor sees your name and your good the moment you speak. What
            it does not see is which way you leaned, until the port you moved
            has priced it.
          </p>
        </div>
      )}

      {bazaar.error && (
        <p className="text-center text-[11px] text-alarm mb-2">
          {bazaar.error}{" "}
          <button
            type="button"
            onClick={bazaar.clearError}
            className="underline"
          >
            Dismiss
          </button>
        </p>
      )}

      <RumorList rumors={bazaar.rumors} me={me} round={game.currentRound} />
    </div>
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
 */
function RumorList({
  rumors,
  me,
  round,
}: {
  rumors: PublicRumor[];
  me: PublicUser;
  round: number;
}) {
  const shown = rumors.filter((r) => r.round >= round - 1);
  if (shown.length === 0) {
    return (
      <p className="text-center text-xs text-muted-foreground py-3">
        Nobody has spoken at the bazaar yet this voyage. A rumor is the only way
        an honest captain can move a price, and the whole harbor will see who
        said it.
      </p>
    );
  }
  // Newest first, and within one leg the last captain to speak first. The
  // list arrives in the order the room heard it, so a reverse is the whole
  // of the ordering rather than a sort with a tie break to get wrong.
  const ordered = [...shown].reverse();
  return (
    <div className="space-y-1.5">
      {ordered.map((row) => (
        <RumorRow key={row.id} row={row} me={me} round={round} />
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
  round,
}: {
  row: PublicRumor;
  me: PublicUser;
  round: number;
}) {
  const mine = row.publisherUserId === me.id;
  const standing = row.round >= round;
  // Narrowed once rather than tested inside the markup, because the clause
  // below reads the direction and a row that has not been answered yet
  // carries none: what the two cases draw is the whole of the difference
  // between a rumor the table is still guessing at and one it has priced.
  const direction = row.direction;
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
          Bazaar · {standing ? "waiting" : `leg ${row.round}`}
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
          : "The market that opened this leg was priced against it, so the direction is public now. A price that moved is not proof of anything on its own."}
      </p>
    </div>
  );
}
