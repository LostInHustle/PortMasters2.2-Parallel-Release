"use client";

import { Button } from "@/components/ui/button";
import type { GameState } from "@/lib/game/types";
import { phaseLabel } from "@/lib/game/engine";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Save,
  RotateCcw,
  Play,
  ChevronRight,
  Loader2,
  Cloud,
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
  onCancelReady,
}: {
  game: GameState;
  saving: boolean;
  isHost: boolean;
  onSetSail: () => void;
  onNextPhase: () => void;
  onGuide: () => void;
  onSave: () => void;
  onRestart: () => void;
  waiting: boolean;
  readyCount: number;
  requiredCount: number;
  onCancelReady: () => void;
}) {
  let startText = "🚢 Set Sail";
  let startDisabled = true;
  let nextText = "⏭️ Continue";
  let nextDisabled = true;

  if (game.gameOver) {
    startText = "⚠️ Game Over";
    startDisabled = true;
    nextDisabled = true;
  } else if (game.phase === 0) {
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
  } else if (game.phase === 5) {
    startText = "🧭 Drafting Boon...";
    startDisabled = true;
    nextDisabled = true;
  } else if ([1, 2, 3, 4, "barter", "worker_mgmt"].includes(game.phase)) {
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
  // Next Phase transitions (phase 0's Start Game is handled above on its
  // own terms), so it always routes to that button.
  if (waiting) {
    nextText = `⏳ Waiting… (${readyCount}/${requiredCount} ready)`;
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
        variant={nextDisabled ? "secondary" : waiting ? "secondary" : "default"}
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
