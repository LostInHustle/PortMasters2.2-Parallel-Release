"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  X,
  Volume2,
  Palette,
  Keyboard,
  Moon,
  Sun,
  Monitor,
  Bell,
} from "lucide-react";
import { useTheme } from "next-themes";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { cn } from "@/lib/utils";

/**
 * Settings modal. A central place for captain preferences: sound
 * volume, theme, colorblind palette, and notification settings.
 *
 * The sound volume slider controls the gain of the ambient harbor bed
 * and the UI feedback tones. The theme toggle switches between light,
 * dark, and system. The colorblind palette toggle is mirrored from the
 * GameRoom header. Notification preferences control which events
 * produce a toast.
 */

const STORAGE_KEYS = {
  soundEnabled: "portmasters_sound_enabled",
  soundVolume: "portmasters_sound_volume",
  notifRoomEvents: "portmasters_notif_room_events",
  notifDocks: "portmasters_notif_docks",
  notifTidewatch: "portmasters_notif_tidewatch",
};

export function SettingsModal({
  open,
  onOpenChange,
  soundEnabled,
  onToggleSound,
  colorblindSafe,
  onToggleColorblind,
  volume,
  onVolumeChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  colorblindSafe: boolean;
  onToggleColorblind: () => void;
  volume: number;
  onVolumeChange: (v: number) => void;
}) {
  const { theme, setTheme } = useTheme();
  const [notifRoom, setNotifRoom] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem(STORAGE_KEYS.notifRoomEvents) !== "false";
    } catch {
      return true;
    }
  });
  const [notifDocks, setNotifDocks] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem(STORAGE_KEYS.notifDocks) !== "false";
    } catch {
      return true;
    }
  });
  const [notifTidewatch, setNotifTidewatch] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem(STORAGE_KEYS.notifTidewatch) !== "false";
    } catch {
      return true;
    }
  });

  // There is deliberately no load effect here. Every preference on this
  // screen is read from localStorage by its own lazy initializer when the
  // state is created, so there is nothing left for an effect to do on open.
  // One used to sit here anyway, with a body that was a single comment
  // saying so, which cost a render pass on every open to accomplish nothing.

  const saveVolume = (v: number) => {
    onVolumeChange(v);
  };

  const toggleNotif = (
    key: keyof typeof STORAGE_KEYS,
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    current: boolean,
  ) => {
    const next = !current;
    try {
      localStorage.setItem(STORAGE_KEYS[key], String(next));
    } catch {
      // private browsing
    }
    setter(next);
  };

  return (
    <AnimatePresence>
      {open && (
        <ModalOverlay onClose={() => onOpenChange(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="pm-glass-strong pm-crackle relative z-10 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl"
          >
            {/* Header */}
            <div className="relative shrink-0 overflow-hidden border-b border-border/40 p-6">
              <div className="pm-seigaiha absolute inset-0 opacity-20 pointer-events-none" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="pm-grad-settings flex h-10 w-10 items-center justify-center rounded-xl">
                    <Settings className="h-5 w-5" />
                  </div>
                  <h2 className="font-display text-lg font-bold text-settings">
                    Settings
                  </h2>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className="pm-pressable rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/10"
                  aria-label="Close settings"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 space-y-5 overflow-y-auto p-6 pm-scroll">
              {/* Sound */}
              <Section icon={Volume2} title="Sound">
                <ToggleRow
                  label="Harbor sounds"
                  description="Ambient harbor bed and UI feedback tones"
                  checked={soundEnabled}
                  onChange={onToggleSound}
                />
                {soundEnabled && (
                  <div className="pt-2">
                    <label className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Volume</span>
                      <span className="font-mono">{volume}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={(e) => saveVolume(Number(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-black/10 dark:bg-white/10"
                      style={{
                        background: `linear-gradient(to right, oklch(0.62 0.09 165) ${volume}%, oklch(0.88 0.015 95) ${volume}%)`,
                      }}
                    />
                  </div>
                )}
              </Section>

              {/* Theme */}
              <Section icon={theme === "dark" ? Moon : Sun} title="Theme">
                <div className="grid grid-cols-3 gap-2">
                  <ThemeButton
                    active={theme === "light"}
                    onClick={() => setTheme("light")}
                    icon={Sun}
                    label="Light"
                  />
                  <ThemeButton
                    active={theme === "dark"}
                    onClick={() => setTheme("dark")}
                    icon={Moon}
                    label="Dark"
                  />
                  <ThemeButton
                    active={theme === "system"}
                    onClick={() => setTheme("system")}
                    icon={Monitor}
                    label="Auto"
                  />
                </div>
              </Section>

              {/* Colorblind palette */}
              <Section icon={Palette} title="Visual">
                <ToggleRow
                  label="Colorblind safe palette"
                  description="Use Okabe Ito anchored colors for all goods"
                  checked={colorblindSafe}
                  onChange={onToggleColorblind}
                />
              </Section>

              {/* Notifications */}
              <Section icon={Bell} title="Notifications">
                <ToggleRow
                  label="Room events"
                  description="Captains joining, leaving, and system messages"
                  checked={notifRoom}
                  onChange={() =>
                    toggleNotif("notifRoomEvents", setNotifRoom, notifRoom)
                  }
                />
                <ToggleRow
                  label="Word on the Docks"
                  description="The race to five completed orders"
                  checked={notifDocks}
                  onChange={() =>
                    toggleNotif("notifDocks", setNotifDocks, notifDocks)
                  }
                />
                <ToggleRow
                  label="Tidewatch Surge"
                  description="The harbor crossing 500 combined Reputation"
                  checked={notifTidewatch}
                  onChange={() =>
                    toggleNotif(
                      "notifTidewatch",
                      setNotifTidewatch,
                      notifTidewatch,
                    )
                  }
                />
              </Section>

              {/* Keyboard shortcuts reference */}
              <Section icon={Keyboard} title="Shortcuts">
                <div className="rounded-lg bg-black/5 p-3 text-xs text-muted-foreground dark:bg-white/5">
                  Press{" "}
                  <kbd className="rounded bg-white px-1 dark:bg-white/10">
                    ?
                  </kbd>{" "}
                  or{" "}
                  <kbd className="rounded bg-white px-1 dark:bg-white/10">
                    F2
                  </kbd>{" "}
                  in a game room to see all keyboard shortcuts.
                </div>
              </Section>
            </div>
          </motion.div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5">
      <div className="flex-1 min-w-0 pr-2">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground">{description}</div>
      </div>
      <button
        onClick={onChange}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-celadon" : "bg-black/20 dark:bg-white/20",
        )}
        role="switch"
        aria-checked={checked}
        aria-label={label}
      >
        <motion.span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
          animate={{ left: checked ? "calc(100% - 1.375rem)" : "0.125rem" }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        />
      </button>
    </div>
  );
}

function ThemeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border py-2.5 text-xs font-medium transition-all",
        active
          ? "border-celadon bg-celadon/5 text-celadon dark:text-celadon"
          : "border-black/10 text-muted-foreground hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
