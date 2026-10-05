"use client";

import { RoomMemberLive } from "@/types/realtime/presence";
import { GameStatusUpdate } from "@/types/realtime/status";
import { motion } from "framer-motion";
import type { Socket } from "socket.io-client";
import type { PlayerDetailData } from "@/lib/use-player-detail";
import { canSeeDetail } from "@/lib/game/engine";
import { HUNGRY_CREW_TOOLTIP } from "@/lib/game/constants/copy";
import { seatMarks } from "@/lib/seatMarks";
import { cn } from "@/lib/utils";
import { Avatar, OnlineDot, Pill } from "../shared";
import { IconButton } from "./IconButton";
import { PeekButton } from "./PeekButton";
import {
  Anchor,
  Coins,
  Crown,
  Flag,
  SkullIcon,
  Trophy,
  Utensils,
  Volume2,
  VolumeX,
} from "lucide-react";

/**
 * One captain's line in the roster: who they are, what they are doing, and
 * what their books say, with the three things this viewer is allowed to do
 * to them on the right. A row is a button, so the whole line opens the
 * detail popup, and each action stops the click before it gets there.
 */
export function RosterRow({
  member,
  status,
  isMe,
  isHost,
  isMuted,
  reported,
  viewerIsHost,
  myRenownLevel,
  roomId,
  socket,
  onSelectPlayer,
  onPeek,
  peekLoading,
  peekSnapshot,
}: {
  member: RoomMemberLive;
  status: GameStatusUpdate | undefined;
  isMe: boolean;
  isHost: boolean;
  isMuted: boolean;
  reported: boolean;
  viewerIsHost: boolean;
  myRenownLevel: number;
  roomId: string;
  socket: Socket | null;
  onSelectPlayer: (userId: string) => void;
  onPeek: (userId: string) => void;
  peekLoading: boolean;
  peekSnapshot: PlayerDetailData | null;
}) {
  // [H7: Maroon and the Harbormaster] The two marks a failed
  // voyage leaves on a seat, read through the one place that
  // states the rule (see seatMarks). Both are read from the
  // broadcast status for the reason the bankruptcy mark always
  // was: in Ocean Gambit a failed seat sails on, so the phase
  // alone would badge nobody.
  const { bankrupt: isBankrupt, marooned: isMarooned } = seatMarks(status);
  // [MANIFEST: Partial Sight] The target's Renown level arrives
  // with the roster status when the server reports it. If it is
  // missing, we treat it as zero, which makes canSeeDetail return
  // false and the peek button stays hidden.
  const theirRenownLevel = status?.renownLevel ?? 0;
  const canPeek = canSeeDetail(myRenownLevel, theirRenownLevel);
  return (
    <motion.div
      layout
      role="button"
      tabIndex={0}
      whileHover={{ scale: 1.01, y: -1 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
      onClick={() => onSelectPlayer(member.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectPlayer(member.id);
        }
      }}
      className={cn(
        "w-full flex items-center gap-2.5 rounded-xl p-2 border text-left transition-colors cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.05]",
        isMe
          ? "border-members/30 bg-members/[0.06]"
          : "border-black/5 dark:border-white/10 bg-background/40",
      )}
    >
      <div className="relative shrink-0">
        <Avatar
          hue={member.avatarHue}
          name={member.displayName}
          size={32}
          ring
        />
        <OnlineDot
          online
          size={9}
          className="absolute -bottom-0.5 -right-0.5 ring-2 ring-background rounded-full"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">
            {member.displayName}
          </span>
          {isHost && <Crown className="h-3.5 w-3.5 text-gold-ink shrink-0" />}
          {isMe && (
            <Pill tone="default" className="!py-0">
              you
            </Pill>
          )}
          {isMuted && (
            <Pill tone="alarm" className="!py-0">
              <VolumeX className="h-2.5 w-2.5" /> muted
            </Pill>
          )}
        </div>
        {/* What they are doing and what their books say, on the line under
            the name rather than at the far end of it. The rail is a rail:
            held to the width that leaves the board its own, one line for a
            name, a crown, a "you" and two purses leaves the name about a
            hundred pixels, which is where a captain's name stops being
            read and starts being a first letter and an ellipsis. The two
            purses sit with the phase label because they are the same kind
            of fact: what this captain's voyage currently reads as. */}
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[10px] text-muted-foreground">
            {status ? status.phaseLabel : "loading…"}
          </span>
          {!isBankrupt && (
            <>
              <Pill tone="gold" className="shrink-0 !px-2 !py-0">
                <Coins className="h-2.5 w-2.5" /> {status ? status.gold : "…"}
              </Pill>
              <Pill tone="favor" className="shrink-0 !px-2 !py-0">
                <Trophy className="h-2.5 w-2.5" />{" "}
                {status ? status.reputation : "…"}
              </Pill>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {isBankrupt && (
          <Pill tone="alarm">
            <SkullIcon className="h-3 w-3" /> Bankrupt
          </Pill>
        )}
        {/* A marooned captain still has real books, so the gold and
            reputation pills stay on their row; the badge says what
            happened to the ship, not to the purse. */}
        {isMarooned && (
          <Pill tone="alarm">
            <Anchor className="h-3 w-3" /> Ashore
          </Pill>
        )}
        {/* [C1: the Larder and Short Rations] The plan asks for
            the shortage to be visible to the fleet, not just to
            the captain living it, and this is the board the
            fleet reads. It wears the meaning red rather than
            the Larder's own hue: the Larder's colour names the
            panel on the Market screen, while a status is drawn
            from the meaning half of the palette wherever it
            appears (see Pill). Not folded into seatMarks, which
            is about the two marks that write a seat off: a
            hungry captain is neither of those, and a badge that
            rode writtenOff would quietly take them out of the
            running for a vote they are still entitled to. */}
        {status?.shortRations && (
          <span title={HUNGRY_CREW_TOOLTIP}>
            <Pill tone="alarm">
              <Utensils className="h-3 w-3" /> Short Rations
            </Pill>
          </span>
        )}

        {/* [MANIFEST: Partial Sight] Read only peek at a partner's
            banded cargo. Hidden on my own row, on a bankrupt
            captain's row, and whenever the trust threshold is not
            met. */}
        {!isMe && !isBankrupt && canPeek && (
          <PeekButton
            targetName={member.displayName}
            onPeek={() => onPeek(member.id)}
            loading={peekLoading}
            snapshot={peekSnapshot}
          />
        )}

        {/* [MANIFEST 14: Harbor Watch] Host only, never on my own
            row: the host can mute anyone else, never themselves. */}
        {viewerIsHost && !isMe && (
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              socket?.emit(isMuted ? "chat:unmute" : "chat:mute", {
                roomId,
                targetUserId: member.id,
              });
            }}
            title={isMuted ? "Unmute this captain" : "Mute this captain"}
          >
            {isMuted ? (
              <Volume2 className="h-3.5 w-3.5" />
            ) : (
              <VolumeX className="h-3.5 w-3.5" />
            )}
          </IconButton>
        )}

        {/* [J2: the mute and the report] Every captain on every
            other captain's row, host or not, because this is the
            remedy for a harbor somebody else is running and a mode
            that seats strangers needs one. It settles once it has
            been used, since the server writes one row per pair per
            voyage and a second raise would only earn a notice that
            it was already on the record. */}
        {!isMe && (
          <IconButton
            disabled={reported}
            onClick={(e) => {
              e.stopPropagation();
              socket?.emit("player:report", {
                roomId,
                targetUserId: member.id,
              });
            }}
            label={`Report ${member.displayName}`}
            title={
              reported
                ? "You have reported this captain this voyage"
                : `Report ${member.displayName}`
            }
            className="disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Flag
              className={cn(
                "h-3.5 w-3.5",
                reported && "fill-current text-alarm",
              )}
            />
          </IconButton>
        )}
      </div>
    </motion.div>
  );
}
