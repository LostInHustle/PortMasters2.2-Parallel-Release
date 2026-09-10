"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, X } from "lucide-react";

/**
 * Keyboard Shortcut Help overlay. Shows all available keyboard shortcuts
 * in a clean, readable layout. Opens with the ? key or F2, closes with
 * Escape or clicking the backdrop.
 */

type Shortcut = {
  keys: string[];
  label: string;
  group: "Navigation" | "Game Actions" | "Help";
};

const SHORTCUTS: Shortcut[] = [
  { keys: ["Ctrl", "S"], label: "Save game state", group: "Game Actions" },
  {
    keys: ["Ctrl", "N"],
    label: "Next phase or continue",
    group: "Game Actions",
  },
  {
    keys: ["Ctrl", "R"],
    label: "Restart voyage (host only)",
    group: "Game Actions",
  },
  { keys: ["F1"], label: "Open the full navigation guide", group: "Help" },
  { keys: ["?"], label: "Open this shortcut help", group: "Help" },
  { keys: ["F2"], label: "Open this shortcut help", group: "Help" },
  { keys: ["Esc"], label: "Close any open dialog", group: "Navigation" },
  {
    keys: ["Alt", "T"],
    label: "Focus the notifications panel",
    group: "Navigation",
  },
];

const GROUP_ORDER: Shortcut["group"][] = ["Game Actions", "Navigation", "Help"];
const GROUP_ICONS: Record<Shortcut["group"], string> = {
  "Game Actions": "🎮",
  Navigation: "🧭",
  Help: "📚",
};

export function KeyboardShortcutHelp({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="pm-glass-strong pm-crackle relative z-10 w-full max-w-md overflow-hidden rounded-3xl p-6"
          >
            <div className="pm-seigaiha absolute inset-0 opacity-20 pointer-events-none" />
            <div className="relative">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="pm-grad-indigo flex h-10 w-10 items-center justify-center rounded-xl text-white">
                    <Keyboard className="h-5 w-5" />
                  </div>
                  <h2 className="font-display text-lg font-bold pm-text-sea">
                    Keyboard Shortcuts
                  </h2>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className="pm-pressable rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/10"
                  aria-label="Close shortcut help"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                {GROUP_ORDER.map((group) => {
                  const shortcuts = SHORTCUTS.filter((s) => s.group === group);
                  if (shortcuts.length === 0) return null;
                  return (
                    <div key={group}>
                      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <span>{GROUP_ICONS[group]}</span>
                        {group}
                      </h3>
                      <div className="space-y-1.5">
                        {shortcuts.map((s) => (
                          <div
                            key={s.label}
                            className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5"
                          >
                            <span className="text-sm text-foreground/90">
                              {s.label}
                            </span>
                            <div className="flex items-center gap-1">
                              {s.keys.map((key, i) => (
                                <kbd
                                  key={i}
                                  className="inline-flex items-center justify-center rounded-md border border-black/15 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground shadow-sm dark:border-white/20 dark:bg-white/10"
                                >
                                  {key}
                                </kbd>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-5 text-center text-[11px] text-muted-foreground">
                Shortcuts are ignored while typing in inputs or text areas.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
