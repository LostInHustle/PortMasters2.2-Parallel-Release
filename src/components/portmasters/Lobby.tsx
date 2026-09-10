"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  api,
  type ChatMessage,
  type PublicUser,
  type RoomSummary,
} from "@/lib/api";
import { useRealtime } from "@/lib/use-realtime";
import { useColorPreference } from "@/lib/use-color-preference";
import { useSound } from "@/lib/use-sound";
import { getSocket } from "@/lib/realtime";
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  difficultyConfig,
  type Difficulty,
} from "@/lib/game/difficulty";
import { Avatar, OnlineDot, Pill } from "./shared";
import { ChatPanel } from "./ChatPanel";
import { CaptainLegacyCard } from "./CaptainLegacyCard";
import { CaptainProfileModal } from "./CaptainProfileModal";
import { AgeBanner } from "./AgeBanner";
import { HowToPlayModal } from "./HowToPlayModal";
import { HouseLeaderboard } from "./HouseLeaderboard";
import { SettingsModal } from "./SettingsModal";
import { DifficultyAdvisor } from "./DifficultyAdvisor";
import { HarborActivityFeed } from "./HarborActivityFeed";
import { LeaderboardModal } from "./LeaderboardModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Anchor,
  LogOut,
  Plus,
  Ship,
  Star,
  Users,
  KeyRound,
  Loader2,
  ArrowRight,
  MessageCircle,
  RefreshCw,
  Gift,
  Zap,
  BookOpen,
  Landmark,
  Settings,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate, normalizeRoomName } from "@/lib/utils";
import { APP_NAME } from "@/lib/game/constants";
import {
  DEFAULT_LEGACY_SUMMARY,
  renownProgress,
  type CaptainLegacySummary,
  type HouseId,
} from "@/lib/game/legacy";
import { checkInStatus, type CheckInStatus } from "@/lib/game/checkin";
import { HOUSES, type House } from "@/lib/game/engine";
import type { HouseStanding, VoyageChronicle } from "@/types/realtime";

