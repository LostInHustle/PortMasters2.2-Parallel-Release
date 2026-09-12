"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
import { HOUSE_CREST, HOUSE_FALLBACK } from "./house-colours";
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
  type LucideIcon,
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

// =====================================================================
// The two shapes every card in the Lobby is built from.
//
// They exist because each heading and each figure here used to be grown by
// hand, and no two of them agreed. One card led with its icon at five and
// the next at four, one figure was bold and its neighbour was not, and a
// heading nudged to fit its own card drifted out of line the moment the
// text beside it changed length. A heading written once cannot drift away
// from itself.
// =====================================================================

// A card's head: one icon, one title, one line of explanation under it, and
// whatever controls belong to that card on the right. The icon takes its
// colour from the call site, because colour is how a card says which part
// of the harbor it is.
function CardHead({
  icon: Icon,
  tone,
  title,
  hint,
  children,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone)} />
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold leading-tight">
            {title}
          </h2>
          {hint && (
            <p className="text-[11px] leading-snug text-muted-foreground">
              {hint}
            </p>
          )}
        </div>
      </div>
      {children && (
        <div className="flex shrink-0 items-center gap-1.5">{children}</div>
      )}
    </div>
  );
}

// One cell of the masthead's gauge row. Three of these sit side by side under
// a hairline, so the shape lives here rather than three times over in the
// markup: one icon at one size, one quiet label, one tabular figure. A call
// site picks the icon and its colour and nothing else.
function Gauge({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: LucideIcon;
  tone: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <Icon className={cn("h-3.5 w-3.5", tone)} />
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <b className="text-[11px] tabular-nums">{value}</b>
    </span>
  );
}

