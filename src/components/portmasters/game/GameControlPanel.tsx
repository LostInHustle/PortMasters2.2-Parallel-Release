"use client";

import { Button } from "@/components/ui/button";
import type { GameState } from "@/lib/game/types";
import { phaseLabel } from "@/lib/game/engine";
import { isGatedPhase } from "@/lib/game/checkpoint";
import { t } from "@/lib/game/i18n";
import { modeConfig } from "@/lib/game/mode";
import { standingOrdersLive } from "@/lib/game/standing";
import { readyLine } from "@/lib/use-phase-sync";
import { usePhaseClock } from "@/lib/use-phase-clock";
import type { PhaseDeadline } from "@/lib/phase-clock";
import { HOST_ONLY_RESTART, START_VOYAGE } from "@/lib/game/constants/copy";
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
  Keyboard,
  X,
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
  harborCount,
  clockDeadline,
  onStandingOrders,
  onCancelReady,
  onShortcuts,
}: {
  game: GameState;
  saving: boolean;
  isHost: boolean;
  onSetSail: () => void;
  onNextPhase: () => void;
  onGuide: () => void;
  /**
   * Opens the captain's own form. It is not host gated and not phase
   * gated, because the record belongs to the captain
   * rather than to the voyage: it can be written at the pier before the
   * first round and changed mid Market while the clock is running.
   */
  onStandingOrders: () => void;
  onSave: () => void;
  onRestart: () => void;
  waiting: boolean;
  readyCount: number;
  requiredCount: number;
  // The captains in the harbor, which is a fact about harbor membership and
  // not about the ready check. The two were the same number until the
  // waiting roster learned to exclude the pier (see waitingRosterSet in
  // src/server/realtime/checkpoint.ts, and isGatedPhase behind it): the
  // harbor is not a seat the harbor readies out of, so every captain
  // standing at it fell out of the roster, the count read zero, and the
  // host's own Set Sail button disabled itself with "Need one captain"
  // while the server would have accepted the start. The ready check's
  // denominator is the right answer to "who does this seat wait on" and
  // the wrong one to "who is in the harbor", so the harbor asks the
  // roster the harbor already broadcasts rather than reusing the vote's.
  harborCount: number;
  /**
   * The harbor's deadline, the seat's budget, and the moment this client
   * saw them: the published numbers the countdown is composed from.
   * Optional: a bar drawn before
   * the first ready state arrives, or in a harbor with the clock switched
   * off, has no countdown to show and says so by passing nothing.
   *
   * The numbers rather than the countdown, because this bar is the one
   * thing on screen in every phase and the ticking belongs to the panel
   * that draws it: a ticker in the harbor's shared hook would redraw every
   * board under it once a second to move this one number.
   */
  clockDeadline?: PhaseDeadline | null;
  onCancelReady: () => void;
  /**
   * Opens the list of every key this screen answers to. It was the row of
   * key caps under the bar and is now one glyph on it, on the wide layout
   * only: the list is a list of keys, a phone has none of them, and four
   * caps of chrome between the captain and the board was the clutter the
   * row was (see KeyboardShortcutHelp, which kept its own hotkey all along).
   */
  onShortcuts: () => void;
}) {
  // The page is the mode's before it is the captain's. A voyage whose
  // mode keeps no standing order has none to write, so the button is not
  // drawn at all and the captain's own switch is read only once there is a
  // page to read it on (see standingOrdersLive, and the standingOrders
  // field on the mode record).
  const ordersOffered = modeConfig(game.mode).standingOrders;
  const ordersLive = ordersOffered && standingOrdersLive(game.standingOrders);

  // The harbor's clock, ticked here because this bar is where it is drawn.
  // The deadline, the budget and the moment this client saw them are the
  // published numbers; the countdown is composed from them in the language
  // the captain is holding.
  const clock = usePhaseClock(clockDeadline ?? null);

  // Both conditions are the same fact read twice: waiting is only ever set
  // on the recurring Next Phase transition, so the button wears the quiet
  // variant whenever it is not the one to press. The labels carry no
  // emoji: each button already wears its own glyph from the icon set the
  // rest of the harbor speaks in, and the two together were one mark
  // competing with the other on the same line.
  let startText = t("Set Sail");
  let startDisabled = true;
  let nextText = t("Continue");
  let nextTitle: string | undefined;
  let nextDisabled = true;

  if (game.gameOver) {
    startText = t("Voyage Ended");
    startDisabled = true;
    nextDisabled = true;
  } else if (game.phase === "harbor") {
    // Starting the voyage is a one shot host action, not a per player
    // ready vote, so there's no "waiting" state for this button. It's
    // either disabled (not host, or not enough captains yet) or armed.
    if (!isHost) {
      startText = t("Waiting for host…");
      startDisabled = true;
    } else if (harborCount < 1) {
      startText = t("Need one captain");
      startDisabled = true;
    } else if (harborCount === 1) {
      startText = t("Start Solo Practice");
      startDisabled = false;
    } else {
      startText = t(START_VOYAGE);
      startDisabled = false;
    }
    nextDisabled = true;
  } else if (game.phase === "path_draft") {
    // The deal's own seat, handled ahead of the gated
    // branch below because this phase *is* a gated one: left to that branch
    // it would offer an enabled Next Phase over a seat canLeavePhase
    // refuses, which is the ready set no departure could carry out that
    // leaveRefusal exists to prevent. Like the boon draft above, the seat is
    // left by the table answering rather than by any button here: each step
    // turns over when every hand is in, and the settle walks the harbor on.
    startText = t("Drafting Paths...");
    startDisabled = true;
    nextDisabled = true;
  } else if (game.phase === "dawn") {
    startText = t("Drafting Boon...");
    startDisabled = true;
    nextDisabled = true;
  } else if (isGatedPhase(game.mode, game.phase)) {
    // Every phase the ready check gates, which is every phase of the round
    // except the drafts: Dawn and the Path Draft are handled by the branches
    // above, so they cannot reach here, because neither is left by confirming
    // anything (see lockInBoon and the draft's settle in the engine's
    // lifecycle). Read off the harbor's lap rather than listed, so the button
    // offers exactly the moves the harbor will actually wait for: a phase added
    // to a lap is a Next Phase step the day it lands, and a phase a mode does
    // not run is not a step at all, which it would be if this asked whether
    // the phase is round work instead.
    startText = t("On Voyage...");
    startDisabled = true;
    nextText = t("Next Phase");
    nextDisabled = false;
  } else {
    startText = t("On Voyage...");
    startDisabled = true;
    nextDisabled = true;
  }

  // The ready vote "waiting" state only ever applies to the recurring
  // Next Phase transitions (setting sail is handled above on its
  // own terms), so it always routes to that button.
  //
  // The clock joins the count here, because this bar is the one thing on
  // screen in every phase: a captain waiting on the crew reads both
  // numbers in the same place, and the one that is moving is the one that
  // ends the wait.
  if (waiting) {
    // The count is the shared builder's sentence (see readyLine in
    // @/lib/use-phase-sync) with this bar's own tail, because the one
    // thing a captain pressing the button wants to know is how close the
    // harbor is to turning.
    nextText = t("Not ready yet");
    nextTitle = t("⏳ {readyLine} The phase turns when the rest do.", {
      readyLine: readyLine(readyCount, requiredCount),
    });
    // The clock's tail keeps its leading space outside the read: the row
    // covers the mark and the label, and the bar is what puts the gap in.
    if (clock)
      nextTitle += ` ${t("· {clock.label}", { "clock.label": clock.label })}`;
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
        title={nextTitle}
        onClick={waiting ? onCancelReady : onNextPhase}
      >
        {waiting && <X className="h-4 w-4 mr-1.5" aria-hidden />}
        {nextText}
        {!waiting && <ChevronRight className="h-4 w-4 ml-1" aria-hidden />}
      </Button>
      <div className="flex-1" />
      {/* Mobile friendly ActionSuggester (the header version is hidden on mobile) */}
      <div className="relative sm:hidden">
        <ActionSuggester game={game} />
      </div>
      {/* The four voyage buttons and the line about the save, in a group
          that wraps like the bar it sits in. An unbreakable row would be
          invisible on a desktop and a sideways page on a phone: "Standing
          orders" alone is wider than a third of a phone, and four of them
          plus their icons and gaps are wider than the viewport itself, so
          the row would push the whole page 35 pixels wide and every
          screen in the harbor would scroll sideways with it.
          Below the sm width the four wear their glyphs alone, with the
          name kept in the title, the aria label and the wider layouts:
          four labeled buttons wrap to a row of their own on a phone,
          and a phone's rows are the room the board needed. */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-muted-foreground px-2">
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Cloud className="h-3.5 w-3.5 text-gain" />
          )}
          {saving ? t("Saving…") : t("Saved")}
          <span className="text-muted-foreground">· {phaseLabel(game)}</span>
        </span>
        {/* Lit only when the set would actually do something, which is
            the switch and at least one instruction under it (see
            standingOrdersLive). A captain who turned the
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
            aria-label={t("Standing orders")}
            title={
              ordersLive
                ? t("Standing orders are written and on")
                : t("Write what your seat should do when the clock plays it")
            }
            onClick={onStandingOrders}
          >
            <ScrollText className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">{t("Standing orders")}</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="rounded-lg"
          aria-label={t("Open the harbor guide")}
          onClick={onGuide}
        >
          <BookOpen className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">{t("Guide")}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-lg"
          aria-label={t("Save the voyage")}
          onClick={onSave}
        >
          <Save className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">{t("Save")}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-lg"
          disabled={!isHost}
          aria-label={t("Restart the voyage")}
          title={
            isHost
              ? t("Restart the voyage for everyone in the harbor")
              : t(HOST_ONLY_RESTART)
          }
          onClick={onRestart}
        >
          <RotateCcw className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">{t("Restart")}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-lg hidden lg:inline-flex"
          aria-label={t("Show all keyboard shortcuts")}
          title={t("Keyboard shortcuts")}
          onClick={onShortcuts}
        >
          <Keyboard className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
