"use client";

import { PlayerReportAck } from "@/types/realtime/moderation";
import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import type { PublicUser } from "@/lib/api";
import { useRoomRoster } from "@/lib/use-room-roster";
import { toast } from "sonner";
import { usePlayerDetail } from "@/lib/use-player-detail";
import { RosterHeader } from "./roster/RosterHeader";
import { RosterRow } from "./roster/RosterRow";
import { SystemNotices } from "./roster/SystemNotices";

// The panel itself is the wiring and nothing else: the roster hook, the
// notice feed, the run of actions this viewer has taken, and the sort. The
// heading, the row and the notices under it are drawn by the three
// components under ./roster, each handed only the fields it draws.
/**
 * Live roster of room members, collapsed down to what matters at a glance:
 * gold, reputation, and whether they're still in the run. Click a row to
 * open the full detail popup (cargo, workers, log) in PlayerDetailModal.tsx.
 *
 * [MANIFEST: Partial Sight] Each non self row carries an eye button that
 * opens a small popover showing a banded cargo read of the target captain.
 * The bands come straight from bandFor in engine/partialSight: "none", "a
 * few", "some", "plenty", "a haul". The peek is gated by canSeeDetail, so
 * only a captain at or above the viewer threshold looking at one at or
 * above the subject threshold sees the button at all. The cargo snapshot
 * is fetched on demand via usePlayerDetail's requestDetail and banded
 * client side, never as raw numbers.
 */
export function MembersPanel({
  socket,
  roomId,
  me,
  initialMembers,
  hostId,
  onSelectPlayer,
  myRenownLevel = 1,
  collapsed = false,
  onToggleCollapse,
}: {
  socket: Socket | null;
  roomId: string;
  me: PublicUser;
  initialMembers: (PublicUser & { joinedAt?: string })[];
  hostId: string;
  onSelectPlayer: (userId: string) => void;
  myRenownLevel?: number;
  // The fold, owned by the room rather than by this panel (see
  // usePanelPrefs in GameRoom): the roster and the chat share the right
  // rail, so folding one is a fact about the rail the other lives in, and
  // on the wide layout it is the room that hides this panel outright and
  // stands its strip in the rail. What arrives here is the below
  // breakpoint half of the same record: the fold to the head that a full
  // width row has room for. Defaulted open, which is the panel's own
  // contract without the room around it.
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  // Roster, per captain status, and the host's mute list all come from the
  // shared hook, which FleetTicker uses too; only the system notice feed
  // below is this panel's own, since nothing else renders it.
  const { members, statuses, mutedUserIds } = useRoomRoster(
    socket,
    roomId,
    initialMembers,
  );
  const [systemNotes, setSystemNotes] = useState<string[]>([]);
  // [J2: the mute and the report] The captains this one has reported in
  // this harbor, held here so the flag settles on the row it was raised
  // against. The server is the authority on the limit (one report per pair
  // per voyage, held by the table's own constraint); this is only what the
  // button shows, and a duplicate answer from the server lands in the same
  // set as a fresh one, because the captain's state afterwards is the same
  // either way.
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  // Named viewerIsHost, not isHost, so it never shadows the per row "is this
  // row the host" check further down.
  const viewerIsHost = me.id === hostId;

  // [MANIFEST: Partial Sight] The peek button uses usePlayerDetail's
  // requestDetail to ask the target's client for a snapshot, then applies
  // bandFor to each cargo count before showing it.
  //
  // No snapshot function is passed, on purpose. This panel only ever asks
  // about other captains; it never answers for its own. The one responder
  // lives in GameRoom, which holds the live game state, and leaving this
  // instance without one is what stops a single request being answered
  // twice, once with the real hold and once with a placeholder full of
  // zeros.
  const { detail, loading, requestDetail } = usePlayerDetail(socket, roomId);

  // The room channel itself is joined (and re joined on every reconnect)
  // from GameRoom.tsx, since that needs to happen exactly once per
  // connection regardless of which panels happen to be mounted.
  useEffect(() => {
    if (!socket) return;
    const onSystem = (data: { roomId: string; content: string }) => {
      if (data.roomId !== roomId) return;
      setSystemNotes((prev) => [...prev.slice(-12), data.content]);
    };
    socket.on("room:system", onSystem);
    return () => {
      // IMPORTANT: detach the listener only. Do not emit "room:leave" here.
      // That event does exist and is genuinely used, but only from
      // handleLeave in GameRoom.tsx, for a deliberate departure. This cleanup
      // runs on any unmount, when the captain has not left at all, and
      // dropping the channel then would silently break every later
      // room scoped event with no error and no recovery short of a full
      // reload.
      socket.off("room:system", onSystem);
    };
  }, [socket, roomId]);

  // The one frame a report produces. The target is told nothing and the
  // harbor is told nothing, so this is the whole of what a report sends
  // back, and it is settled into the row it names rather than into a
  // running count: a captain reports a captain, not a game.
  useEffect(() => {
    if (!socket) return;
    const onFiled = (data: PlayerReportAck) => {
      if (data.roomId !== roomId) return;
      setReportedIds((prev) => {
        if (prev.has(data.targetUserId)) return prev;
        const next = new Set(prev);
        next.add(data.targetUserId);
        return next;
      });
      if (data.alreadyFiled) {
        toast("You have already reported this captain this voyage.");
      } else {
        toast.success("Report filed. It goes on the record for this voyage.");
      }
    };
    socket.on("player:report:filed", onFiled);
    return () => {
      socket.off("player:report:filed", onFiled);
    };
  }, [socket, roomId]);

  // Sort: me first, then by reputation desc, then gold desc.
  const sorted = [...members].sort((a, b) => {
    if (a.id === me.id) return -1;
    if (b.id === me.id) return 1;
    const ra = statuses[a.id]?.reputation ?? -1;
    const rb = statuses[b.id]?.reputation ?? -1;
    if (rb !== ra) return rb - ra;
    return (statuses[b.id]?.gold ?? 0) - (statuses[a.id]?.gold ?? 0);
  });

  return (
    <div className="pm-glass rounded-2xl flex flex-col overflow-hidden h-full">
      <RosterHeader
        memberCount={members.length}
        collapsed={collapsed}
        onToggle={onToggleCollapse}
      />

      {/* Folded, the panel is its head below the breakpoint, where the
          fold is an accordion: the list and the notices under it leave
          the row, and the height they held goes to whatever follows,
          which is what the fold is for there. On the wide layout the
          room hides this panel outright and stands its strip in the rail
          (see the strips in GameRoom), so nothing here is on screen
          there. One conditional around the pair rather than one around
          each, because the notices ride under the list as one unit. */}
      {!collapsed && (
        <>
          <div className="pm-scroll flex-1 min-h-0 overflow-y-auto p-2.5 space-y-1.5">
            {sorted.map((m) => (
              <RosterRow
                key={m.id}
                member={m}
                status={statuses[m.id]}
                isMe={m.id === me.id}
                isHost={m.id === hostId}
                isMuted={mutedUserIds.has(m.id)}
                reported={reportedIds.has(m.id)}
                viewerIsHost={viewerIsHost}
                myRenownLevel={myRenownLevel}
                roomId={roomId}
                socket={socket}
                onSelectPlayer={onSelectPlayer}
                onPeek={requestDetail}
                peekLoading={Boolean(loading[m.id])}
                peekSnapshot={detail[m.id] ?? null}
              />
            ))}
            {members.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-6">
                No captains in this harbor yet.
              </div>
            )}
          </div>

          <SystemNotices notes={systemNotes} />
        </>
      )}
    </div>
  );
}
