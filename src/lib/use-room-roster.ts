"use client";

import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import type {
  GameStatusUpdate,
  PublicUser,
  RoomMemberLive,
} from "@/types/realtime";

type RoomStatusMap = Record<string, GameStatusUpdate>;

/**
 * The room's live roster: who is aboard, each captain's last reported status,
 * and who the host has muted. Both surfaces that show the harbor at a glance
 * (MembersPanel's full roster and FleetTicker's strip) need exactly this, and
 * previously carried their own byte for byte copy of the dedupe and prune
 * logic below, so a fix to one silently missed the other.
 *
 * Every caller still subscribes on its own, exactly as before: this shares the
 * code, not the state, so mounting both panels behaves identically to the two
 * separate copies it replaces.
 */
export function useRoomRoster(
  socket: Socket | null,
  roomId: string,
  initialMembers: (PublicUser & { joinedAt?: string })[],
) {
  const [members, setMembers] = useState<RoomMemberLive[]>(initialMembers);
  const [statuses, setStatuses] = useState<RoomStatusMap>({});
  // Rides the same room:members broadcast the roster itself comes over, so a
  // mute needs no separate subscription.
  const [mutedUserIds, setMutedUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!socket) return;

    const onMembers = (data: {
      roomId: string;
      members: RoomMemberLive[];
      mutedUserIds?: string[];
    }) => {
      if (data.roomId !== roomId) return;
      setMutedUserIds(new Set(data.mutedUserIds ?? []));
      // Defensive dedupe by id. The server collapses a captain's many sockets
      // to one roster row, but a stale duplicate must never reach a render: it
      // would collide on React's `key={m.id}`, whose reconciliation is
      // undefined, leaving a ghost row stuck on an old status beside the live
      // one.
      const seen = new Set<string>();
      const filtered = data.members.filter((m) =>
        seen.has(m.id) ? false : (seen.add(m.id), true),
      );
      setMembers(filtered);
      // Prune status entries for captains no longer in the room. Over a long
      // session the map accumulates departed members whose last known gold and
      // reputation are now meaningless, and if a new captain ever arrived on
      // the same user id the stale status would flash before the first live
      // heartbeat overwrote it.
      const memberIds = new Set(filtered.map((m) => m.id));
      setStatuses((prev) => {
        let changed = false;
        const next: RoomStatusMap = {};
        for (const [id, st] of Object.entries(prev)) {
          if (memberIds.has(id)) {
            next[id] = st;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    };
    const onStatus = (u: GameStatusUpdate) => {
      if (u.roomId !== roomId) return;
      setStatuses((prev) => ({ ...prev, [u.user.id]: u }));
    };

    socket.on("room:members", onMembers);
    socket.on("game:status", onStatus);
    return () => {
      // Detach listeners only, never leave the room channel here: this runs on
      // any unmount, not on a deliberate departure.
      socket.off("room:members", onMembers);
      socket.off("game:status", onStatus);
    };
  }, [socket, roomId]);

  return { members, statuses, mutedUserIds };
}
