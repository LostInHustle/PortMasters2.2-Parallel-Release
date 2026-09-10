"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Socket } from "socket.io-client";
import type { PublicUser } from "@/lib/api";
import { useRoomRoster } from "@/lib/use-room-roster";
import { Avatar, OnlineDot, Pill } from "./shared";
import { cn } from "@/lib/utils";
import {
  Ship,
  Coins,
  Trophy,
  Crown,
  SkullIcon,
  VolumeX,
  Volume2,
  Eye,
  Loader2,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  usePlayerDetail,
  type PlayerDetailData,
} from "@/lib/use-player-detail";
import { bandFor, canSeeDetail } from "@/lib/game/engine";

/**
 * Live roster of room members, collapsed down to what matters at a glance:
 * gold, reputation, and whether they're still in the run. Click a row to
 * open the full detail popup (cargo, workers, log) in GameModals.tsx.
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
}: {
  socket: Socket | null;
  roomId: string;
  me: PublicUser;
  initialMembers: (PublicUser & { joinedAt?: string })[];
  hostId: string;
  onSelectPlayer: (userId: string) => void;
  myRenownLevel?: number;
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
      <div className="px-4 py-3 border-b border-black/5 dark:border-white/10 flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Ship className="h-4 w-4 text-teal-600 dark:text-teal-400" /> Harbor
          Roster
        </h3>
        <Pill tone="sea">
          {members.length} captain{members.length !== 1 ? "s" : ""}
        </Pill>
      </div>

      <div className="pm-scroll flex-1 min-h-0 overflow-y-auto p-2.5 space-y-1.5">
        {sorted.map((m) => {
          const st = statuses[m.id];
          const isMe = m.id === me.id;
          const isHost = m.id === hostId;
          const isBankrupt = st?.phase === "bankruptcy";
          const isMuted = mutedUserIds.has(m.id);
          // [MANIFEST: Partial Sight] The target's Renown level arrives
          // with the roster status when the server reports it. If it is
          // missing, we treat it as zero, which makes canSeeDetail return
          // false and the peek button stays hidden.
          const theirRenownLevel = st?.renownLevel ?? 0;
          const canPeek = canSeeDetail(myRenownLevel, theirRenownLevel);
          return (
            <motion.div
              key={m.id}
              layout
              role="button"
              tabIndex={0}
              whileHover={{ scale: 1.01, y: -1 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              onClick={() => onSelectPlayer(m.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectPlayer(m.id);
                }
              }}
              className={cn(
                "w-full flex items-center gap-2.5 rounded-xl p-2 border text-left transition-colors cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.05]",
                isMe
                  ? "border-teal-500/30 bg-teal-500/[0.06]"
                  : "border-black/5 dark:border-white/10 bg-background/40",
              )}
            >
              <div className="relative shrink-0">
                <Avatar hue={m.avatarHue} name={m.displayName} size={32} ring />
                <OnlineDot
                  online
                  size={9}
                  className="absolute -bottom-0.5 -right-0.5 ring-2 ring-background rounded-full"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">
                    {m.displayName}
                  </span>
                  {isHost && (
                    <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  )}
                  {isMe && (
                    <Pill tone="sea" className="!py-0">
                      you
                    </Pill>
                  )}
                  {isMuted && (
                    <Pill tone="rose" className="!py-0">
                      <VolumeX className="h-2.5 w-2.5" /> muted
                    </Pill>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {st ? `R${st.round} · ${st.phaseLabel}` : "loading…"}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {isBankrupt ? (
                  <Pill tone="rose">
                    <SkullIcon className="h-3 w-3" /> Bankrupt
                  </Pill>
                ) : (
                  <>
                    <Pill tone="jade">
                      <Coins className="h-3 w-3" /> {st ? st.gold : "…"}
                    </Pill>
                    <Pill tone="gold">
                      <Trophy className="h-3 w-3" /> {st ? st.reputation : "…"}
                    </Pill>
                  </>
                )}

                {/* [MANIFEST: Partial Sight] Read only peek at a partner's
                    banded cargo. Hidden on my own row, on a bankrupt
                    captain's row, and whenever the trust threshold is not
                    met. */}
                {!isMe && !isBankrupt && canPeek && (
                  <PeekButton
                    targetName={m.displayName}
                    onPeek={() => requestDetail(m.id)}
                    loading={Boolean(loading[m.id])}
                    snapshot={detail[m.id] ?? null}
                  />
                )}

                {/* [MANIFEST 14: Harbor Watch] Host only, never on my own
                    row: the host can mute anyone else, never themselves. */}
                {viewerIsHost && !isMe && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      socket?.emit(isMuted ? "chat:unmute" : "chat:mute", {
                        roomId,
                        targetUserId: m.id,
                      });
                    }}
                    title={
                      isMuted ? "Unmute this captain" : "Mute this captain"
                    }
                    className="p-1 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/10 text-muted-foreground"
                  >
                    {isMuted ? (
                      <Volume2 className="h-3.5 w-3.5" />
                    ) : (
                      <VolumeX className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
        {members.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-6">
            No captains in this harbor yet.
          </div>
        )}
      </div>

      {/* System notices */}
      {systemNotes.length > 0 && (
        <div className="border-t border-black/5 dark:border-white/10 px-3 py-2 max-h-16 overflow-y-auto pm-scroll">
          <AnimatePresence initial={false}>
            {systemNotes.slice(-2).map((n, i) => (
              <motion.div
                key={systemNotes.length - 2 + i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-[10px] text-muted-foreground italic"
              >
                {n}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// The Partial Sight peek button and its popover. Renders the eye icon as
// the trigger, then a small grid of banded cargo counts inside the
// popover. The popover is read only: clicking the row itself still opens
// the full PlayerDetailModal in GameRoom.
function PeekButton({
  targetName,
  onPeek,
  loading,
  snapshot,
}: {
  targetName: string;
  onPeek: () => void;
  loading: boolean;
  snapshot: PlayerDetailData | null;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Peek at ${targetName}'s cargo`}
          title={`Partial sight peek at ${targetName}`}
          onClick={(e) => {
            e.stopPropagation();
            onPeek();
          }}
          className="p-1 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/10 text-muted-foreground"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 text-xs"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1.5 flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          <span className="font-semibold">{targetName}</span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            partial sight
          </span>
        </div>
        {!snapshot ? (
          <p className="text-muted-foreground py-2 text-center">
            {loading
              ? "Asking the harbor…"
              : "No snapshot yet. Tap the eye again."}
          </p>
        ) : (
          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gold</span>
              <b className="capitalize">{bandFor(snapshot.money)}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reputation</span>
              <b className="capitalize">{bandFor(snapshot.score)}</b>
            </div>
            <div className="mt-1 border-t border-black/5 dark:border-white/10 pt-1">
              {Object.entries(snapshot.inventory)
                .filter(([, n]) => n > 0)
                .slice(0, 6)
                .map(([item, n]) => (
                  <div key={item} className="flex justify-between">
                    <span className="text-muted-foreground truncate">
                      {item}
                    </span>
                    <b className="capitalize">{bandFor(n)}</b>
                  </div>
                ))}
              {Object.values(snapshot.inventory).every((n) => n === 0) && (
                <p className="text-muted-foreground italic">Hold is empty.</p>
              )}
            </div>
          </div>
        )}
        <p className="mt-1.5 text-[10px] text-muted-foreground/70">
          Bands are read from {targetName}'s live snapshot. The harbor master
          only shares what your standing allows.
        </p>
      </PopoverContent>
    </Popover>
  );
}

// Re-exported so any caller that wants the band label alone can compute it
// without reaching into the engine module directly.
export { bandFor };
