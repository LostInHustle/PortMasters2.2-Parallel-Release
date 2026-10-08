"use client";

import { AnimatePresence } from "framer-motion";
import { Keyboard } from "lucide-react";
import {
  ModalCard,
  ModalClose,
  ModalOverlay,
} from "@/components/ui/modal-overlay";
import { SHORTCUTS, type KeyboardShortcut } from "@/lib/game/constants/copy";

/**
 * Keyboard Shortcut Help overlay. Shows all available keyboard shortcuts
 * in a clean, readable layout. Opens with the ? key or F2, closes with
 * Escape or clicking the backdrop.
 */

const GROUP_ORDER: KeyboardShortcut["group"][] = [
  "Game Actions",
  "Navigation",
  "Help",
];
const GROUP_ICONS: Record<KeyboardShortcut["group"], string> = {
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
        <ModalOverlay onClose={() => onOpenChange(false)}>
          <ModalCard>
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="pm-grad-shortcuts flex h-10 w-10 items-center justify-center rounded-xl">
                  <Keyboard className="h-5 w-5" />
                </div>
                <h2 className="font-display text-lg font-bold text-shortcuts">
                  Keyboard Shortcuts
                </h2>
              </div>
              <ModalClose
                label="Close shortcut help"
                onClick={() => onOpenChange(false)}
              />
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
                        // Keyed by the keys rather than by the label: two
                        // rows are allowed to say the same thing (the ? key
                        // and F2 both open this help), and keying them by
                        // their sentence made React treat the pair as one
                        // child, which it warns about and may one day act on.
                        <div
                          key={s.keys.join("+")}
                          className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5"
                        >
                          <span className="text-sm text-foreground">
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
          </ModalCard>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