export function Lobby({
  me,
  onEnterRoom,
  onLogout,
}: {
  me: PublicUser;
  onEnterRoom: (room: RoomSummary) => void;
  onLogout: () => void;
}) {
  const { socket, connected, authed, onlineUsers } = useRealtime(me);
  const { colorblindSafe, setColorblindSafe } = useColorPreference();
  const {
    enabled: soundOn,
    toggle: toggleSound,
    volume: soundVolume,
    setVolume: setSoundVolume,
  } = useSound();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [legacy, setLegacy] = useState(DEFAULT_LEGACY_SUMMARY);
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [checkIn, setCheckIn] = useState<CheckInStatus>(() =>
    checkInStatus({ checkInCount: 0, lastCheckInDate: null }),
  );
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [newName, setNewName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  // The host picks one tier for the whole harbor (see src/lib/game/difficulty.ts).
  // It is fixed at creation; changing it afterwards means restarting the voyage.
  const [difficulty, setDifficulty] = useState<Difficulty>("fair_winds");
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // [MANIFEST: Quick Start Match] While queued, the Quick Start button
  // stays in a loading state and waits for the quickstart:matched socket
  // event before routing the captain into the matched room.
  const [quickStarting, setQuickStarting] = useState(false);

  // [MANIFEST: Voyage Chronicle] Dialog state. Fetched on open.
  const [chronicleOpen, setChronicleOpen] = useState(false);
  const [chronicles, setChronicles] = useState<VoyageChronicle[]>([]);
  const [chronicleLoading, setChronicleLoading] = useState(false);

  // [MANIFEST: Great Houses] Dialog state. Standings are fetched on open,
  // and myHouseId tracks the captain's current pledge so the row that is
  // already pledged shows as such.
  const [houseOpen, setHouseOpen] = useState(false);
  const [houseStandings, setHouseStandings] = useState<HouseStanding[]>([]);
  const [myHouseId, setMyHouseId] = useState<HouseId | null>(null);
  const [houseLoading, setHouseLoading] = useState(false);
  const [pledgingHouse, setPledgingHouse] = useState<HouseId | null>(null);

  // DM state
  const [dmTarget, setDmTarget] = useState<PublicUser | null>(null);
  const [dmHistory, setDmHistory] = useState<ChatMessage[]>([]);
  const [dmLoading, setDmLoading] = useState(false);

  const refreshRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const { rooms } = await api.listRooms();
      setRooms(rooms);
    } catch {
      /* ignore */
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    // Kicked off on a timer rather than called straight from the effect body,
    // so the first refresh's setLoadingRooms(true) isn't a synchronous setState
    // inside an effect. Nothing changes visually: loadingRooms already starts
    // true, so that first set was a no op anyway, and the interval's later
    // calls were never inside an effect body.
    const kickoff = setTimeout(refreshRooms, 0);
    const t = setInterval(refreshRooms, 8000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(t);
    };
  }, [refreshRooms]);

  // A captain's Renown only ever changes when a voyage concludes, which
  // never happens while sitting in the lobby, so a plain fetch on mount is
  // enough; no polling needed like the room list above. The same fetch
  // carries the captain's current House pledge so the House dialog can mark
  // the pledged row without an extra round trip.
  useEffect(() => {
    let alive = true;
    api
      .getLegacy()
      .then(({ legacy, checkIn }) => {
        if (alive) {
          setLegacy(legacy);
          setCheckIn(checkIn);
          setMyHouseId(legacy.houseId);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Claim today's Daily Check In. The server is the source of truth for the
  // day math and the guard against a second claim, so we just render whatever
  // state it returns, claimed or not, and surface the reward as a toast.
  const claimCheckIn = useCallback(async () => {
    setClaiming(true);
    try {
      const res = await api.checkIn();
      setLegacy(res.legacy);
      setCheckIn(res.checkIn);
      if (res.claimed) {
        toast.success(`Day ${res.day} claimed: +${res.xpGained} Renown XP`, {
          description: res.leveledUp
            ? "Renown level up! A bigger start of voyage Gold bonus awaits."
            : "Fair winds. Come back tomorrow for the next reward.",
        });
      } else {
        toast("Already checked in today", {
          description: "Come back tomorrow for the next reward.",
        });
      }
    } catch {
      toast.error("Check in failed", {
        description: "Could not reach the harbour master. Try again.",
      });
    } finally {
      setClaiming(false);
    }
  }, []);

  // Renown for every other captain currently shown in "Captains Online"
  // below, fetched as one batch rather than one request per captain (see
  // POST /api/legacy/batch). Keyed on the *set* of online ids, not the
  // onlineUsers array itself, since that array gets a new reference on
  // every presence:update broadcast (anyone, anywhere, connecting or
  // switching rooms), most of which don't actually add or remove anyone
  // from this list.
  const [otherLegacies, setOtherLegacies] = useState<
    Record<string, CaptainLegacySummary>
  >({});
  const onlineIdsKey = useMemo(
    () =>
      onlineUsers
        .map((u) => u.id)
        .sort()
        .join(","),
    [onlineUsers],
  );
  useEffect(() => {
    const ids = onlineIdsKey ? onlineIdsKey.split(",") : [];
    if (ids.length === 0) return;
    let alive = true;
    api
      .getLegaciesFor(ids)
      .then(({ legacies }) => {
        if (alive) setOtherLegacies(legacies);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [onlineIdsKey]);

  // True between asking for a seat in the queue and hearing back. Held in
  // a ref rather than state because the socket listener and the unmount
  // cleanup both read it, and neither should re run when it changes.
  const queuedForMatch = useRef(false);

  // [MANIFEST: Quick Start Match] Join the queue and wait to be paired.
  //
  // The emit below is what actually enqueues this captain. The queue is a
  // Set in the realtime layer's memory, and the REST route runs in a
  // different bundle where that Set would always be empty, so the route is
  // only used to turn an expired session into a clear error before we
  // start waiting on a socket reply that would never arrive.
  const handleQuickStart = useCallback(async () => {
    setQuickStarting(true);
    setError(null);

    try {
      await api.quickStart({ difficulty });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quick Start failed");
      setQuickStarting(false);
      return;
    }

    // Queueing needs a live, authenticated socket. Without one the emit
    // goes nowhere at all, which is what used to leave this button
    // spinning forever.
    if (!socket || !authed) {
      setError("Still connecting to the harbor. Try again in a moment.");
      setQuickStarting(false);
      return;
    }

    queuedForMatch.current = true;
    // The tier goes with the request. It decides the room when this
    // captain is the one who opens it; a captain seated into a harbor
    // that already exists sails at that harbor's tier instead.
    socket.emit("quickstart:join", { difficulty });
    toast("Looking for a harbor", {
      description: "Pairing you with the next captain who asks.",
    });

    // A match is answered within a round trip, so a long silence means the
    // reply went missing. Give up gracefully instead of spinning.
    window.setTimeout(() => {
      if (!queuedForMatch.current) return;
      queuedForMatch.current = false;
      socket.emit("quickstart:leave");
      setError("Quick Start timed out. Please try again.");
      setQuickStarting(false);
    }, 15000);
  }, [difficulty, socket, authed]);

  // [MANIFEST: Quick Start Match] The queue resolves here.
  //
  // The first captain to ask is seated straight away: if no open public
  // harbor is waiting, the realtime layer opens one and makes them the
  // host. The next captain to ask is seated into that same harbor, because
  // it is public and has not set sail. So both callers get a match, and
  // they end up in the same room. We fetch the full room detail and enter,
  // exactly as if the captain had typed the code in by hand.
  useEffect(() => {
    const sock = getSocket();

    const onMatched = (data: { roomId: string }) => {
      queuedForMatch.current = false;
      api
        .getRoom(data.roomId)
        .then(({ room }) => onEnterRoom(room))
        .catch(() =>
          api
            .joinRoomById(data.roomId)
            .then(({ room }) => onEnterRoom(room))
            .catch(() => {
              toast.error(
                "Quick Start matched a harbor, but it could not be reached.",
              );
              setQuickStarting(false);
            }),
        );
    };

    // The realtime layer answers a queue request it cannot serve, so the
    // button stops waiting instead of hanging on a match that is never
    // coming.
    const onQueueError = (data: { error?: string }) => {
      queuedForMatch.current = false;
      setError(data?.error ?? "Quick Start is unavailable right now.");
      setQuickStarting(false);
    };

    sock.on("quickstart:matched", onMatched);
    sock.on("quickstart:error", onQueueError);
    return () => {
      sock.off("quickstart:matched", onMatched);
      sock.off("quickstart:error", onQueueError);
      // Leaving the lobby must not leave a seat behind in the queue, or
      // the next captain to press the button gets paired with somebody who
      // stopped waiting long ago.
      if (queuedForMatch.current) {
        queuedForMatch.current = false;
        sock.emit("quickstart:leave");
      }
    };
  }, [onEnterRoom]);

  async function createRoom() {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { room } = await api.createRoom({
        name: newName.trim(),
        isPublic,
        difficulty,
      });
      setNewName("");
      onEnterRoom(room);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create room");
    } finally {
      setBusy(false);
    }
  }

  async function joinByCode() {
    if (joinCode.trim().length !== 6) {
      setError("Room codes are 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { room } = await api.joinRoomByCode(joinCode.trim().toUpperCase());
      setJoinCode("");
      onEnterRoom(room);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join room");
    } finally {
      setBusy(false);
    }
  }

  async function enterRoom(room: RoomSummary) {
    setJoining(room.id);
    try {
      // Ensure membership (idempotent) then enter.
      const { room: joined } = await api.joinRoomById(room.id);
      onEnterRoom(joined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to enter room");
    } finally {
      setJoining(null);
    }
  }

  async function openDm(user: PublicUser) {
    if (user.id === me.id) return;
    setDmTarget(user);
    setDmLoading(true);
    setDmHistory([]);
    try {
      const { messages } = await api.getDmHistory(user.id);
      setDmHistory(messages);
    } catch {
      /* ignore */
    } finally {
      setDmLoading(false);
    }
  }

  // Re fetch DM history when switching targets (initial seed for ChatPanel).
  useEffect(() => {
    if (!dmTarget) return;
    let alive = true;
    // No setDmLoading(true) here: the only thing that ever sets a target is
    // openDm, which raises the flag before this effect can run. Setting it
    // again synchronously in the effect body only cost a cascading render.
    api
      .getDmHistory(dmTarget.id)
      .then(({ messages }) => {
        if (alive) {
          setDmHistory(messages);
          setDmLoading(false);
        }
      })
      .catch(() => alive && setDmLoading(false));
    return () => {
      alive = false;
    };
  }, [dmTarget?.id]);

  // [MANIFEST: Voyage Chronicle] Fetch the captain's chronicles when the
  // dialog opens. Newest first as returned by /api/chronicle.
  const openChronicle = useCallback(() => {
    setChronicleOpen(true);
    setChronicleLoading(true);
    api
      .listChronicles()
      .then(({ chronicles }) => setChronicles(chronicles))
      .catch(() => {
        toast.error("Could not load chronicles");
      })
      .finally(() => setChronicleLoading(false));
  }, []);

  // [MANIFEST: Great Houses] Fetch harbor wide standings plus the
  // captain's current pledge when the House dialog opens. myHouseId is
  // re synced after a successful pledge so the chosen row stays marked.
  const openHouse = useCallback(() => {
    setHouseOpen(true);
    setHouseLoading(true);
    api
      .getHouseStandings()
      .then(({ standings, myHouseId: hid }) => {
        setHouseStandings(standings);
        if (hid !== undefined) setMyHouseId(hid);
      })
      .catch(() => {
        toast.error("Could not load House standings");
      })
      .finally(() => setHouseLoading(false));
  }, []);

  const pledge = useCallback(async (houseId: HouseId) => {
    setPledgingHouse(houseId);
    try {
      await api.pledgeHouse(houseId);
      setMyHouseId(houseId);
      const house = HOUSES.find((h) => h.id === houseId);
      toast.success(`Pledged to ${house?.name ?? "House"}`, {
        description: "Your House perk applies on your next fresh voyage.",
      });
    } catch (e) {
      toast.error("Pledge failed", {
        description: e instanceof Error ? e.message : "Try again in a moment.",
      });
    } finally {
      setPledgingHouse(null);
    }
  }, []);

  const totalOnline = onlineUsers.length;

  return (
    <div className="pm-canvas min-h-screen w-full">
      {/* Top bar */}
      <header className="sticky top-0 z-30 px-4 sm:px-6 py-3">
        <div className="pm-glass rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="pm-grad-primary h-8 w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0">
              <Anchor className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold leading-tight tracking-tight text-xs sm:text-sm font-display">
                <span className="pm-text-sea pm-truncate">{APP_NAME}</span>
                <span className="text-muted-foreground font-normal text-[10px] sm:text-xs ml-1.5 sm:ml-2">
                  Online
                </span>
              </h1>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-tight pm-truncate">
                Lords of the Silk Road
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
            {/* Status pills: hidden on mobile to reduce clustering */}
            <Pill tone="jade" className="hidden lg:inline-flex">
              <OnlineDot online={connected && authed} />{" "}
              {connected && authed ? "Online" : "Connecting"}
            </Pill>
            <Pill tone="sea" className="hidden lg:inline-flex">
              <Users className="h-3 w-3" /> {totalOnline} sailing
            </Pill>
            {/* Feature buttons: icon only on mobile, label on larger screens */}
            <button
              onClick={openChronicle}
              className="pm-pressable pm-grad-indigo rounded-full h-7 w-7 sm:px-2.5 sm:w-auto flex items-center justify-center gap-1 text-[11px] font-medium text-white"
              title="Voyage Chronicles"
              aria-label="Voyage Chronicles"
            >
              <BookOpen className="h-3 w-3" />
              <span className="hidden sm:inline">Chronicles</span>
            </button>
            <button
              onClick={openHouse}
              className="pm-pressable pm-grad-gold rounded-full h-7 w-7 sm:px-2.5 sm:w-auto flex items-center justify-center gap-1 text-[11px] font-medium text-amber-950"
              title="Great Houses"
              aria-label="Great Houses"
            >
              <Landmark className="h-3 w-3" />
              <span className="hidden sm:inline">Houses</span>
            </button>
            <div className="hidden md:block">
              <AgeBanner variant="pill" />
            </div>
            <button
              onClick={() => setCheckInOpen(true)}
              className="pm-pressable relative rounded-full h-7 px-2 flex items-center gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[11px] font-medium"
              title="Daily Check In"
              aria-label="Daily Check In"
            >
              <Gift className="h-3 w-3" />
              <span className="hidden sm:inline">Check In</span>
              {checkIn.canClaimToday && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-background" />
              )}
            </button>
            <button
              onClick={() => setLegacyOpen(true)}
              className="pm-pressable rounded-full h-7 px-2 flex items-center gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[11px] font-medium"
              title="Captain Legacy"
              aria-label="View captain legacy"
            >
              <Star className="h-3 w-3" />
              <span className="hidden sm:inline">Renown </span>
              {renownProgress(legacy.renownXP).level}
            </button>
            {/* Utility buttons: icon only on all screens */}
            <button
              onClick={() => setLeaderboardOpen(true)}
              className="pm-pressable rounded-full h-7 w-7 flex items-center justify-center bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
              title="Harbor Leaderboard"
              aria-label="Open harbor leaderboard"
            >
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
            </button>
            <HarborActivityFeed />
            <button
              onClick={() => setSettingsOpen(true)}
              className="pm-pressable rounded-full h-7 w-7 flex items-center justify-center bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
              title="Settings"
              aria-label="Open settings"
            >
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-1.5 pl-1.5 sm:pl-2 sm:gap-2 border-l border-black/5 dark:border-white/10">
              <button
                onClick={() => setProfileOpen(true)}
                className="pm-pressable flex items-center gap-1.5 sm:gap-2 rounded-full p-0.5 sm:pr-2 hover:bg-black/5 dark:hover:bg-white/10"
                title="View captain profile"
                aria-label="View captain profile"
              >
                <Avatar
                  hue={me.avatarHue}
                  name={me.displayName}
                  size={28}
                  sm={32}
                  ring
                />
                <div className="hidden md:block leading-tight text-left min-w-0">
                  <div className="text-xs sm:text-sm font-medium pm-truncate">
                    {me.displayName}
                  </div>
                  <div className="text-[10px] text-muted-foreground pm-truncate">
                    @{me.username}
                  </div>
                </div>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={onLogout}
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Quick stats banner */}
      <div className="px-4 sm:px-6 max-w-7xl mx-auto mt-2">
        <div className="pm-glass rounded-2xl px-4 py-2.5 flex items-center gap-4 flex-wrap text-[11px]">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-teal-500" />
            <span className="text-muted-foreground">Captains</span>
            <b className="text-foreground tabular-nums">{totalOnline}</b>
          </span>
          <span className="flex items-center gap-1.5">
            <Ship className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-muted-foreground">Open Harbors</span>
            <b className="text-foreground tabular-nums">{rooms.length}</b>
          </span>
          <span className="flex items-center gap-1.5">
            <Anchor className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-muted-foreground">Sailing</span>
            <b className="text-foreground tabular-nums">
              {rooms.filter((r) => r.started).length}
            </b>
          </span>
          <span className="flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-violet-500" />
            <span className="text-muted-foreground">Your Renown</span>
            <b className="text-foreground tabular-nums">
              Lv {renownProgress(legacy.renownXP).level}
            </b>
          </span>
          {checkIn.canClaimToday && (
            <span className="flex items-center gap-1.5 ml-auto">
              <span className="inline-block h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-rose-600 dark:text-rose-400 font-medium">
                Check In available
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <main className="px-4 sm:px-6 pb-10 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 mt-2">
          {/* Rooms */}
          <section className="space-y-4">
            <div className="pm-glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2 font-display">
                    <Ship className="h-5 w-5 text-teal-600 dark:text-teal-400" />{" "}
                    Open Harbors
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Create a room or join one to set sail together.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full pm-grad-indigo text-white hover:opacity-90"
                  onClick={() => setHowToPlayOpen(true)}
                  title="How to Play"
                >
                  <BookOpen className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">How to Play</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  onClick={refreshRooms}
                  disabled={loadingRooms}
                >
                  <RefreshCw
                    className={cn("h-4 w-4", loadingRooms && "animate-spin")}
                  />
                </Button>
              </div>

              {/* [MANIFEST: Quick Start Match] One tap joins the queue and
                  routes the captain into the first available room. Sits
                  above the create form as a distinct alternative to
                  charting a harbor yourself. */}
              <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3.5 mb-3.5 flex items-center gap-3">
                <div className="pm-grad-gold h-10 w-10 rounded-lg flex items-center justify-center shrink-0">
                  <Zap className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium font-display">
                    Quick Start
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    Match instantly with the next captain who hits Quick Start.
                  </p>
                </div>
                <Button
                  onClick={handleQuickStart}
                  disabled={quickStarting || busy}
                  className="h-10 pm-grad-gold rounded-lg font-semibold"
                >
                  {quickStarting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" /> Waiting
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-1" /> Quick Start
                    </>
                  )}
                </Button>
              </div>

              {/* Create */}
              <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3.5 mb-3.5">
                <div className="flex items-center gap-2 mb-2.5">
                  <Plus className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  <span className="text-sm font-medium">
                    Chart a new harbor
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Room name
                    </Label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Silk Run · Voyage 1"
                      maxLength={40}
                      className="h-10"
                      onKeyDown={(e) => e.key === "Enter" && createRoom()}
                    />
                  </div>
                  <div className="flex items-center gap-2 h-10 px-3 rounded-lg bg-background/60">
                    <Switch
                      checked={isPublic}
                      onCheckedChange={setIsPublic}
                      id="pub"
                    />
                    <Label htmlFor="pub" className="text-xs cursor-pointer">
                      Public
                    </Label>
                  </div>
                  <Button
                    onClick={createRoom}
                    disabled={busy || !newName.trim()}
                    className="h-10 pm-grad-primary text-white rounded-lg"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-1" /> Create
                      </>
                    )}
                  </Button>
                </div>

                <div className="mt-3">
                  <Label className="text-xs text-muted-foreground">
                    Waters
                  </Label>
                  <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-full bg-background/60 p-1">
                    {DIFFICULTY_ORDER.map((key) => {
                      const cfg = DIFFICULTIES[key];
                      const active = difficulty === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setDifficulty(key)}
                          aria-pressed={active}
                          className="relative cursor-pointer rounded-full px-2 py-1.5 text-xs font-medium"
                        >
                          {active && (
                            <motion.span
                              layoutId="difficultyThumb"
                              className="pm-grad-primary absolute inset-0 rounded-full"
                              transition={{
                                type: "spring",
                                stiffness: 380,
                                damping: 32,
                              }}
                            />
                          )}
                          <span
                            className={cn(
                              "relative z-10 flex items-center justify-center gap-1.5",
                              active ? "text-white" : "text-muted-foreground",
                            )}
                          >
                            <span>{cfg.icon}</span>
                            <span className="truncate">{cfg.badge}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    {DIFFICULTIES[difficulty].tagline}{" "}
                    <span className="text-foreground/70">
                      {DIFFICULTIES[difficulty].rounds} rounds.
                    </span>
                  </p>
                  {/* Difficulty Advisor */}
                  <DifficultyAdvisor
                    selectedDifficulty={difficulty}
                    renownLevel={renownProgress(legacy.renownXP).level}
                    voyagesCompleted={legacy.voyagesCompleted}
                    bestScore={legacy.bestScore}
                    solventStreak={legacy.consecutiveSolventVoyages}
                  />
                </div>
              </div>

              {/* Join by code */}
              <div className="flex items-end gap-2 mb-4">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Join by code
                  </Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={joinCode}
                      onChange={(e) =>
                        setJoinCode(e.target.value.toUpperCase().slice(0, 6))
                      }
                      placeholder="ABCDEF"
                      className="h-10 pl-9 tracking-[0.3em] font-mono uppercase"
                      onKeyDown={(e) => e.key === "Enter" && joinByCode()}
                    />
                  </div>
                </div>
                <Button
                  onClick={joinByCode}
                  disabled={busy || joinCode.trim().length !== 6}
                  variant="secondary"
                  className="h-10 rounded-lg"
                >
                  Join
                </Button>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-300 text-xs px-3 py-2 mb-3"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Room list */}
              <div className="space-y-2">
                {loadingRooms && rooms.length === 0 ? (
                  <div className="py-10 flex items-center justify-center text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Scanning
                    the horizon…
                  </div>
                ) : rooms.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    No harbors open yet. Be the first to chart one above.
                  </div>
                ) : (
                  rooms.map((room) => {
                    const isMember = room.members.some((m) => m.id === me.id);
                    const locked = room.started && !isMember;
                    return (
                      <motion.div
                        key={room.id}
                        layout
                        className="group pm-glass rounded-xl p-3.5 flex items-center gap-3 hover:shadow-md transition-shadow"
                      >
                        <div className="pm-grad-primary h-10 w-10 rounded-lg flex items-center justify-center shrink-0">
                          <Ship className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          {/* Wraps rather than overflows. On a narrow
                              phone this column is about 165px wide, and
                              the difficulty, Host and Sailing pills
                              together need roughly 280px. Without the
                              wrap the row spilled out of the column and
                              the pills landed on top of the Enter
                              button beside it. */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium truncate">
                              {normalizeRoomName(room.name)}
                            </span>
                            <Pill tone="sea">
                              {difficultyConfig(room.difficulty).icon}{" "}
                              {difficultyConfig(room.difficulty).badge}
                            </Pill>
                            {room.host.id === me.id && (
                              <Pill tone="gold">Host</Pill>
                            )}
                            {!room.isPublic && (
                              <Pill tone="amber">Private</Pill>
                            )}
                            {room.started && <Pill tone="sea">⛵ Sailing</Pill>}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                            <span>Hosted by {room.host.displayName}</span>
                            <span>·</span>
                            <span className="font-mono">{room.code}</span>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" /> {room.memberCount}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => enterRoom(room)}
                          disabled={joining === room.id || locked}
                          title={
                            locked
                              ? "This voyage has already set sail"
                              : undefined
                          }
                          className="rounded-lg pm-grad-primary text-white"
                        >
                          {joining === room.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : locked ? (
                            "Locked"
                          ) : (
                            <>
                              Enter <ArrowRight className="h-4 w-4 ml-1" />
                            </>
                          )}
                        </Button>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          {/* Online + DMs */}
          <aside className="space-y-4">
            <div className="pm-glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2 font-display">
                  <Users className="h-4 w-4 text-teal-600 dark:text-teal-400" />{" "}
                  Captains Online
                </h3>
                <Pill tone="jade">
                  <OnlineDot online size={8} /> {totalOnline}
                </Pill>
              </div>
              <ScrollArea className="h-56 pr-2">
                {onlineUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">
                    {connected
                      ? "No other captains online yet."
                      : "Connecting to the harbor…"}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {onlineUsers.map((u) => {
                      const isMe = u.id === me.id;
                      const otherLegacy = otherLegacies[u.id];
                      return (
                        <button
                          key={u.id}
                          onClick={() => !isMe && openDm(u)}
                          disabled={isMe}
                          className={cn(
                            "w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors",
                            isMe
                              ? "opacity-60 cursor-default"
                              : "hover:bg-black/5 dark:hover:bg-white/5",
                          )}
                        >
                          <div className="relative">
                            <Avatar
                              hue={u.avatarHue}
                              name={u.displayName}
                              size={30}
                            />
                            <OnlineDot
                              online
                              size={8}
                              className="absolute -bottom-0.5 -right-0.5 ring-2 ring-background"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {u.displayName}{" "}
                              {isMe && (
                                <span className="text-[10px] text-muted-foreground">
                                  (you)
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {u.roomId ? "In a harbor" : "In the lobby"}
                            </div>
                          </div>
                          {otherLegacy && (
                            <Pill tone="gold" className="shrink-0">
                              <Star className="h-3 w-3" />{" "}
                              {renownProgress(otherLegacy.renownXP).level}
                            </Pill>
                          )}
                          {!isMe && (
                            <MessageCircle className="h-4 w-4 text-muted-foreground/60" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* DM panel */}
            <div
              className="pm-glass rounded-2xl overflow-hidden flex flex-col"
              style={{ height: 360 }}
            >
              <div className="px-4 py-3 border-b border-black/5 dark:border-white/10 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-medium">
                  {dmTarget
                    ? `Direct · ${dmTarget.displayName}`
                    : "Direct Messages"}
                </span>
              </div>
              {dmTarget ? (
                dmLoading ? (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
                  </div>
                ) : (
                  <ChatPanel
                    socket={socket}
                    me={me}
                    mode="dm"
                    other={dmTarget}
                    initialMessages={dmHistory}
                  />
                )
              ) : (
                <div className="flex-1 flex items-center justify-center text-center px-6">
                  <p className="text-xs text-muted-foreground/80 leading-relaxed">
                    Pick a captain from the list above to start a private
                    conversation.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      <Dialog open={legacyOpen} onOpenChange={setLegacyOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Star className="h-5 w-5 text-amber-500" />
              Captain's Legacy
            </DialogTitle>
            <DialogDescription>
              Renown carries across every voyage this account ever sails, in any
              harbor.
            </DialogDescription>
          </DialogHeader>
          <CaptainLegacyCard legacy={legacy} className="p-5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Every Renown level grants a small Gold bonus at the start of your
            next fresh voyage. It grows from the Reputation you bank on the way
            to Round 8, so it only ever goes up, even on a voyage that ends in
            bankruptcy.
          </p>
        </DialogContent>
      </Dialog>

      <Dialog open={checkInOpen} onOpenChange={setCheckInOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Gift className="h-5 w-5 text-violet-500" />
              Daily Check In
            </DialogTitle>
            <DialogDescription>
              Claim a Renown reward each day. The 7 day cycle picks up where you
              left off, even after a missed day, and restarts once Day 7 is
              claimed.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
            {checkIn.rewards.map((xp, i) => {
              const day = i + 1;
              const claimed = day <= checkIn.claimedThisCycle;
              const isCurrent = day === checkIn.currentDay;
              return (
                <div
                  key={day}
                  className={cn(
                    "rounded-lg border px-1 py-2 text-center",
                    claimed
                      ? "border-emerald-500/40 bg-emerald-500/[0.07] opacity-70"
                      : isCurrent
                        ? "border-violet-500/50 bg-violet-500/[0.09]"
                        : "border-black/10 dark:border-white/10 bg-background/40",
                  )}
                >
                  <div className="text-[10px] text-muted-foreground">
                    Day {day}
                  </div>
                  <div className="text-sm font-bold leading-tight">+{xp}</div>
                  <div className="text-[9px] text-muted-foreground">
                    {claimed ? "✓ XP" : "XP"}
                  </div>
                </div>
              );
            })}
          </div>
          <Button
            className="pm-grad-violet text-white font-semibold rounded-lg w-full hover:opacity-95"
            disabled={!checkIn.canClaimToday || claiming}
            onClick={claimCheckIn}
          >
            {claiming
              ? "Claiming…"
              : checkIn.canClaimToday
                ? `Claim Day ${checkIn.currentDay}: +${checkIn.rewards[checkIn.currentDay - 1]} Renown XP`
                : "Checked in today · back tomorrow"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* [MANIFEST: Voyage Chronicle] Lists the captain's past chronicles,
          newest first, with headline, body, and creation date. */}
      <Dialog open={chronicleOpen} onOpenChange={setChronicleOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <BookOpen className="h-5 w-5 text-indigo-500" />
              Voyage Chronicles
            </DialogTitle>
            <DialogDescription>
              The harbour master's ledger of your finished voyages, newest
              first.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="pm-scroll-capped max-h-[60vh] pr-2">
            {chronicleLoading ? (
              <div className="py-8 flex items-center justify-center text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading
                chronicles…
              </div>
            ) : chronicles.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No chronicles yet. Finish a voyage and your headline will be
                inscribed here.
              </p>
            ) : (
              <ol className="space-y-3">
                {chronicles.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-lg border border-black/10 dark:border-white/10 bg-background/40 p-3"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-semibold font-display">
                        {c.headline}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDate(c.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                      {c.body}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* [MANIFEST: Great Houses] Pick or switch your House allegiance.
          House definitions come from @/lib/game/engine (re-exported from
          engine/houses); standings and the current pledge come from
          /api/houses/standings; pledging writes through /api/house. */}
      <Dialog open={houseOpen} onOpenChange={setHouseOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto pm-scroll">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Landmark className="h-5 w-5 text-amber-500" />
              Great Houses
            </DialogTitle>
            <DialogDescription>
              Pledge to one House. Its perk applies on your next fresh voyage.
              Switch any time between voyages.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {houseLoading ? (
              <div className="py-8 flex items-center justify-center text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading
                standings…
              </div>
            ) : (
              HOUSES.map((house: House) => {
                const standing = houseStandings.find(
                  (s) => s.houseId === house.id,
                );
                const isMine = myHouseId === house.id;
                return (
                  <div
                    key={house.id}
                    className={cn(
                      "rounded-xl border p-3 flex items-start gap-3",
                      isMine
                        ? "border-amber-500/50 bg-amber-500/[0.07]"
                        : "border-black/10 dark:border-white/10 bg-background/40",
                    )}
                  >
                    <div className="pm-grad-gold h-10 w-10 rounded-lg flex items-center justify-center shrink-0 text-lg">
                      <span aria-hidden>{house.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold font-display">
                          {house.name}
                        </span>
                        {isMine && <Pill tone="gold">Pledged</Pill>}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                        {house.perk}
                      </p>
                      {standing && (
                        <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-1">
                          <span>👑 {standing.crowns}</span>
                          <span>·</span>
                          <span>⛵ {standing.voyages}</span>
                          <span>·</span>
                          <span>★ {standing.bestScore}</span>
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      disabled={isMine || pledgingHouse !== null}
                      onClick={() => pledge(house.id)}
                      className="rounded-lg pm-grad-gold font-semibold shrink-0"
                    >
                      {pledgingHouse === house.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isMine ? (
                        "Pledged"
                      ) : (
                        "Pledge"
                      )}
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          {/* Harbor-wide leaderboard */}
          {!houseLoading && houseStandings.length > 0 && (
            <div className="mt-4 border-t border-border/30 pt-4">
              <HouseLeaderboard
                standings={houseStandings}
                myHouseId={myHouseId}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CaptainProfileModal
        open={profileOpen}
        onOpenChange={setProfileOpen}
        me={me}
      />
      <HowToPlayModal open={howToPlayOpen} onOpenChange={setHowToPlayOpen} />
      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        soundEnabled={soundOn}
        onToggleSound={toggleSound}
        colorblindSafe={colorblindSafe}
        onToggleColorblind={() => setColorblindSafe(!colorblindSafe)}
        volume={soundVolume}
        onVolumeChange={setSoundVolume}
      />
      <LeaderboardModal
        open={leaderboardOpen}
        onOpenChange={setLeaderboardOpen}
        myUserId={me.id}
      />
    </div>
  );
}
