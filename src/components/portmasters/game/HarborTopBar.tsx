"use client";

// =====================================================================
// A harbor's top bar.
//
// Three kinds of thing sit in it. The room's own identity: its name, the
// code a captain reads out to a friend, and how many are aboard. The
// suggestion button, which reads the phase and offers this captain a next
// move. And the four controls that belong to the captain's own session
// rather than to the voyage: the colorblind safe palette, the harbor
// sounds, the settings, and the notifications.
//
// Nothing here decides anything. Every switch below is a value and a
// callback handed in by the room, which owns the state, so this file is
// only ever the arrangement of the bar.
// =====================================================================

import type { GameState } from "@/lib/game/types";
import type { PublicUser, RoomDetail } from "@/lib/api";
import { cn, normalizeRoomName } from "@/lib/utils";
import { ActionSuggester } from "../ActionSuggester";
import { AgeBanner } from "../AgeBanner";
import { Avatar, OnlineDot, Pill } from "../shared";
import { Button } from "@/components/ui/button";
import {
  Anchor,
  Bell,
  Copy,
  DoorOpen,
  Palette,
  Settings,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";

export function HarborTopBar({
  room,
  memberCount,
  onCopyCode,
  game,
  connected,
  authed,
  colorblindSafe,
  onToggleColorblind,
  soundOn,
  onToggleSound,
  onOpenSettings,
  unreadCount,
  onToggleNotifications,
  me,
  onLeave,
}: {
  /** The room this bar stands over: the name it shows and the code it copies. */
  room: Pick<RoomDetail, "name" | "code">;
  memberCount: number;
  onCopyCode: () => void;
  /** Read by the suggestion button, and by nothing else here. */
  game: GameState;
  connected: boolean;
  authed: boolean;
  colorblindSafe: boolean;
  onToggleColorblind: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
  onOpenSettings: () => void;
  unreadCount: number;
  /** Opens the notification list, or closes it when it is already open. */
  onToggleNotifications: () => void;
  me: PublicUser;
  onLeave: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 px-3 sm:px-5 py-3">
      <div className="pm-glass rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-3 min-w-0">
          <div className="pm-grad-brand h-9 w-9 rounded-xl flex items-center justify-center shrink-0">
            <Anchor className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-bold leading-tight truncate font-display">
                {normalizeRoomName(room.name)}
              </h1>
              <Pill tone="sea" className="shrink-0">
                <Users className="h-3 w-3" /> {memberCount}
              </Pill>
            </div>
            <button
              onClick={onCopyCode}
              className="pm-pressable text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <span className="font-mono tracking-widest">{room.code}</span>
              <Copy className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-end">
          <AgeBanner variant="pill" className="hidden md:inline-flex" />
          <div className="relative hidden sm:block">
            <ActionSuggester game={game} />
          </div>
          <Pill tone="gain" className="hidden sm:inline-flex">
            <OnlineDot online={connected && authed} size={8} />{" "}
            {connected && authed ? "Live" : "Linking…"}
          </Pill>
          <Button
            variant="ghost"
            size="sm"
            className={cn("rounded-lg", colorblindSafe && "text-gain")}
            onClick={onToggleColorblind}
            title={
              colorblindSafe
                ? "Colorblind safe palette on, click to use the default colors"
                : "Use a colorblind safe palette for goods"
            }
          >
            <Palette className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("rounded-lg", soundOn && "text-gain")}
            onClick={onToggleSound}
            title={
              soundOn
                ? "Harbor sounds on, click to mute"
                : "Turn on harbor sounds and UI feedback"
            }
            aria-label={
              soundOn ? "Mute harbor sounds" : "Turn on harbor sounds"
            }
          >
            {soundOn ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-lg"
            onClick={onOpenSettings}
            title="Settings"
            aria-label="Open settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-lg relative"
            onClick={onToggleNotifications}
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <Pill
                tone="alarm"
                className="absolute -top-1 -right-1 !px-1 !py-0 min-w-[16px] h-4 justify-center text-[10px]"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Pill>
            )}
          </Button>
          <div className="flex items-center gap-2 sm:pl-2 sm:border-l border-black/5 dark:border-white/10">
            <Avatar hue={me.avatarHue} name={me.displayName} size={30} ring />
            {/* Below the sm width the Leave button is its glyph alone,
                with the name kept in the title and the aria label: the
                labelled button and the divider before it were the last
                two things pushing the bar's controls onto a second row
                on a phone, and a second row of chrome is a second row
                of board the captain cannot see. */}
            <Button
              variant="ghost"
              size="sm"
              className="rounded-lg"
              aria-label="Leave the harbor"
              title="Leave the harbor"
              onClick={onLeave}
            >
              <DoorOpen className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Leave</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
