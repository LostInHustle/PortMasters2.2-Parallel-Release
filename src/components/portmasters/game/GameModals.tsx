"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { APP_NAME } from "@/lib/game/constants/brand";
import { guideText, tutorialSteps } from "@/lib/game/constants/copy";
import { tipsHeading, tipsText } from "@/lib/game/constants/tips";
import type { Difficulty } from "@/lib/game/difficulty";
// The two modals below that quote a voyage's length take the mode as well
// as the tier, because the length is the voyage's rather than the tier's
// alone (see voyageLegs in src/lib/game/mode). The caller reads both off
// the state the captain is sailing, which is what keeps the copy and the
// voyage it describes the same voyage.
import type { GameMode } from "@/lib/game/mode";
import type { GameState } from "@/lib/game/types";
import { getIntelCost } from "@/lib/game/engine";
import { cn } from "@/lib/utils";
import { CloseFooter } from "./CloseFooter";
import {
  Sparkles,
  BookOpen,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  DoorOpen,
  Bell,
  BellOff,
} from "lucide-react";
import type { NotificationItem } from "@/lib/use-notifications";

/**
 * The long form reading dialogs: the Navigation Guide and the Trade
 * Strategy Advice. Both are a heading with a badge beside it and a
 * scrollable wall of preformatted text, and they were written out twice
 * line for line, down to the scroll cap and the Close button. The only
 * things that ever differed were the heading, the badge, and which block
 * of text got printed.
 *
 * The badge comes in as a node rather than as an icon plus a class,
 * because the two headings do not wear theirs the same way: the Guide
 * puts its book on a gradient tile, and the Advice leaves the bulb as a
 * plain coloured icon.
 */
