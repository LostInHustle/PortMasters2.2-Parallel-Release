"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Settings,
  Volume2,
  Palette,
  Keyboard,
  Moon,
  Sun,
  Monitor,
  Bell,
  Languages,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  ModalClose,
  ModalOverlay,
  ModalSheet,
} from "@/components/ui/modal-overlay";
import { Switch } from "@/components/ui/switch";
import {
  notifCategoryPref,
  setNotifCategoryPref,
  type NotifCategory,
} from "@/lib/use-notifications";
import {
  TIDEWATCH_SURGE_THRESHOLD,
  WORD_ON_THE_DOCKS_THRESHOLD,
} from "@/lib/game/constants/world";
import { t, type Locale } from "@/lib/game/i18n";
import { cn } from "@/lib/utils";

/**
 * Settings modal. A central place for captain preferences: sound
 * volume, theme, colorblind palette, language, and notification
 * settings.
 *
 * The sound volume slider controls the gain of the ambient harbor bed
 * and the UI feedback tones. The theme toggle switches between light,
 * dark, and system. The colorblind palette toggle is mirrored from the
 * GameRoom header. The language pair switches the pack the whole tree
 * prints from (see use-language-preference). Notification preferences
 * control which events produce a toast.
 */

export function SettingsModal({
  open,
  onOpenChange,
  soundEnabled,
  onToggleSound,
  colorblindSafe,
  onToggleColorblind,
  volume,
  onVolumeChange,
  locale,
  onSetLocale,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  colorblindSafe: boolean;
  onToggleColorblind: () => void;
  volume: number;
  onVolumeChange: (v: number) => void;
  locale: Locale;
  onSetLocale: (next: Locale) => void;
}) {
  const { theme, setTheme } = useTheme();
  const [notifRoom, setNotifRoom] = useState(() => notifCategoryPref("room"));
  const [notifDocks, setNotifDocks] = useState(() =>
    notifCategoryPref("docks"),
  );
  const [notifTidewatch, setNotifTidewatch] = useState(() =>
    notifCategoryPref("tidewatch"),
  );

  // There is deliberately no load effect here. Every preference on this
  // screen is read from localStorage by its own lazy initializer when the
  // state is created, so there is nothing for an effect to do on open and
  // nothing opens a render pass it cannot fill.

  const saveVolume = (v: number) => {
    onVolumeChange(v);
  };

  const toggleNotif = (
    category: NotifCategory,
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    current: boolean,
  ) => {
    const next = !current;
    setNotifCategoryPref(category, next);
    setter(next);
  };

  return (
    <AnimatePresence>
      {open && (
        <ModalOverlay label={t("Settings")} onClose={() => onOpenChange(false)}>
          <ModalSheet>
            {/* Header */}
            <div className="relative shrink-0 overflow-hidden border-b border-border/40 p-6">
              <div className="pm-seigaiha absolute inset-0 opacity-20 pointer-events-none" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="pm-grad-settings flex h-10 w-10 items-center justify-center rounded-xl">
                    <Settings className="h-5 w-5" />
                  </div>
                  <h2 className="font-display text-lg font-bold text-settings">
                    {t("Settings")}
                  </h2>
                </div>
                <ModalClose
                  label={t("Close settings")}
                  onClick={() => onOpenChange(false)}
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 space-y-5 overflow-y-auto p-6 pm-scroll">
              {/* Sound */}
              <Section icon={Volume2} title={t("Sound")}>
                <ToggleRow
                  label={t("Harbor sounds")}
                  description={t("Ambient harbor bed and UI feedback tones")}
                  checked={soundEnabled}
                  onChange={onToggleSound}
                />
                {soundEnabled && (
                  <div className="pt-2">
                    <label className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t("Volume")}</span>
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
              <Section icon={theme === "dark" ? Moon : Sun} title={t("Theme")}>
                <div className="grid grid-cols-3 gap-2">
                  <ThemeButton
                    active={theme === "light"}
                    onClick={() => setTheme("light")}
                    icon={Sun}
                    label={t("Light")}
                  />
                  <ThemeButton
                    active={theme === "dark"}
                    onClick={() => setTheme("dark")}
                    icon={Moon}
                    label={t("Dark")}
                  />
                  <ThemeButton
                    active={theme === "system"}
                    onClick={() => setTheme("system")}
                    icon={Monitor}
                    label={t("Auto")}
                  />
                </div>
              </Section>

              {/* Language. The pair is the whole switch: each button
                  names a language, and the pack reads the pair beside
                  every other string on this screen, so a captain sees
                  each language named in the language they are reading. */}
              <Section icon={Languages} title={t("Language")}>
                <div className="grid grid-cols-2 gap-2">
                  <ThemeButton
                    active={locale === "en"}
                    onClick={() => onSetLocale("en")}
                    label={t("English")}
                  />
                  <ThemeButton
                    active={locale === "zh"}
                    onClick={() => onSetLocale("zh")}
                    label={t("Chinese")}
                  />
                </div>
              </Section>

              {/* Colorblind palette */}
              <Section icon={Palette} title={t("Visual")}>
                <ToggleRow
                  label={t("Colorblind safe palette")}
                  description={t("Use Okabe Ito anchored colors for all goods")}
                  checked={colorblindSafe}
                  onChange={onToggleColorblind}
                />
              </Section>

              {/* Notifications. The "room"
                  category has exactly one writer, the harbor chat push in
                  GameRoom (see the chat:room handler), so the description
                  names that one thing. The label matches the panel the
                  notification opens. */}
              <Section icon={Bell} title={t("Notifications")}>
                <ToggleRow
                  label={t("Harbor chat")}
                  description={t(
                    "Messages from the other captains in the harbor",
                  )}
                  checked={notifRoom}
                  onChange={() => toggleNotif("room", setNotifRoom, notifRoom)}
                />
                <ToggleRow
                  label={t("Word on the Docks")}
                  description={t(
                    "The race to {WORD_ON_THE_DOCKS_THRESHOLD} completed orders",
                    { WORD_ON_THE_DOCKS_THRESHOLD },
                  )}
                  checked={notifDocks}
                  onChange={() =>
                    toggleNotif("docks", setNotifDocks, notifDocks)
                  }
                />
                <ToggleRow
                  label={t("Tidewatch Alerts")}
                  description={t(
                    "The harbor crossing {TIDEWATCH_SURGE_THRESHOLD} combined Reputation",
                    { TIDEWATCH_SURGE_THRESHOLD },
                  )}
                  checked={notifTidewatch}
                  onChange={() =>
                    toggleNotif("tidewatch", setNotifTidewatch, notifTidewatch)
                  }
                />
              </Section>

              {/* Keyboard shortcuts reference */}
              <Section icon={Keyboard} title={t("Shortcuts")}>
                <div className="rounded-lg bg-black/5 p-3 text-xs text-muted-foreground dark:bg-white/5">
                  {t(
                    "Press ? or F2 in a harbor to see all keyboard shortcuts.",
                  )}
                </div>
              </Section>
            </div>
          </ModalSheet>
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
      {/* The one switch in the app (see @/components/ui/switch), in the
          size these rows are read at. It was a control of this screen's
          own, and a switch that looks one way in the lobby and another
          way here is two things a captain has to learn. */}
      <Switch
        size="lg"
        checked={checked}
        onCheckedChange={onChange}
        aria-label={label}
      />
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
  // Optional because the language pair has nothing to draw above its two
  // labels: a word for each language reads better than two of the same
  // glyph, and the theme row keeps its three.
  icon?: React.ComponentType<{ className?: string }>;
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
      {Icon && <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}
