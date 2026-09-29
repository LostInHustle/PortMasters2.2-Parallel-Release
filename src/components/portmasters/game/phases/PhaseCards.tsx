"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Term } from "../../Term";

/**
 * The frame of a card on a board that is bought or filled from: a hue for
 * the whole card, the port or the demand across the top, the goods in the
 * middle, and the one action at the foot.
 *
 * The port board and the trade manifest each drew this frame by hand, down
 * to the same three class strings for the header, the body and the action
 * row. The manifest's header carries a gap between its two ends and the
 * board's does not, so that one class is the caller's.
 */
export function TradeCard({
  tone,
  header,
  headerClassName,
  children,
  footer,
}: {
  tone: string;
  header: React.ReactNode;
  headerClassName?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div
      className={cn("rounded-xl border overflow-hidden flex flex-col", tone)}
    >
      <div
        className={cn(
          "px-3.5 py-2 text-xs font-semibold border-b border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] flex items-center justify-between",
          headerClassName,
        )}
      >
        {header}
      </div>
      <div className="p-3.5 flex-1 space-y-1.5">{children}</div>
      <div className="p-3 pt-0">{footer}</div>
    </div>
  );
}

/**
 * The grid a draft deals its three choices into, with the stagger the two
 * draft screens have always used. The wrapper is the same on both, so it is
 * drawn once; each card inside it is a DraftCard.
 */
export function DraftGrid({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.06 } },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * One choice in a draft: the glyph, the name, what it does, and the button
 * that takes it. The boon draft and the module draft are the same card in
 * two hues, down to the hover lift and the fade in of each card behind the
 * one before it.
 */
export function DraftCard({
  tone,
  icon,
  name,
  nameClassName,
  desc,
  actionLabel,
  actionClassName,
  onSelect,
}: {
  tone: string;
  icon: React.ReactNode;
  name: string;
  nameClassName?: string;
  desc: React.ReactNode;
  actionLabel: React.ReactNode;
  actionClassName?: string;
  onSelect: () => void;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 16 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.22, ease: "easeOut" },
        },
      }}
      whileHover={{ y: -6 }}
      className={cn(
        "pm-glass rounded-2xl p-5 flex flex-col items-center text-center border",
        tone,
      )}
    >
      <div className="text-5xl mb-2">{icon}</div>
      <div className={cn("font-semibold", nameClassName, "mb-2")}>
        <Term term={name}>{name}</Term>
      </div>
      <div className="text-xs text-muted-foreground leading-relaxed flex-1 mb-4">
        {desc}
      </div>
      <Button
        className={cn(actionClassName, "font-semibold rounded-xl w-full")}
        onClick={onSelect}
      >
        {actionLabel}
      </Button>
    </motion.div>
  );
}

/**
 * The once a round swap both drafts offer, in the same place under their
 * title and in the same dress. What a swap costs and what it is called are
 * the two things the screens decide.
 */
export function DraftSwapButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-center mb-4">
      <Button
        size="sm"
        variant="secondary"
        className="rounded-lg"
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </Button>
    </div>
  );
}