function TextModal({
  open,
  onOpenChange,
  badge,
  title,
  description,
  body,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  badge: React.ReactNode;
  title: string;
  description: string;
  body: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {badge}
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {description}
          </DialogDescription>
        </DialogHeader>
        <pre className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed bg-muted/40 rounded-lg p-3.5 max-h-[60vh] overflow-y-auto pm-scroll">
          {body}
        </pre>
        <CloseFooter onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * The three dialogs a voyage opens from its own controls that print a
 * reading: the Navigation Guide, the Trade Strategy Advice and the
 * walkthrough. All three take the same four props, and the shape was
 * written out three times. It is named once here because the three read
 * the same two facts (see the note above the mode import), so a fourth
 * written later is held to the same pair rather than to its own idea of
 * them.
 */
type VoyageReadingProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: GameMode;
  difficulty: Difficulty;
};

export function GuideModal({
  open,
  onOpenChange,
  mode,
  difficulty,
}: VoyageReadingProps) {
  return (
    <TextModal
      open={open}
      onOpenChange={onOpenChange}
      badge={
        <span className="pm-grad-guide inline-flex h-7 w-7 items-center justify-center rounded-lg">
          <BookOpen className="h-4 w-4" />
        </span>
      }
      title="Navigation Guide"
      description={`${APP_NAME} rules and shortcuts`}
      body={guideText(mode, difficulty)}
    />
  );
}

export function TipsModal({
  open,
  onOpenChange,
  mode,
  difficulty,
}: VoyageReadingProps) {
  return (
    <TextModal
      open={open}
      onOpenChange={onOpenChange}
      badge={<Lightbulb className="h-5 w-5 text-advisor" />}
      title="Trade Strategy Advice"
      // The description is the advice page's own heading (see tipsHeading
      // in @/lib/game/constants/tips), so the dialog names the strategy
      // the body under it actually prints for this mode rather than the
      // founding voyage's subject on every table.
      description={tipsHeading(mode)}
      body={tipsText(mode, difficulty)}
    />
  );
}

/**
 * The notification button's "expand" target: every ledger digest, harbor
 * chat message, and direct message that's arrived this session, newest
 * first. Only one ever shows as a floating bubble at a time (see
 * NotificationCenter.tsx); this is where the rest still are. A Dialog
 * here instead of a dropdown anchored to the button reuses the same
 * open/close pattern every other modal in this file already has, rather
 * than inventing click outside/positioning logic from scratch.
 */
export function NotificationHistoryModal({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: NotificationItem[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-notifications" />
            Notifications
          </DialogTitle>
          <DialogDescription className="sr-only">
            Every ledger update, harbor message, and direct message this session
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="pm-scroll-capped max-h-[60vh]">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm py-10">
              <BellOff className="h-6 w-6" /> Nothing yet this voyage.
            </div>
          ) : (
            <div className="space-y-2 pr-2">
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    n.onActivate?.();
                    onOpenChange(false);
                  }}
                  className={cn(
                    "w-full text-left rounded-xl px-3.5 py-2.5 border border-black/5 dark:border-white/10 bg-background/50 transition-colors",
                    n.onActivate &&
                      "hover:border-notifications/40 cursor-pointer",
                  )}
                >
                  <div className="text-sm font-semibold mb-1 flex items-center gap-1.5">
                    <span className="text-base">{n.icon}</span> {n.title}
                    <span className="ml-auto text-[10px] text-muted-foreground font-normal">
                      {new Date(n.at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {n.lines.map((line, i) => (
                      <div
                        key={i}
                        className="text-[12.5px] text-foreground leading-snug break-words"
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        <CloseFooter onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function RumorBoardModal({
  open,
  onOpenChange,
  game,
  onBuy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  game: GameState;
  onBuy: () => void;
}) {
  // The rumor price is derived, through getIntelCost (see
  // engine/pricing), from whether the Broker's Network module is
  // equipped, so the modal cannot show a price the engine would not
  // charge.
  const intelCost = getIntelCost(game);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="pm-grad-rumors inline-flex h-7 w-7 items-center justify-center rounded-lg">
              <Sparkles className="h-4 w-4" />
            </span>
            Broker's Rumor Board
          </DialogTitle>
          <DialogDescription>
            Spend gold to reveal what Orders will ask for!
          </DialogDescription>
        </DialogHeader>
        {/* The button greys outside Market because the engine refuses the
            press there (see purchaseIntel): a rumor bought after the board
            is dealt could never be honoured, and a dialog left open across
            the rest of the lap is exactly how that press happens. */}
        <div className="flex flex-col items-center my-2 gap-1.5">
          <Button
            className="pm-grad-rumors rounded-xl"
            onClick={onBuy}
            disabled={game.phase !== "market"}
          >
            🔮 Buy Rumor ({intelCost}💰)
          </Button>
          {game.phase !== "market" && (
            <p className="text-[11px] text-muted-foreground">
              The Broker only deals during Market.
            </p>
          )}
        </div>
        <div className="rounded-lg border border-rumors/15 bg-rumors/[0.04] p-3.5 min-h-[110px]">
          {game.revealedIntel.length ? (
            <>
              <div className="font-semibold text-rumors text-sm mb-1.5">
                📜 Revealed Intel:
              </div>
              {game.revealedIntel.map((i, idx) => (
                <div key={idx} className="text-[13px] py-0.5">
                  • 🗣️ '{i.port} wants {i.item}'
                </div>
              ))}
            </>
          ) : (
            <div className="text-muted-foreground text-center py-5 text-sm">
              ✨ No rumors revealed yet... Spend gold to listen to the Broker's
              whispers.
            </div>
          )}
        </div>
        <CloseFooter
          onClose={() => onOpenChange(false)}
          label="Close Board"
          className="mt-2"
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Host only confirmation before a restart goes out over the wire. A
 * restart resets every captain currently in the harbor back to round one,
 * not just whoever clicks the button, and re opens the room to new joins,
 * so it's worth one extra click to make sure that's actually intended.
 *
 * Wears the vermilion gradient so the consequence reads at a glance: a
 * restart is the most destructive action in the room, and the destructive
 * accent is what surfaces that without needing the body copy to land first.
 */
export function RestartConfirmModal({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {/* The one dialog in the session that takes rather than gives:
                restarting sends every captain back to round one and cannot
                be undone, so it wears the colour that means a loss. */}
            <span className="bg-alarm/5 inline-flex h-7 w-7 items-center justify-center rounded-lg">
              <RotateCcw className="h-4 w-4 text-alarm" />
            </span>
            Restart the voyage?
          </DialogTitle>
          <DialogDescription>
            Every captain currently in this harbor goes back to round one: gold,
            cargo, workers, and ship upgrades all reset. The harbor also
            reopens, so new captains can join again. This can't be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-alarm text-background"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            Restart for Everyone
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The confirm a captain meets when they steer for the harbor mouth mid
 * voyage. Leaving from the harbor costs nothing and never asks; leaving
 * under way writes the seat off, so the one press that cannot be undone
 * asks first.
 */
export function LeaveConfirmModal({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="bg-alarm/5 inline-flex h-7 w-7 items-center justify-center rounded-lg">
              <DoorOpen className="h-4 w-4 text-alarm" />
            </span>
            Leave the voyage?
          </DialogTitle>
          <DialogDescription>
            The harbor sails on without you: your seat is written off, and the
            gold and cargo you were carrying go with it. You can start or join a
            new harbor right away. This can't be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-alarm text-background"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            Leave the Voyage
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TutorialModal({
  open,
  onOpenChange,
  mode,
  difficulty,
}: VoyageReadingProps) {
  const [step, setStep] = useState(0);
  const steps = useMemo(
    () => tutorialSteps(mode, difficulty),
    [mode, difficulty],
  );
  const total = steps.length;
  const s = steps[step];
  const pct = Math.round(((step + 1) / total) * 100);
  const isLast = step === total - 1;

  function close() {
    setStep(0);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setStep(0);
        onOpenChange(v);
      }}
    >
      {/* The modal is a column with three fixed parts and one that moves.
          The title, the progress bar, the pager and the skip link all stay
          where they are while the step's own text scrolls between them,
          which is what makes the tour readable on a phone: a captain on a
          short screen reads a step by scrolling inside it and still has
          Continue under their thumb, rather than scrolling the whole
          dialog to find it. The outer cap is the dialog's own (see
          DialogContent), so this adds a shape rather than a second limit
          that could disagree with it. */}
      <DialogContent className="max-w-lg flex flex-col gap-3 p-4 sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base leading-tight pr-6">
            {s.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Tutorial step {step + 1} of {total}
          </DialogDescription>
        </DialogHeader>
        <Progress value={pct} className="h-1.5 shrink-0" />
        <div
          className="min-h-0 flex-1 overflow-y-auto pr-1 text-[13.5px] leading-relaxed text-foreground [&_p]:mb-2 [&_div]:mb-1"
          dangerouslySetInnerHTML={{ __html: s.content }}
        />
        <div className="shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-3 pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back
          </Button>
          <span className="justify-self-center whitespace-nowrap text-[11px] text-muted-foreground">
            {step + 1} of {total}
          </span>
          {isLast ? (
            <Button
              size="sm"
              className="justify-self-end pm-grad-guide"
              onClick={close}
            >
              🚢 Set Sail!
            </Button>
          ) : (
            <Button
              size="sm"
              className="justify-self-end pm-grad-guide"
              onClick={() => setStep((s) => s + 1)}
            >
              Continue <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="shrink-0 text-center">
          <button
            onClick={close}
            className="text-[11px] text-muted-foreground hover:text-muted-foreground underline underline-offset-2"
          >
            Skip tutorial
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
