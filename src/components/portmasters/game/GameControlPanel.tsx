"use client";

import { Button } from "@/components/ui/button";
import type { GameState } from "@/lib/game/types";
import type { PhaseClock } from "@/lib/phase-clock";
import { phaseLabel } from "@/lib/game/engine";
import { isGatedPhase } from "@/lib/game/checkpoint";
import { modeConfig } from "@/lib/game/mode";
import { standingOrdersLive } from "@/lib/game/standing";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Save,
  RotateCcw,
  Play,
  ChevronRight,
  Loader2,
  Cloud,
  ScrollText,
} from "lucide-react";
import { ActionSuggester } from "../ActionSuggester";

export function GameControlPanel({
  game,
  saving,
  isHost,
  onSetSail,
  onNextPhase,
  onGuide,
  onSave,
  onRestart,
  waiting,
  readyCount,
  requiredCount,
  clock,
  onStandingOrders,
  onCancelReady,
}: {
  game: GameState;
  saving: boolean;
  isHost: boolean;
  onSetSail: () => void;
  onNextPhase: () => void;
  onGuide: () => void;
  /**
   * [B3: standing orders] Opens the captain's own form. It is not host
   * gated and not phase gated, because the record belongs to the captain
   * rather than to the voyage: it can be written at the pier before the
   * first round and changed mid Market while the clock is running.
   */
  onStandingOrders: () => void;
  onSave: () => void;
  onRestart: () => void;
  waiting: boolean;
  readyCount: number;
  requiredCount: number;
  /**
   * [B2: hard timers, the server as timekeeper] The room's clock while one is
   * running, so the wait says how long it is worth. Optional: a bar drawn
   * before the first ready state arrives, or in a room with the clock
   * switched off, has no countdown to show and says so by passing nothing.
   */
  clock?: PhaseClock | null;
  onCancelReady: () => void;
}) {
  // [B3] The page is the mode's before it is the captain's. A voyage whose
  // mode keeps no standing order has none to write, so the button is not
  // drawn at all and the captain's own switch is read only once there is a
  // page to read it on (see standingOrdersLive, and the standingOrders
  // field on the mode record).
  const ordersOffered = modeConfig(game.mode).standingOrders;
  const ordersLive = ordersOffered && standingOrdersLive(game.standingOrders);

  // Both conditions are the same fact read twice: waiting is only ever set
  // on the recurring Next Phase transition, so the button wears the quiet
  // variant whenever it is not the one to press.
  let startText = "🚢 Set Sail";
  let startDisabled = true;
  let nextText = "⏭️ Continue";
  let nextDisabled = true;

  if (game.gameOver) {
    startText = "⚠️ Game Over";
    startDisabled = true;
    nextDisabled = true;
  } else if (game.phase === "harbor") {
    // Starting the voyage is a one shot host action, not a per player
    // ready vote, so there's no "waiting" state for this button. It's
    // either disabled (not host, or not enough captains yet) or armed.
    if (!isHost) {
      startText = "⏳ Waiting for host…";
      startDisabled = true;
    } else if (requiredCount < 1) {
      startText = "Need one captain";
      startDisabled = true;
    } else if (requiredCount === 1) {
      startText = "Start Solo Practice";
      startDisabled = false;
    } else {
      startText = "Start the Voyage";
      startDisabled = false;
    }
    nextDisabled = true;
  } else if (game.phase === "dawn") {
    startText = "🧭 Drafting Boon...";
    startDisabled = true;
    nextDisabled = true;
  } else if (isGatedPhase(game.mode, game.phase)) {
    // Every phase the ready check gates, which is every phase of the leg
    // except the draft: Dawn is handled by the branch above, so it cannot
    // reach here, because a boon is locked in by choosing one rather than by
    // confirming anything (see lockInBoon in the engine's lifecycle). Read
    // off the room's lap rather than listed, so the button offers exactly
    // the moves the room will actually wait for: a phase added to a lap is a
    // Next Phase step the day it lands, and a phase a mode does not run is
    // not a step at all, which it would be if this asked whether the phase
    // is leg work instead.
    startText = "🚢 On Voyage...";
    startDisabled = true;
    nextText = "⏭️ Next Phase";
    nextDisabled = false;
  } else {
    startText = "🚢 On Voyage...";
    startDisabled = true;
    nextDisabled = true;
  }

  // The ready vote "waiting" state only ever applies to the recurring
  // Next Phase transitions (setting sail is handled above on its
  // own terms), so it always routes to that button.
  //
  // [B2: hard timers, the server as timekeeper] The clock joins the count
  // here, because this bar is the one thing on screen in every phase: a
  // captain waiting on the crew reads both numbers in the same place, and the
  // one that is moving is the one that ends the wait.
  if (waiting) {
    nextText = `⏳ Waiting… (${readyCount}/${requiredCount} ready)`;
    if (clock) nextText += ` · ${clock.label}`;
    nextDisabled = false;
  }

  return (
    <div className="pm-glass rounded-2xl px-3 py-2.5 flex items-center gap-2 flex-wrap">
      <Button
        className={cn("rounded-lg", !startDisabled && "pm-grad-brand")}
        variant={startDisabled ? "secondary" : "default"}
        disabled={startDisabled}
        onClick={onSetSail}
      >
        <Play className="h-4 w-4 mr-1.5" /> {startText}
      </Button>
      <Button
        className={cn(
          "rounded-lg",
          !nextDisabled && !waiting && "pm-grad-voyage",
        )}
        variant={nextDisabled || waiting ? "secondary" : "default"}
        disabled={nextDisabled}
        onClick={waiting ? onCancelReady : onNextPhase}
      >
        {nextText} <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
      <div className="flex-1" />
      {/* Mobile friendly ActionSuggester (the header version is hidden on mobile) */}
      <div className="relative sm:hidden">
        <ActionSuggester game={game} />
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-muted-foreground px-2">
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Cloud className="h-3.5 w-3.5 text-gain" />
          )}
          {saving ? "Saving…" : "Saved"}
          <span className="text-muted-foreground">· {phaseLabel(game)}</span>
        </span>
        {/* [B3: standing orders] Lit only when the set would actually do
            something, which is the switch and at least one instruction
            under it (see standingOrdersLive). A captain who turned the
            switch on and wrote nothing is sailing the default voyage, and
            a button that glowed for them would be promising a seat that
            nothing is going to play. */}
        {ordersOffered && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "rounded-lg",
              ordersLive && "text-standing hover:text-standing",
            )}
            title={
              ordersLive
                ? "Standing orders are written and on"
                : "Write what your seat should do when the clock plays it"
            }
            onClick={onStandingOrders}
          >
            <ScrollText className="h-4 w-4 mr-1.5" /> Standing orders
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="rounded-lg"
          onClick={onGuide}
        >
          <BookOpen className="h-4 w-4 mr-1.5" /> Guide
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-lg"
          onClick={onSave}
        >
          <Save className="h-4 w-4 mr-1.5" /> Save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-lg"
          disabled={!isHost}
          title={
            isHost
              ? "Restart the voyage for everyone in the harbor"
              : "Only the host can restart the voyage"
          }
          onClick={onRestart}
        >
          <RotateCcw className="h-4 w-4 mr-1.5" /> Restart
        </Button>
      </div>
    </div>
  );
}
