"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  PATH_SWITCH_FROM_ROUND,
  PATH_SWITCH_TO_ROUND,
} from "@/lib/game/constants/paths";
import { pathSwitchFee } from "@/lib/game/draft";
import { pathSwitchBlocked } from "@/lib/game/engine";
import { pathDraftOn } from "@/lib/game/flags";
import { PATH_IDS, pathConfig } from "@/lib/game/paths";
import type { PathId } from "@/lib/game/paths";
import type { GameState } from "@/lib/game/types";
import { Repeat } from "lucide-react";
import { PhaseError } from "../phases/PhaseShared";

/**
 * [D7: the draft, and switching] What this captain sails as.
 *
 * The identity is a line on the captain's own rail rather than a card in
 * the stage, and the reason is the company it keeps: round, waters, funds,
 * reputation and what round end will take are all readings about this
 * captain, and what they sail as is the sixth. In the stage it was a card
 * about a person standing in a column of cards about the table, and it cost
 * the board a slice of a column that has none to spare.
 *
 * The chip is the identity itself, in the words the path's own record uses
 * (see @/lib/game/paths), so a captain reading "Quartermaster" here reads
 * the same two words the locked order board and the fleet log use. A
 * captain who holds no path reads that instead, which is a real state
 * rather than an empty one: a table can be mid draft, or can have been
 * dealt to before this captain arrived. Neither state wears a section
 * label above it: the chip already names itself, the empty state already
 * opens with "No path yet", and the label over them was the same fact
 * said twice on a rail that counts its rows.
 *
 * The switch lives behind the chip rather than open on the rail, and the
 * reason is that it is a rare move with consequences: a permanent row of
 * four other paths would be four buttons a captain never presses, taking a
 * third of a rail that has to hold a hold, a ship and a ledger. What the
 * chip opens says the whole price before the click, including the half of
 * it that is not a number: the forfeiture and the publication. That is the
 * plan's own design point read as a screen: "the price of changing your
 * identity is that everyone knows."
 *
 * What the popover prints of a refusal is the engine's own sentence
 * wherever the engine has one: the line above the buttons is the same
 * guard the press runs (see pathSwitchBlocked), so the reason a destination
 * is refused and the reason the engine would refuse it are one sentence
 * rather than two that could drift. The error under the chip is the room's,
 * and it carries the room's own two for the cases the engine is never
 * handed, a frame naming a path this build does not have and a build with
 * the switch off (see the path:switch handler).
 */
export function PathChip({
  game,
  error,
  onSwitch,
  onDismissError,
}: {
  game: GameState;
  error: string | null;
  onSwitch: (path: PathId) => void;
  onDismissError: () => void;
}) {
  const [open, setOpen] = useState(false);

  // With the switch off nothing deals a path, so this chip would read "no
  // path" on every screen in every harbor. It draws nothing at all instead,
  // which is the voyage this tree sailed before the draft existed.
  if (!pathDraftOn(game.mode)) return null;

  if (game.path === null) {
    return (
      <div className="shrink-0">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          No path yet. A path is dealt when the voyage sails.
        </p>
      </div>
    );
  }

  // Read through pathConfig off the save's own id, which the load heal has
  // already answered as a path this build has (see normalizePath), so the
  // lookup always answers.
  const card = pathConfig(game.path)!;
  const fee = pathSwitchFee(game.renownLevel);
  const others = PATH_IDS.filter((id) => id !== game.path);

  // One call for every destination the popover offers, because the guard's
  // answer is the same for all of them: the window, the seat, the once a
  // voyage stamp and the price are facts about this captain and this leg
  // rather than about where they are going. The one per destination answer
  // ("you already hold that path") is the path this captain is on, which is
  // the one the list below does not offer.
  const blocked = others.length > 0 ? pathSwitchBlocked(game, others[0]) : null;

  return (
    <div className="shrink-0">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Your path is ${card.name}. Change your papers.`}
            className="flex w-full items-center gap-2 rounded-lg border border-voyage/20 bg-voyage/[0.04] px-2.5 py-1.5 text-left transition hover:bg-voyage/[0.09]"
          >
            <span className="text-base leading-none">{card.crest}</span>
            <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold">
              {card.name}
            </span>
            <Repeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[19rem] space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-voyage">
            Your papers
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg leading-none">{card.crest}</span>
            <span className="font-display text-sm font-semibold">
              {card.name}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {card.signature}
          </p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Once a voyage, at a port in legs {PATH_SWITCH_FROM_ROUND} through{" "}
            {PATH_SWITCH_TO_ROUND}, for {fee} Gold at your Renown. Unfulfilled
            pathbound orders are forfeited, and the whole fleet sees the change
            written into the voyage log.
          </p>
          {blocked !== null && (
            <p className="text-[11px] leading-relaxed text-alarm">{blocked}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {others.map((id) => {
              const other = pathConfig(id)!;
              return (
                <Button
                  key={id}
                  size="sm"
                  variant="secondary"
                  className="justify-start rounded-lg"
                  disabled={blocked !== null}
                  onClick={() => {
                    onSwitch(id);
                    setOpen(false);
                  }}
                >
                  <span className="mr-1.5">{other.crest}</span>
                  {other.name}
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {error && (
        <PhaseError
          message={error}
          onDismiss={onDismissError}
          className="mt-1.5"
        />
      )}
    </div>
  );
}
