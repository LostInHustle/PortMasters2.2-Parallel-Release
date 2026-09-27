"use client";

import type { Socket } from "socket.io-client";
import type { PublicUser } from "@/lib/api";
import { useRoomRoster } from "@/lib/use-room-roster";
import { Avatar } from "./shared";
import { cn } from "@/lib/utils";
import { Coins, Trophy, SkullIcon, Anchor, Utensils } from "lucide-react";
import { seatMarks } from "@/lib/seatMarks";

/**
 * [MANIFEST 18: Fleet Ticker] A glance at the whole harbor without opening
 * anyone's detail popup. MembersPanel already shows the same round, phase,
 * gold, and reputation for every captain, but it sits in the right column
 * of the desktop layout and, on any screen under the lg breakpoint, stacks
 * to the very bottom of the page behind the phase panel and the roster's
 * own scroll. This strip sits directly under the header instead, full
 * width, on every screen size, so the room's state is visible without
 * scrolling past anything. The live roster comes from useRoomRoster, the
 * same hook MembersPanel uses, rather than threading a second copy of that
 * state down from GameRoom.
 */
export function FleetTicker({
  socket,
  roomId,
  me,
  initialMembers,
}: {
  socket: Socket | null;
  roomId: string;
  me: PublicUser;
  initialMembers: (PublicUser & { joinedAt?: string })[];
}) {
  const { members, statuses } = useRoomRoster(socket, roomId, initialMembers);

  // Me first, same ordering rule MembersPanel already uses, so a captain
  // finds their own chip in the same spot in both places.
  const sorted = [...members].sort((a, b) => {
    if (a.id === me.id) return -1;
    if (b.id === me.id) return 1;
    return 0;
  });

  if (sorted.length <= 1) return null;

  return (
    <div className="pm-glass rounded-2xl px-3 py-2 mb-3 overflow-x-auto pm-scroll">
      <div className="flex items-center gap-2 w-max min-w-full">
        {sorted.map((m) => {
          const st = statuses[m.id];
          const isMe = m.id === me.id;
          // [H7: Maroon and the Harbormaster] Both marks come off the one
          // rule in seatMarks, which is what stops this strip and the
          // roster panel spelling the same captain two different ways.
          const { bankrupt: isBankrupt, marooned: isMarooned } = seatMarks(st);
          return (
            <div
              key={m.id}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-2 py-1 border shrink-0",
                isMe
                  ? "border-members/30 bg-members/[0.06]"
                  : "border-black/5 dark:border-white/10 bg-background/40",
              )}
            >
              <Avatar hue={m.avatarHue} name={m.displayName} size={20} />
              <span className="text-[11px] font-medium max-w-[84px] truncate">
                {isMe ? "You" : m.displayName}
              </span>
              {isMarooned && (
                <span
                  className="flex items-center text-alarm"
                  title="Put ashore by a vote of the harbor"
                >
                  <Anchor className="h-3 w-3" />
                </span>
              )}
              {/* [C1: the Larder and Short Rations] The hungry crew, in the
                  same red the roster uses and for the same reason: a
                  shortage is a status, and a status draws from the meaning
                  half of the palette. An icon alone, because this strip is
                  read at a glance and the title carries the sentence. */}
              {st?.shortRations && (
                <span
                  className="flex items-center text-alarm"
                  title="Going hungry: the crew is on short rations and working at a slower pace"
                >
                  <Utensils className="h-3 w-3" />
                </span>
              )}
              {isBankrupt ? (
                <span className="flex items-center gap-1 text-[10px] text-alarm">
                  <SkullIcon className="h-3 w-3" /> Bankrupt
                </span>
              ) : (
                <>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[96px]">
                    {st ? st.phaseLabel : "loading…"}
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] text-gold-ink">
                    <Coins className="h-3 w-3" /> {st ? st.gold : "…"}
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] text-favor">
                    <Trophy className="h-3 w-3" /> {st ? st.reputation : "…"}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
