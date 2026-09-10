"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { selectBoon, swapBoonChoices } from "@/lib/game/engine";
import { ReadyBar } from "../ReadyBar";
import { Term } from "../../Term";
import type { PhasePanelProps } from "./PhaseShared";

export function BoonDraft({
  game,
  ctx,
  act,
  phaseSync,
  members,
}: Pick<PhasePanelProps, "game" | "ctx" | "act" | "phaseSync" | "members">) {
  const picks = game.boonChoices;
  // This is the screen the user specifically called out for a visible
  // ready indicator: once a captain locks in a boon, swap the picker for
  // the same "x/y ready" readout everyone else gets, rather than leaving
  // a now meaningless set of cards on screen.
  if (phaseSync.waiting) {
    return (
      <div className="max-w-md mx-auto text-center py-10">
        <div className="text-2xl font-bold mb-1 pm-text-gold">
          🧭 Boon Locked In
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          The voyage begins once every captain has chosen.
        </p>
        <ReadyBar
          ready={phaseSync.ready}
          members={members}
          className="justify-center mb-5"
        />
        <Button
          variant="secondary"
          className="rounded-xl"
          onClick={phaseSync.cancelReady}
        >
          ↩️ Choose a different Boon
        </Button>
      </div>
    );
  }
  const canSwap = !game.boonSwapUsed && game.money >= 10;
  return (
    <div className="max-w-4xl mx-auto text-center py-2">
      <div className="text-2xl font-bold mb-1 pm-text-gold">
        🧭 The Navigator's Compass
      </div>
      <p className="text-sm text-muted-foreground mb-2">
        Draft a Boon to synergize with your strategy
      </p>
      <ReadyBar
        ready={phaseSync.ready}
        members={members}
        className="justify-center mb-3"
      />
      <div className="flex justify-center mb-4">
        <Button
          size="sm"
          variant="secondary"
          className="rounded-lg"
          disabled={!canSwap}
          onClick={() => act((g, l) => swapBoonChoices(g, l))}
        >
          {game.boonSwapUsed
            ? "✅ Boons Swapped This Voyage"
            : "🔄 Swap Boons (10💰, 1 use/voyage)"}
        </Button>
      </div>
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.06 } },
        }}
      >
        {picks.map((b) => (
          <motion.div
            key={b.id}
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.22, ease: "easeOut" },
              },
            }}
            whileHover={{ y: -6 }}
            className="pm-glass rounded-2xl p-5 flex flex-col items-center text-center border border-amber-500/20"
          >
            <div className="text-5xl mb-2">{b.icon}</div>
            <div className="font-semibold text-foreground mb-2">
              <Term term={b.name}>{b.name}</Term>
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed flex-1 mb-4">
              {b.desc}
            </div>
            <Button
              className="pm-grad-gold text-amber-950 font-semibold rounded-xl w-full"
              onClick={() =>
                phaseSync.markReady((g, l) => selectBoon(g, ctx, b.id, l))
              }
            >
              🔒 Lock In Boon
            </Button>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
