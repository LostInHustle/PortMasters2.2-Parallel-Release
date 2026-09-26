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
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  difficultyConfig,
  type Difficulty,
} from "@/lib/game/difficulty";
import {
  MODES,
  MODE_ORDER,
  DEFAULT_MODE,
  modeConfig,
  type GameMode,
} from "@/lib/game/mode";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Info,
  X,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate, normalizeRoomName } from "@/lib/utils";
import { roomLockedFor } from "@/lib/rooms";
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
// The shapes the Lobby's headings and figures are built from.
//
// They exist because each heading and each figure here used to be grown by
// hand, and no two of them agreed. One card led with its icon at five and
// the next at four, one figure was bold and its neighbour was not, and a
// heading nudged to fit its own card drifted out of line the moment the
// text beside it changed length. A heading written once cannot drift away
// from itself.
// =====================================================================

// A card's head: one icon, one title, and whatever controls belong to that
// card on the right. The icon takes its colour from the call site, because
// colour is how a card says which part of the harbor it is.
//
// It had a second line of explanation under the title for as long as two
// cards wanted one. Both of those cards are gone, so the prop went with
// them rather than sit here unread.
function CardHead({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon className={cn("h-4 w-4 shrink-0", tone)} />
        <h2 className="pm-truncate font-display text-sm font-semibold leading-tight">
          {title}
        </h2>
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

// Voyage and Waters are different kinds of question, so they are drawn as two
// different instruments rather than as one dial used twice.
//
// Mode is a choice between two whole voyages that differ in what the phases
// are and what order they run in, so it is drawn as a pair of cards a captain
// reads one at a time. Difficulty is a position on a ladder, because the tiers
// genuinely escalate: more rounds, a wider market, a likelier raid. Drawn as
// one dial each, both became rows of identical pills, which made the larger
// choice look the same size as the smaller one and left two of those rows
// stacked on the form.
//
// Neither control takes pm-pressable. Its hover lift scales a control by 1.04,
// which suits a 2rem tool in the masthead and not a card half a panel wide,
// where the growth would reach past its own gap and onto its neighbour. They
// take the focus ring the Button primitive uses instead.
type VoyageOption<T extends string> = {
  key: T;
  icon: string;
  badge: string;
  tagline: string;
  summary: string;
  experimental: boolean;
};

function VoyageCards<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly VoyageOption<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {/* items-start, because a card should be the size of what it says. The
          grid stretches its cells to the tallest row by default, and the
          experimental card always runs longer than the shipped one, so the
          shipped card was being handed a block of empty space under its own
          text every time. */}
      <div className="mt-1.5 grid gap-2 sm:grid-cols-2 sm:items-start">
        {options.map((option) => {
          const active = value === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(option.key)}
              aria-pressed={active}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                active
                  ? "border-charter/50 bg-charter/[0.07]"
                  : "border-black/10 bg-background/40 hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.04]",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg",
                  active ? "pm-grad-charter" : "bg-black/5 dark:bg-white/10",
                )}
              >
                {option.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "font-display text-sm font-semibold",
                      active && "text-charter",
                    )}
                  >
                    {option.badge}
                  </span>
                  {option.experimental && (
                    <Pill tone="none" className="bg-warn/5 text-warn">
                      Experimental
                    </Pill>
                  )}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                  {option.tagline}
                </span>
                {/* The summary shows on both cards, not only on the one that
                    carries a warning: it is what the voyage asks of a captain,
                    so it belongs to the choice rather than to the caution. */}
                <span className="mt-1 block text-[11px] leading-snug text-muted-foreground/70">
                  {option.summary}
                </span>
                {/* A captain who walks into an unfinished mode without being
                    told has been misled rather than tested, so the warning
                    belongs to the card that offers it rather than to a
                    paragraph under the control that moves when the choice
                    changes. The pill beside the badge names the state; this
                    line is the caution, so it does not name it twice. */}
                {option.experimental && (
                  <span className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-snug text-warn">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>Still being built.</span>
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

// Difficulty is a position rather than a choice between two things, and the
// tiers say so themselves: they run 8, 12 and 16 rounds, and the raid chance
// climbs with them. So Waters is one continuous rail whose fill deepens toward
// the storm end, with a stop per tier.
//
// Every stop carries its own round count. The dial only ever showed that
// number for the tier already selected, which hid the plainest evidence that
// the three are a ladder rather than three unrelated settings.
type WatersStop<T extends string> = {
  key: T;
  icon: string;
  badge: string;
  rounds: number;
};

// Rising fill, one step per tier. Built from bg-sea at stepped opacity rather
// than from a from-sea gradient, because opacity on the sea token is what the
// rest of the tree already leans on and a gradient on it is unproven here. The
// classes stay literal, the same way the old dial kept grid-cols-2 and
// grid-cols-3 literal, so the stylesheet can still see them.
const WATERS_FILL = ["bg-sea/20", "bg-sea/45", "bg-sea/70"] as const;

function WatersScale<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly WatersStop<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {/* No gap between the cells, so the three rail segments meet and read as
          one band. Each cell keeps its own hit area and its own pressed state,
          which is what the three buttons the dial had also carried. */}
      <div className="mt-1.5 grid grid-cols-3">
        {options.map((option, index) => {
          const active = value === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(option.key)}
              aria-pressed={active}
              className="flex flex-col items-center rounded-xl pb-1 pt-2 outline-none transition-colors hover:bg-sea/[0.06] focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span aria-hidden className="text-lg leading-none">
                {option.icon}
              </span>
              <span className="relative mt-2 flex h-4 w-full items-center justify-center">
                <span
                  aria-hidden
                  className={cn("h-1 w-full", WATERS_FILL[index])}
                />
                <span
                  aria-hidden
                  className={cn(
                    "absolute h-3 w-3 rounded-full border-2 transition-colors",
                    active
                      ? "border-sea bg-sea ring-2 ring-sea/25"
                      : "border-sea/40 bg-background",
                  )}
                />
              </span>
              <span
                className={cn(
                  "mt-1.5 font-display text-xs font-semibold",
                  active ? "text-sea" : "text-muted-foreground",
                )}
              >
                {option.badge}
              </span>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {option.rounds} rounds
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

export function Lobby({
  me,
  onEnterRoom,
  onLogout,
  onSessionLost,
  notice,
  onDismissNotice,
}: {
  me: PublicUser;
  onEnterRoom: (room: RoomSummary) => void;
  onLogout: () => void;
  // Handed straight to the realtime hook, which calls it when the server
  // refuses this connection's credentials.
  onSessionLost?: (message: string) => void;
  // Something that happened elsewhere and belongs on this screen: a harbor
  // this captain was sitting in was closed underneath them, say. Owned by
  // the page, which is where the event was heard.
  notice?: string | null;
  onDismissNotice?: () => void;
}) {
  const { socket, connected, authed, onlineUsers } = useRealtime(
    me,
    onSessionLost,
  );
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
  // Which voyage the harbor is playing (see src/lib/game/mode.ts). Fixed at
  // creation for the same reason the tier is: it decides the order every
  // captain's phases run in, so a room that changed it mid voyage would be
  // asking its table to keep two different clocks. Starts on the founding
  // mode, which is the one a captain who never touches this control gets.
  const [mode, setMode] = useState<GameMode>(DEFAULT_MODE);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Which half of the lobby panel is showing. The board and the create form
  // used to be two stacked cards, and the form is the taller of the two by a
  // wide margin, so the room list started a screen and a half down on the
  // one screen whose whole job is showing rooms. A switch gives each of them
  // the panel. Opens on browse, because the list is what a captain arrives
  // wanting to see.
  const [view, setView] = useState<"browse" | "create">("browse");

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

  // Chat state. The rail's chat has two parts, the harbor square that
  // everybody standing in the lobby is in and the private threads, and the
  // square is what a captain lands on because it is the one surface here
  // that speaks to the whole fleet at once.
  const [chatTab, setChatTab] = useState<"lobby" | "dm">("lobby");
  const [lobbyHistory, setLobbyHistory] = useState<ChatMessage[]>([]);
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
    // The live socket off the hook, not a second one fetched from the
    // module. They were the same object, but only the hook's is in any
    // dependency array: this effect listed neither, so a socket that was
    // torn down and rebuilt on a sign out left it listening on a dead
    // connection while the queue effect above moved to the new one.
    if (!socket) return;

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

    socket.on("quickstart:matched", onMatched);
    socket.on("quickstart:error", onQueueError);
    return () => {
      socket.off("quickstart:matched", onMatched);
      socket.off("quickstart:error", onQueueError);
      // Leaving the lobby must not leave a seat behind in the queue, or
      // the next captain to press the button gets paired with somebody who
      // stopped waiting long ago.
      if (queuedForMatch.current) {
        queuedForMatch.current = false;
        socket.emit("quickstart:leave");
      }
    };
  }, [socket, onEnterRoom]);

  async function createRoom() {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { room } = await api.createRoom({
        name: newName.trim(),
        isPublic,
        difficulty,
        mode,
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
    // Picking a captain is a request to talk to that captain, so the rail
    // shows the thread rather than leaving the square up behind it.
    setChatTab("dm");
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

  // There is no effect here watching dmTarget to seed the thread. One sat
  // here, keyed on the target's id, and openDm above is the only thing in
  // the whole file that ever sets a target, so opening a captain fired the
  // same history request twice and the second answer landed on top of the
  // first. The clear, the loading flag and the request now all belong to
  // the one click that changes the target, and the thread is fetched once.

  // The square's backlog, read once on landing. Nothing re seeds it later,
  // and nothing needs to: this channel is written down rather than held in
  // the room's session log, so whatever was said while this captain was at
  // sea is simply part of the backlog they read on their next landing.
  useEffect(() => {
    api
      .getLobbyChat()
      .then(({ messages }) => setLobbyHistory(messages))
      .catch(() => {
        /* leave the square empty; it fills in live */
      });
  }, []);

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
          {/* Wraps so the tool shelf can drop to its own row on a phone. The
              shelf cannot shrink and the title cannot grow past it, so below
              roughly a tablet the shelf used to win the whole row and the
              ship's name drew straight underneath the buttons. */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="pm-seal pm-grad-brand">
              <Anchor className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              {/* The name, then a tagline. The name used to be followed on
                  the same line by a trailing word and a subtitle that was
                  itself an older title, so the header read as three
                  different names stacked on top of one another. */}
              <h1 className="font-display text-sm font-bold leading-tight tracking-tight">
                {/* block, because pm-truncate cannot clip an inline box: the
                    title drew its full width out past its own column instead
                    of ending in an ellipsis. */}
                <span className="text-brand pm-truncate block">{APP_NAME}</span>
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
            <div className="flex basis-full items-center gap-1.5 sm:basis-auto">
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
        {/* News that arrived without this captain asking for it, on the
            screen they landed on afterwards. Neutral rather than alarming:
            nothing is wrong with this account, something simply happened
            out in the harbor. */}
        {notice && (
          <div className="-order-2 pm-glass flex items-start gap-2.5 rounded-2xl px-4 py-3 lg:order-0 lg:col-span-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="flex-1 text-xs leading-relaxed">{notice}</p>
            {onDismissNotice && (
              <button
                onClick={onDismissNotice}
                className="-mr-1 -mt-0.5 shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                title="Dismiss"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        <section className="space-y-3">
          {/* [MANIFEST: Quick Start Match] One tap joins the queue and routes
              the captain into the first available room. It sits above the
              panel rather than down among the room rows, because the rows
              carry the harbor green and this carries the quickstart hue, and
              two saturated gradients a row apart in one column read as a
              clash rather than as two ways in. */}
          {/* One ring of the quickstart hue is the only colour on the tile,
              and it is what gives the column an entry point: rows of equal
              weight leave the eye with nowhere to land, and this is the one a
              captain with no preference should reach for first. It stays a
              pm-tile rather than a pm-panel, because it is a single row
              without a heading and the size scale says so. */}
          <div className="pm-glass pm-tile flex items-center gap-3 ring-1 ring-quickstart/15">
            <div className="pm-seal pm-grad-quickstart">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-sm font-semibold">
                Quick Start
              </div>
              <p className="text-[11px] leading-tight text-muted-foreground">
                Match instantly with the next captain who hits Quick Start.
              </p>
            </div>
            {/* The vermilion seal, the same colour the harbor uses for a thing
                that must not be missed. Quick Start used to wear the Houses
                gold, which left two unrelated controls in the same skin. */}
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

          {/* This column is one panel holding two views rather than three
              stacked cards. Charting a harbor and walking the open ones are
              the two things a captain comes here to do, and they were
              fighting over the same scroll: the create form is the tallest
              thing on the screen by a wide margin, so the board beneath it
              started around a screen and a half down and the room list was
              never in view on the screen whose whole job is showing rooms.
              A switch hands each of them the panel instead. */}
          <div className="pm-glass pm-panel">
            <Tabs
              value={view}
              onValueChange={(next) => setView(next as "browse" | "create")}
              // Manual activation, because this switch carries two whole
              // views rather than a filter. Arrowing across it should let a
              // captain read both labels before committing, not swap the
              // panel out from under them on the way past.
              activationMode="manual"
              className="gap-0"
            >
              {/* The switch is a recessed well with the live view raised
                  inside it, which is the pairing the tool shelf already uses.
                  Colour is spent on the two icons, one per view, in the hue
                  that view already wears below: harbors dresses the board,
                  charter dresses the create form. Both hues are already on
                  this screen and they sit far enough apart on the ladder to
                  be read side by side, so the switch costs the palette
                  nothing. Its height is pm-field's, so it lines up with the
                  buttons and fields underneath it. */}
              <TabsList className="grid h-10 w-full grid-cols-2 bg-black/5 p-1 dark:bg-black/25">
                <TabsTrigger
                  value="browse"
                  className="text-muted-foreground data-[state=active]:text-foreground dark:data-[state=active]:bg-white/10"
                >
                  <Ship className="text-harbors" />
                  Open Harbors
                </TabsTrigger>
                <TabsTrigger
                  value="create"
                  className="text-muted-foreground data-[state=active]:text-foreground dark:data-[state=active]:bg-white/10"
                >
                  <Plus className="text-charter" />
                  Chart a new harbor
                </TabsTrigger>
              </TabsList>

              {/* Whatever went wrong last, whichever view it went wrong in.
                  It sits above both views because a create or a join failure
                  used to print itself inside the board, which is the one
                  place a captain typing a room name is not looking. */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 rounded-xl bg-alarm/5 px-3 py-2 text-xs text-alarm"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <TabsContent
                value="browse"
                forceMount
                className="mt-3 outline-none data-[state=inactive]:hidden"
              >
                {/* Both views stay mounted and the idle one is hidden, rather
                    than Radix emptying it. A captain who dismisses the
                    difficulty advisor and then glances at the board gets the
                    same answer back when they return, because the panel was
                    never taken apart. Each view then animates itself in, so
                    the switch reads as a move rather than a repaint. */}
                <motion.div
                  initial={false}
                  animate={{
                    opacity: view === "browse" ? 1 : 0,
                    y: view === "browse" ? 0 : 6,
                  }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="space-y-3"
                >
                  {/* The board's own controls, on the line that describes the
                      board. */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">
                      Every harbor the fleet has open right now.
                    </p>
                    {/* How to Play is a plain button rather than the Button
                        primitive. It was dressed as a ghost, a variant that
                        exists to be transparent, and then painted over with a
                        solid gradient, so the variant contributed nothing but
                        a hover tint that could not be seen through the paint.
                        It is a tool now, the same as everything else on a
                        shelf. */}
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
                        className={cn(
                          "h-4 w-4",
                          loadingRooms && "animate-spin",
                        )}
                      />
                    </Button>
                  </div>

                  {/* Join by code is the other half of "get into a room I did
                      not make", so it belongs here beside Quick Start rather
                      than at the foot of the create form, which is where it
                      used to sit. One line rather than a labelled stack,
                      because a captain who has a code has exactly one thing
                      to do with it. */}
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="join-code"
                      className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      Join by code
                    </Label>
                    <Input
                      id="join-code"
                      value={joinCode}
                      onChange={(e) =>
                        setJoinCode(e.target.value.toUpperCase().slice(0, 6))
                      }
                      placeholder="ABCDEF"
                      className="pm-field min-w-0 flex-1 font-mono uppercase tracking-[0.3em]"
                      onKeyDown={(e) => e.key === "Enter" && joinByCode()}
                    />
                    <Button
                      onClick={joinByCode}
                      disabled={busy || joinCode.trim().length !== 6}
                      variant="secondary"
                      className="pm-field shrink-0"
                    >
                      Join
                    </Button>
                  </div>
                  {/* The board of harbors already open. A hairline divides it
                      from the two ways in above, so the list reads as its own
                      band rather than as one more control. */}
                  <div className="space-y-2 border-t border-black/[0.06] pt-3 dark:border-white/[0.08]">
                    {/* Three placeholder rows in the shape of a harbor row,
                        rather than a spinner on its own. The board is the one
                        part of the lobby whose contents arrive late, and
                        holding its layout open means nothing jumps when the
                        list lands. The rows are hidden from assistive tech and
                        the sentence they replace is kept, so the wait is
                        announced once instead of three times. */}
                    {loadingRooms && rooms.length === 0 ? (
                      <div>
                        <span className="sr-only">Scanning the horizon</span>
                        <div className="space-y-2" aria-hidden>
                          {[0, 1, 2].map((row) => (
                            <div key={row} className="pm-row pm-glass">
                              <div className="pm-seal animate-pulse bg-black/5 motion-reduce:animate-none dark:bg-white/10" />
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="h-4 w-1/3 animate-pulse rounded bg-black/5 motion-reduce:animate-none dark:bg-white/10" />
                                <div className="h-3 w-1/2 animate-pulse rounded bg-black/5 motion-reduce:animate-none dark:bg-white/10" />
                              </div>
                              <div className="h-10 w-20 shrink-0 animate-pulse rounded-xl bg-black/5 motion-reduce:animate-none dark:bg-white/10" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : rooms.length === 0 ? (
                      /* An empty board is the first thing a captain sees and
                         the likeliest reason to close the tab, so it says what
                         to do next rather than only reporting that there is
                         nothing. Both ways in are named, because either one is
                         a real answer, and both of them live on this side of
                         the switch. */
                      <div className="flex flex-col items-center px-4 py-10 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/5 dark:bg-white/10">
                          <Ship className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="mt-3 font-display text-sm font-semibold">
                          No harbors open yet
                        </p>
                        <p className="mt-1 max-w-[22rem] text-[11px] leading-relaxed text-muted-foreground">
                          Hit Quick Start above to be paired with the next
                          captain looking, or switch to Chart a new harbor and
                          open a room of your own.
                        </p>
                      </div>
                    ) : (
                      rooms.map((room) => {
                        const locked = roomLockedFor(
                          room.started,
                          room.members.map((m) => m.id),
                          me.id,
                        );
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
                              {/* Wraps rather than overflows. On a narrow
                                  phone this column is about 165px wide, and
                                  the difficulty, Host and Sailing pills
                                  together need roughly 280px. Without the
                                  wrap the row spilled out of the column and
                                  the pills landed on top of the Enter button
                                  beside it. */}
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="pm-truncate font-display text-sm font-semibold">
                                  {normalizeRoomName(room.name)}
                                </span>
                                <Pill tone="sea">
                                  {difficultyConfig(room.difficulty).icon}{" "}
                                  {difficultyConfig(room.difficulty).badge}
                                </Pill>
                                {/* Only the exceptions carry a chip. Every
                                    harbor a captain has seen so far is
                                    Classic, so labelling that one would be
                                    noise, and the voyage worth flagging is
                                    the one that plays by a different clock.
                                    Its colour is the meaning token rather
                                    than a widget hue, the same way the
                                    Sailing status below is coloured: this
                                    says what the harbor IS, not which panel
                                    it belongs to. */}
                                {room.mode !== DEFAULT_MODE && (
                                  <Pill
                                    tone="none"
                                    className="bg-warn/5 text-warn"
                                  >
                                    {modeConfig(room.mode).icon}{" "}
                                    {modeConfig(room.mode).badge}
                                  </Pill>
                                )}
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
                                  <Users className="h-3 w-3" />{" "}
                                  {room.memberCount}
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
                </motion.div>
              </TabsContent>

              {/* Charting a harbor. Everything the form asks for stays on
                  this side: the name, the voyage, the waters, the tier in a
                  sentence, and the advisor. Nothing was cut to make the
                  switch pay for itself, because the panel is the same height
                  either way and the board no longer has to be scrolled past
                  to reach the end of it. */}
              <TabsContent
                value="create"
                forceMount
                className="mt-3 outline-none data-[state=inactive]:hidden"
              >
                <motion.div
                  initial={false}
                  animate={{
                    opacity: view === "create" ? 1 : 0,
                    y: view === "create" ? 0 : 6,
                  }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="space-y-3"
                >
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Name a room, pick its waters, and open it to the fleet.
                  </p>

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

                  {/* Which voyage, before how hard. Mode is the larger choice
                      of the two: it decides what the phases are and what
                      order they run in, where the tier only decides how
                      punishing they are. It is drawn the larger way for that
                      reason. */}
                  <VoyageCards
                    label="Voyage"
                    options={MODE_ORDER.map((key) => ({
                      key,
                      icon: MODES[key].icon,
                      badge: MODES[key].badge,
                      tagline: MODES[key].tagline,
                      summary: MODES[key].summary,
                      experimental: MODES[key].experimental,
                    }))}
                    value={mode}
                    onChange={setMode}
                  />

                  <div>
                    <WatersScale
                      label="Waters"
                      options={DIFFICULTY_ORDER.map((key) => ({
                        key,
                        icon: DIFFICULTIES[key].icon,
                        badge: DIFFICULTIES[key].badge,
                        rounds: DIFFICULTIES[key].rounds,
                      }))}
                      value={difficulty}
                      onChange={setDifficulty}
                    />
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                      {DIFFICULTIES[difficulty].tagline}
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
                </motion.div>
              </TabsContent>
            </Tabs>
          </div>
        </section>

        {/* The rail: who is about, and the conversation with whoever the
            captain picked from that list.

            Two panels, not one that swaps between them. Merging the pair
            gave the conversation the whole rail, which took the roster away
            whenever a thread was open, and it left a captain arriving at the
            lobby looking at a list of names with nothing under it and no way
            to tell a chat was there at all. The chat keeps a panel of its
            own, where it can be read before anyone has been picked. */}
        {/* Below the lg breakpoint this rail leads and the harbor board
            follows it, the way the game room's chat column leads. Stacked
            last, the conversation sat under the whole board, and its depth
            grew with every harbor the fleet had open, so it read as absent
            rather than as simply further down. The board is one short scroll
            away instead, and a captain scrolling a room list is reading
            anyway. Above the breakpoint nothing moves. */}
        <aside className="-order-1 space-y-3 lg:order-2">
          <div className="pm-glass pm-panel">
            <CardHead icon={Users} tone="text-captains" title="Captains Online">
              <Pill tone="gain">
                <OnlineDot online size={8} /> {totalOnline}
              </Pill>
            </CardHead>
            {/* The plain scroller rather than ScrollArea, capped rather than
                stretched. A viewport sized in percentages inside a flex
                parent resolves back to auto and stops scrolling, so a list
                that has to fill its parent uses this div, the same one the
                captain profile and the crew ledger use. */}
            <div className="pm-scroll max-h-56 overflow-y-auto pr-2">
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
            </div>
          </div>

          {/* The chat draws its own header and its own scroller, so it takes
              the panel's corners without its padding. Two parts, the same
              two the voyage's chat carries: the harbor square, which is
              where a captain speaks to everybody standing in the lobby,
              and the private threads, which is where picking a name above
              lands. */}
          <div className="pm-glass pm-panel-flush flex h-[22.5rem] flex-col">
            <Tabs
              value={chatTab}
              onValueChange={(v) => setChatTab(v as "lobby" | "dm")}
              className="flex h-full flex-col"
            >
              <div className="flex items-center gap-2 px-4 pt-3">
                <MessageCircle className="h-4 w-4 shrink-0 text-messages" />
                <span className="pm-truncate min-w-0 flex-1 text-sm font-medium">
                  {chatTab === "lobby"
                    ? "Harbor chat"
                    : dmTarget
                      ? `Direct · ${dmTarget.displayName}`
                      : "Direct messages"}
                </span>
              </div>
              <TabsList className="mx-4 mt-2 grid grid-cols-2">
                <TabsTrigger value="lobby">
                  <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Harbor
                </TabsTrigger>
                <TabsTrigger value="dm">
                  <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Direct
                </TabsTrigger>
              </TabsList>
              {/* Both channels stay mounted, so the square keeps filling in
                  while the captain is reading a private thread and is still
                  there on the way back. Unmounted, it would reseed from the
                  backlog this screen loaded once, which is a fetch old by
                  then and knows nothing of what arrived live. */}
              <TabsContent
                value="lobby"
                forceMount
                className="mt-0 flex-1 min-h-0 data-[state=inactive]:hidden"
              >
                <ChatPanel
                  socket={socket}
                  me={me}
                  mode="lobby"
                  initialMessages={lobbyHistory}
                />
              </TabsContent>
              <TabsContent
                value="dm"
                forceMount
                className="mt-0 flex-1 min-h-0 data-[state=inactive]:hidden"
              >
                {dmTarget ? (
                  dmLoading ? (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
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
                  <div className="flex h-full items-center justify-center px-6 text-center">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Pick a captain from the list above to start a private
                      conversation.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
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
