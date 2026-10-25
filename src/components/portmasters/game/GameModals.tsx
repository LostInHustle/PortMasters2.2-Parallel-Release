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
import { t } from "@/lib/game/i18n";
import { useLanguage } from "@/lib/use-language-preference";
// The two modals below that quote a voyage's length take the mode as well
// as the tier, because the length is the voyage's rather than the tier's
// alone (see voyageRounds in src/lib/game/mode). The caller reads both off
// the state the captain is sailing, which is what keeps the copy and the
// voyage it describes the same voyage.
import type { GameMode } from "@/lib/game/mode";
import type { GameState } from "@/lib/game/types";
import { getIntelCost } from "@/lib/game/engine";
import { cn, formatTime } from "@/lib/utils";
import { RichText } from "../RichText";
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
 * plain colored icon.
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
      title={t("Navigation Guide")}
      description={t("{APP_NAME} rules and shortcuts", { APP_NAME })}
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
      title={t("Trade Strategy Advice")}
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
  const { locale } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-notifications" />
            {t("Notifications")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t(
              "Every ledger update, harbor message, and direct message from this voyage",
            )}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="pm-scroll-capped max-h-[60vh]">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm py-10">
              <BellOff className="h-6 w-6" /> {t("Nothing yet this voyage.")}
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
                      {formatTime(new Date(n.at), locale)}
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
  // The whisper price is derived, through getIntelCost (see
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
            {t("Broker's Whisper Board")}
          </DialogTitle>
          <DialogDescription>
            {t("Spend Gold to reveal what Orders will ask for!")}
          </DialogDescription>
        </DialogHeader>
        {/* The button grays outside Market because the engine refuses the
            press there (see purchaseIntel): a whisper bought after the board
            is dealt could never be honored, and a dialog left open across
            the rest of the lap is exactly how that press happens. */}
        <div className="flex flex-col items-center my-2 gap-1.5">
          <Button
            className="pm-grad-rumors rounded-xl"
            onClick={onBuy}
            disabled={game.phase !== "market"}
          >
            {t("🔮 Buy a Whisper ({intelCost}💰)", { intelCost })}
          </Button>
          {game.phase !== "market" && (
            <p className="text-[11px] text-muted-foreground">
              {t("The Broker only deals during Market.")}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-rumors/15 bg-rumors/[0.04] p-3.5 min-h-[110px]">
          {game.revealedIntel.length ? (
            <>
              <div className="font-semibold text-rumors text-sm mb-1.5">
                {t("📜 Revealed Whispers:")}
              </div>
              {game.revealedIntel.map((i, idx) => (
                <div key={idx} className="text-[13px] py-0.5">
                  {t("• 🗣️ '{port} wants {item}'", {
                    port: t(i.port),
                    item: t(i.item),
                  })}
                </div>
              ))}
            </>
          ) : (
            <div className="text-muted-foreground text-center py-5 text-sm">
              {t(
                "✨ No whispers revealed yet... Spend Gold to listen to the Broker.",
              )}
            </div>
          )}
        </div>
        <CloseFooter
          onClose={() => onOpenChange(false)}
          label={t("Close Board")}
          className="mt-2"
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * The dialog that asks before a thing that cannot be undone: the restart
 * that resets the harbor and the leave that writes a seat off. The two
 * had been written out twice line for line, down to the alarm chip and
 * the pair of buttons, and two copies of a destructive confirm is how one
 * of them drifts into a friendly one without anybody deciding to. The
 * parts that differ are the four the caller hands over: the glyph, the
 * question, the sentence under it, and the name of the press that goes
 * through.
 *
 * The chip wears the alarm wash and the alarm ink together, so the glyph
 * inside inherits the color rather than being told it, and the confirm
 * press wears the same alarm against the background: the dialog that
 * takes rather than gives is the one that says so before it is answered.
 */
function ConfirmDialog({
  open,
  onOpenChange,
  icon: Icon,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** The glyph the chip carries. The chip sizes the box it sits in. */
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="bg-alarm/5 inline-flex h-7 w-7 items-center justify-center rounded-lg text-alarm">
              <Icon className="h-4 w-4" />
            </span>
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("Cancel")}
          </Button>
          <Button
            className="bg-alarm text-background"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Host only confirmation before a restart goes out over the wire. A
 * restart resets every captain currently in the harbor back to round one,
 * not just whoever clicks the button, and reopens the harbor to new joins,
 * so it's worth one extra click to make sure that's actually intended.
 *
 * Wears the vermilion gradient so the consequence reads at a glance: a
 * restart is the most destructive action in the harbor, and the destructive
 * accent is what surfaces that without needing the body copy to land
 * first. It is the one dialog in the session that takes rather than
 * gives, so it wears the color that means a loss.
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
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={RotateCcw}
      title={t("Restart the voyage?")}
      description={t(
        "Every captain currently in this harbor goes back to round one: Gold, cargo, artisans, and hull upgrades all reset. The harbor also reopens, so new captains can join again. This can't be undone.",
      )}
      confirmLabel={t("Restart for Everyone")}
      onConfirm={onConfirm}
    />
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
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={DoorOpen}
      title={t("Leave the voyage?")}
      description={t(
        "The harbor sails on without you: your seat is written off, and the Gold and cargo you were carrying go with it. You can start or join a new harbor right away. This can't be undone.",
      )}
      confirmLabel={t("Leave the Voyage")}
      onConfirm={onConfirm}
    />
  );
}

export function TutorialModal({
  open,
  onOpenChange,
  mode,
  difficulty,
}: VoyageReadingProps) {
  const [step, setStep] = useState(0);
  const { locale } = useLanguage();
  // tutorialSteps composes its copy through t(), so a locale change must
  // rebuild the steps. The reference below makes that dependency explicit.
  const steps = useMemo(() => {
    void locale;
    return tutorialSteps(mode, difficulty);
  }, [mode, difficulty, locale]);
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
            {t("Tutorial step {step} of {total}", { step: step + 1, total })}
          </DialogDescription>
        </DialogHeader>
        <Progress value={pct} className="h-1.5 shrink-0" />
        <RichText
          className="min-h-0 flex-1 overflow-y-auto pr-1 text-[13.5px] leading-relaxed text-foreground [&_p]:mb-2 [&_div]:mb-1"
          html={s.content}
        />
        <div className="shrink-0 grid grid-cols-[1fr_auto_1fr] items-center gap-3 pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> {t("Back")}
          </Button>
          <span className="justify-self-center whitespace-nowrap text-[11px] text-muted-foreground">
            {t("{step.delivered} of {step.required}", {
              "step.delivered": step + 1,
              "step.required": total,
            })}
          </span>
          {isLast ? (
            <Button
              size="sm"
              className="justify-self-end pm-grad-guide"
              onClick={close}
            >
              {t("Done")}
            </Button>
          ) : (
            <Button
              size="sm"
              className="justify-self-end pm-grad-guide"
              onClick={() => setStep((s) => s + 1)}
            >
              {t("Continue")} <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="shrink-0 text-center">
          <button
            onClick={close}
            className="text-[11px] text-muted-foreground hover:text-muted-foreground underline underline-offset-2"
          >
            {t("Skip tutorial")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