// The hairline the gauge row divides itself with.
function GaugeRule() {
  return <span className="h-4 w-px shrink-0 bg-black/10 dark:bg-white/15" />;
}

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
      {/* ===============================================================
          The masthead.

          This used to be two stacked bars, one of tools and one of
          numbers, and between them they stated the harbor's population and
          this captain's Renown twice. Every tool had also picked its own
          height, its own corners and its own tint, so eight controls doing
          the same kind of job read as eight unrelated widgets that merely
          happened to share a line.

          It is one card now, answering one question in two rows: what can
          I reach from here, and what is the harbor doing. The tools sit on
          a single shelf, all of them the same height and the same shape,
          quiet by default, with colour spent on the one thing actually
          waiting for the captain. The harbor's numbers sit under a hairline
          as a gauge row, and the figure that also opens a panel is the
          control that opens it, so nothing has to be printed twice.
         =============================================================== */}
      <header className="sticky top-0 z-30 px-4 pb-2 pt-3 sm:px-6">
        {/* A scrim, so the board fades out as it slides under the masthead
            rather than showing through the strip above it. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background via-background/85 to-transparent" />
        <div className="pm-glass pm-panel-bar relative mx-auto max-w-7xl">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="pm-seal pm-grad-brand">
              <Anchor className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              {/* The name, then a tagline. The name used to be followed on
                  the same line by a trailing word and a subtitle that was
                  itself an older title, so the header read as three
                  different names stacked on top of one another. */}
              <h1 className="font-display text-sm font-bold leading-tight tracking-tight">
                <span className="text-brand pm-truncate">{APP_NAME}</span>
              </h1>
              <p className="pm-truncate text-[11px] leading-tight text-muted-foreground">
                Maritime trade on the ancient Silk Road
              </p>
            </div>

            {/* The shelf. One height, one shape, one quiet skin for every
                tool on it. The tints this replaces were nine different
                colours across one bar, which is a lot of signal for a row
                of things that all do the same kind of job; colour is kept
                for Check In, the only tool that is ever waiting. */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={openChronicle}
                className="pm-tool pm-pressable bg-black/[0.05] text-foreground dark:bg-white/10"
                title="Voyage Chronicles"
                aria-label="Voyage Chronicles"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">Chronicles</span>
              </button>
              <button
                onClick={openHouse}
                className="pm-tool pm-pressable bg-black/[0.05] text-foreground dark:bg-white/10"
                title="Great Houses"
                aria-label="Great Houses"
              >
                <Landmark className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">Houses</span>
              </button>
              <button
                onClick={() => setLeaderboardOpen(true)}
                className="pm-tool pm-tool-icon pm-pressable bg-black/[0.05] text-foreground dark:bg-white/10"
                title="Harbor Leaderboard"
                aria-label="Open harbor leaderboard"
              >
                <Trophy className="h-3.5 w-3.5" />
              </button>
              <HarborActivityFeed />
              <button
                onClick={() => setSettingsOpen(true)}
                className="pm-tool pm-tool-icon pm-pressable bg-black/[0.05] text-foreground dark:bg-white/10"
                title="Settings"
                aria-label="Open settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setCheckInOpen(true)}
                className={cn(
                  "pm-tool pm-pressable relative",
                  checkIn.canClaimToday
                    ? "pm-grad-checkin text-white"
                    : "bg-black/[0.05] text-foreground dark:bg-white/10",
                )}
                title="Daily Check In"
                aria-label="Daily Check In"
              >
                <Gift className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">Check In</span>
                {checkIn.canClaimToday && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-alarm ring-2 ring-background" />
                )}
              </button>
            </div>

            <div className="h-6 w-px shrink-0 bg-black/10 dark:bg-white/15" />

            <button
              onClick={() => setProfileOpen(true)}
              className="pm-tool pm-pressable gap-1.5 bg-black/[0.05] pl-0.5 pr-2.5 dark:bg-white/10"
              title="View captain profile"
              aria-label="View captain profile"
            >
              <Avatar hue={me.avatarHue} name={me.displayName} size={24} ring />
              <span className="hidden max-w-32 truncate md:inline">
                {me.displayName}
              </span>
            </button>
            <button
              onClick={onLogout}
              className="pm-tool pm-tool-icon pm-pressable bg-black/[0.05] text-muted-foreground dark:bg-white/10"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* The gauge row. Four facts about the harbor, each with the same
              icon size, the same quiet label and the same tabular figure,
              divided by hairlines rather than scattered, so they read as
              one instrument instead of four loose labels. Your Renown is a
              button because the panel behind it is the rest of the story;
              it used to be a tool on the shelf as well, which meant the
              same number sat in two places on the same screen. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-black/[0.06] pt-2.5 dark:border-white/[0.08]">
            <Gauge
              icon={Users}
              tone="text-captains"
              label="Captains"
              value={totalOnline}
            />
            <GaugeRule />
            <Gauge
              icon={Ship}
              tone="text-harbors"
              label="Open Harbors"
              value={rooms.length}
            />
            <GaugeRule />
            <Gauge
              icon={Anchor}
              tone="text-sailing"
              label="Sailing"
              value={rooms.filter((r) => r.started).length}
            />
            <GaugeRule />
            <button
              onClick={() => setLegacyOpen(true)}
              className="-mx-1.5 flex items-center gap-1.5 rounded-full px-1.5 py-0.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
              title="Captain Legacy"
              aria-label="View captain legacy"
            >
              <Star className="h-3.5 w-3.5 text-renown" />
              <span className="text-[11px] text-muted-foreground">
                Your Renown
              </span>
              <b className="text-[11px] tabular-nums">
                Lv {renownProgress(legacy.renownXP).level}
              </b>
            </button>

            <div className="ml-auto flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <OnlineDot online={connected && authed} size={8} />
                <span className="text-[11px] text-muted-foreground">
                  {connected && authed ? "Online" : "Connecting"}
                </span>
              </span>
              <div className="hidden md:block">
                <AgeBanner variant="pill" className="pm-tool" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-3 px-4 pb-10 pt-3 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="space-y-3">
          {/* [MANIFEST: Quick Start Match] One tap joins the queue and
              routes the captain into the first available room. Sits above
              the create form as a distinct alternative to charting a harbor
              yourself. */}
          <div className="pm-glass pm-tile flex items-center gap-3">
            <div className="pm-seal pm-grad-quickstart">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-sm font-medium">
                Quick Start
              </div>
              <p className="text-[11px] leading-tight text-muted-foreground">
                Match instantly with the next captain who hits Quick Start.
              </p>
            </div>
            {/* The vermilion seal, the same colour the harbor uses for a
                thing that must not be missed. Quick Start used to wear the
                Houses gold, which left two unrelated controls in the same
                skin. */}
            <Button
              onClick={handleQuickStart}
              disabled={quickStarting || busy}
              className="pm-grad-quickstart h-10 shrink-0 rounded-xl font-semibold text-white"
            >
              {quickStarting ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Waiting
                </>
              ) : (
                <>
                  <Zap className="mr-1 h-4 w-4" /> Quick Start
                </>
              )}
            </Button>
          </div>

          {/* Charting a harbor and joining one by code are the two ways to
              name the room you want, so they share a card and a hairline
              rather than floating as two unrelated blocks. */}
          <div className="pm-glass pm-panel">
            <CardHead
              icon={Plus}
              tone="text-charter"
              title="Chart a new harbor"
              hint="Name a room, pick its waters, and open it to the fleet."
            />
            <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto_auto]">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Room name
                </Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Silk Run · Voyage 1"
                  maxLength={40}
                  className="pm-field"
                  onKeyDown={(e) => e.key === "Enter" && createRoom()}
                />
              </div>
              <div className="pm-field flex items-center gap-2 bg-background/60 px-3">
                <Switch
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                  id="pub"
                />
                <Label htmlFor="pub" className="cursor-pointer text-xs">
                  Public
                </Label>
              </div>
              <Button
                onClick={createRoom}
                disabled={busy || !newName.trim()}
                className="pm-grad-charter pm-field text-white"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="mr-1 h-4 w-4" /> Create
                  </>
                )}
              </Button>
            </div>

            <div className="mt-3">
              <Label className="text-xs text-muted-foreground">Waters</Label>
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
                          className="pm-grad-charter absolute inset-0 rounded-full"
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
                <span className="text-foreground">
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

            <div className="mt-4 flex items-end gap-2 border-t border-black/[0.06] pt-4 dark:border-white/[0.08]">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Join by code
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={joinCode}
                    onChange={(e) =>
                      setJoinCode(e.target.value.toUpperCase().slice(0, 6))
                    }
                    placeholder="ABCDEF"
                    className="pm-field pl-9 font-mono uppercase tracking-[0.3em]"
                    onKeyDown={(e) => e.key === "Enter" && joinByCode()}
                  />
                </div>
              </div>
              <Button
                onClick={joinByCode}
                disabled={busy || joinCode.trim().length !== 6}
                variant="secondary"
                className="pm-field"
              >
                Join
              </Button>
            </div>
          </div>

          {/* The board of harbors already open. */}
          <div className="pm-glass pm-panel">
            <CardHead
              icon={Ship}
              tone="text-harbors"
              title="Open Harbors"
              hint="Create a room or join one to set sail together."
            >
              {/* How to Play is a plain button rather than the Button
                  primitive. It was dressed as a ghost, a variant that
                  exists to be transparent, and then painted over with a
                  solid gradient, so the variant contributed nothing but a
                  hover tint that could not be seen through the paint. It
                  is a tool now, the same as everything else on a shelf. */}
              <button
                onClick={() => setHowToPlayOpen(true)}
                className="pm-tool pm-pressable pm-grad-guide text-white"
                title="How to Play"
                aria-label="How to Play"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">How to Play</span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="pm-tool pm-tool-icon rounded-full"
                onClick={refreshRooms}
                disabled={loadingRooms}
                title="Refresh harbors"
                aria-label="Refresh the harbor list"
              >
                <RefreshCw
                  className={cn("h-4 w-4", loadingRooms && "animate-spin")}
                />
              </Button>
            </CardHead>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-3 rounded-xl bg-alarm/5 px-3 py-2 text-xs text-alarm"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              {loadingRooms && rooms.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scanning the
                  horizon…
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
                      className="pm-row pm-glass"
                    >
                      <div className="pm-seal pm-grad-harbors">
                        <Ship className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {/* Wraps rather than overflows. On a narrow phone
                            this column is about 165px wide, and the
                            difficulty, Host and Sailing pills together
                            need roughly 280px. Without the wrap the row
                            spilled out of the column and the pills landed
                            on top of the Enter button beside it. */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium">
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
                            <Pill tone="default">Private</Pill>
                          )}
                          {room.started && (
                            <Pill
                              tone="none"
                              className="bg-sailing/5 text-sailing"
                            >
                              ⛵ Sailing
                            </Pill>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
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
                        className="pm-grad-harbors h-10 shrink-0 rounded-xl text-white"
                      >
                        {joining === room.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : locked ? (
                          "Locked"
                        ) : (
                          <>
                            Enter <ArrowRight className="ml-1 h-4 w-4" />
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

        {/* The rail: who is about, and the conversation with whoever the
            captain picked from that list. */}
        <aside className="space-y-3">
          <div className="pm-glass pm-panel">
            <CardHead icon={Users} tone="text-captains" title="Captains Online">
              <Pill tone="gain">
                <OnlineDot online size={8} /> {totalOnline}
              </Pill>
            </CardHead>
            <ScrollArea className="h-56 pr-2">
              {onlineUsers.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  {connected
                    ? "No other captains online yet."
                    : "Connecting to the harbor…"}
                </p>
              ) : (
                <div className="space-y-1">
                  {onlineUsers.map((u) => {
                    const isMe = u.id === me.id;
                    const otherLegacy = otherLegacies[u.id];
                    return (
                      <button
                        key={u.id}
                        onClick={() => !isMe && openDm(u)}
                        disabled={isMe}
                        className={cn(
                          "pm-row w-full text-left",
                          isMe ? "cursor-default opacity-60" : "cursor-pointer",
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
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {u.displayName}{" "}
                            {isMe && (
                              <span className="text-[10px] text-muted-foreground">
                                (you)
                              </span>
                            )}
                          </div>
                          <div className="truncate text-[10px] text-muted-foreground">
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
                          <MessageCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* The chat draws its own header and its own scroller, so it takes
              the panel's corners without its padding. */}
          <div className="pm-glass pm-panel-flush flex h-[22.5rem] flex-col">
            <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3 dark:border-white/10">
              <MessageCircle className="h-4 w-4 text-messages" />
              <span className="text-sm font-medium">
                {dmTarget
                  ? `Direct · ${dmTarget.displayName}`
                  : "Direct Messages"}
              </span>
            </div>
            {dmTarget ? (
              dmLoading ? (
                <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
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
              <div className="flex flex-1 items-center justify-center px-6 text-center">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Pick a captain from the list above to start a private
                  conversation.
                </p>
              </div>
            )}
          </div>
        </aside>
      </main>

      <Dialog open={legacyOpen} onOpenChange={setLegacyOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Star className="h-5 w-5 text-legacy" />
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
              <Gift className="h-5 w-5 text-checkin" />
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
                      ? "border-gain/40 bg-gain/[0.07] opacity-70"
                      : isCurrent
                        ? "border-checkin/50 bg-checkin/[0.09]"
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
            className="pm-grad-checkin font-semibold rounded-lg w-full"
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
              <BookOpen className="h-5 w-5 text-chronicles" />
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
          House definitions come from @/lib/game/engine (forwarded from
          engine/houses); standings and the current pledge come from
          /api/houses/standings; pledging writes through /api/house. */}
      <Dialog open={houseOpen} onOpenChange={setHouseOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto pm-scroll">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Landmark className="h-5 w-5 text-houses" />
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
                        ? "border-houses/50 bg-houses/[0.07]"
                        : "border-black/10 dark:border-white/10 bg-background/40",
                    )}
                  >
                    <div
                      className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 text-lg",
                        HOUSE_CREST[house.id] ?? HOUSE_FALLBACK,
                      )}
                    >
                      <span aria-hidden>{house.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold font-display">
                          {house.name}
                        </span>
                        {isMine && (
                          <Pill tone="none" className="bg-houses/5 text-houses">
                            Pledged
                          </Pill>
                        )}
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
                      className="rounded-lg pm-grad-houses font-semibold shrink-0"
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

          {/* Harbor wide leaderboard */}
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
