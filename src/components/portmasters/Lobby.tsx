"use client";

import { VoyageChronicle } from "@/types/realtime/voyage";
import { HouseStanding } from "@/types/realtime/standings";
import { APP_NAME, APP_TAGLINE } from "@/lib/game/constants/brand";
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
import { useLanguage } from "@/lib/use-language-preference";
import { useSound } from "@/lib/use-sound";
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  type Difficulty,
} from "@/lib/game/difficulty";
import {
  MODES,
  MODE_ORDER,
  DEFAULT_MODE,
  modeConfig,
  voyageRoundsFor,
  type GameMode,
} from "@/lib/game/mode";
import { Avatar, OnlineDot } from "./shared";
import { CaptainProfileModal } from "./CaptainProfileModal";
import { AgeBanner } from "./AgeBanner";
import { HowToPlayModal } from "./HowToPlayModal";
import { SettingsModal } from "./SettingsModal";
import { DifficultyAdvisor } from "./DifficultyAdvisor";
import { LeaderboardModal } from "./LeaderboardModal";
import { HarborBoard } from "./lobby/HarborBoard";
import {
  LegacyDialog,
  CheckInDialog,
  ChronicleDialog,
  HousesDialog,
} from "./lobby/LobbyDialogs";
import { Gauge, GaugeRule } from "./lobby/HarborGauge";
import { HarborRail } from "./lobby/HarborRail";
import { VoyageCards } from "./lobby/VoyageCards";
import { WatersScale } from "./lobby/WatersScale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Anchor,
  LogOut,
  Plus,
  Ship,
  Star,
  Users,
  KeyRound,
  Loader2,
  RefreshCw,
  Gift,
  Zap,
  BookOpen,
  Landmark,
  Settings,
  Trophy,
  Info,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { HOUSES } from "@/lib/game/engine";
import {
  DEFAULT_LEGACY_SUMMARY,
  renownProgress,
  type CaptainLegacySummary,
  type HouseId,
} from "@/lib/game/legacy";
import { checkInStatus, type CheckInStatus } from "@/lib/game/checkin";
import { t } from "@/lib/game/i18n";
import styles from "./lobby/Lobby.module.css";

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
  // The captain's language, read here so the settings pair can switch it
  // and this screen redraws through the same render the pick lands in.
  const { locale, setLanguage } = useLanguage();
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
  // captain's phases run in, so a harbor that changed it mid voyage would be
  // asking its table to keep two different clocks. Starts on the founding
  // mode, which is the one a captain who never touches this control gets.
  const [mode, setMode] = useState<GameMode>(DEFAULT_MODE);
  // Whether the captain has picked a mode of their own rather than leaving
  // the Voyage cards untouched. The How to Play manual reads it: a captain
  // who has chosen a voyage is answered by their choice, while one who has
  // not is answered by the harbor they are browsing (see browsedMode).
  const [modeChosen, setModeChosen] = useState(false);
  // What the host typed to open a sealed voyage, sent
  // only when the mode they picked takes a phrase. Cleared once a harbor is
  // opened with it, because a phrase that has already worked is not one the
  // next form needs to hand over again.
  const [unlockPhrase, setUnlockPhrase] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Which half of the lobby panel is showing. Opens on browse, because the
  // list is what a captain arrives wanting to see (the panel below holds the
  // full reason it is a switch rather than stacked cards).
  const [view, setView] = useState<"browse" | "create">("browse");

  // While queued, the Quick Start button
  // stays in a loading state and waits for the quickstart:matched socket
  // event before routing the captain into the matched harbor.
  const [quickStarting, setQuickStarting] = useState(false);

  // Dialog state. Fetched on open.
  const [chronicleOpen, setChronicleOpen] = useState(false);
  const [chronicles, setChronicles] = useState<VoyageChronicle[]>([]);
  const [chronicleLoading, setChronicleLoading] = useState(false);

  // Dialog state. Standings are fetched on open,
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
    // true, so that first set is a no op anyway, and the interval's calls all
    // run long after this effect has returned.
    const kickoff = setTimeout(refreshRooms, 0);
    const t = setInterval(refreshRooms, 8000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(t);
    };
  }, [refreshRooms]);

  // A captain's Renown only ever changes when a voyage concludes, which
  // never happens while sitting in the lobby, so a plain fetch on mount is
  // enough; no polling needed like the harbor list above. The same fetch
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
        toast.success(
          t("Day {res.day} claimed: +{res.xpGained} Renown XP", {
            "res.day": res.day ?? 0,
            "res.xpGained": res.xpGained ?? 0,
          }),
          {
            description: res.leveledUp
              ? t(
                  "Renown level up! A bigger start of voyage Gold bonus awaits.",
                )
              : t("Fair winds. Come back tomorrow for the next reward."),
          },
        );
      } else {
        toast(t("Already checked in today"), {
          description: t("Come back tomorrow for the next reward."),
        });
      }
    } catch {
      toast.error(t("Check in failed"), {
        description: t("Could not reach the Harbormaster. Try again."),
      });
    } finally {
      setClaiming(false);
    }
  }, []);

  // What the gift button and the dialog read, re-derived rather than
  // trusted as fetched.
  //
  // The status the server sends is a reading of the day it was sent:
  // canClaimToday is false the moment today's claim is spent, and the turn
  // of the UTC day is the one thing that makes it true again. The day math
  // is pure and shared with the route that serves it (see
  // src/lib/game/checkin), so the reading is taken again here on every
  // render from the two persisted fields. The harbor list already redraws
  // this panel every eight seconds, so a lobby left open across midnight
  // lights the gift again on its own, where before it stayed dark until a
  // reload.
  const checkInToday = checkInStatus({
    checkInCount: checkIn.claimedThisCycle,
    lastCheckInDate: checkIn.lastCheckInDate,
  });

  // Renown for every other captain currently shown in "Captains Online"
  // below, fetched as one batch rather than one request per captain (see
  // POST /api/legacy/batch). Keyed on the *set* of online ids, not the
  // onlineUsers array itself, since that array gets a new reference on
  // every presence:update broadcast (anyone, anywhere, connecting or
  // switching harbors), most of which don't actually add or remove anyone
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
  // cleanup both read it, and neither should rerun when it changes.
  const queuedForMatch = useRef(false);

  // The silence the button waits on, held so it can be called off when
  // the harbor closes under the captain rather than firing into a tree
  // that is no longer there.
  const quickStartTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (quickStartTimer.current !== null) {
        window.clearTimeout(quickStartTimer.current);
      }
    },
    [],
  );

  // Join the queue and wait to be paired.
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
      setError(e instanceof Error ? e.message : t("Quick Start failed"));
      setQuickStarting(false);
      return;
    }

    // Queueing needs a live, authenticated socket. Without one the emit
    // goes nowhere at all and the button would spin until the timeout, so
    // a missing socket is refused here rather than waited on.
    if (!socket || !authed) {
      setError(t("Still connecting to the harbor. Try again in a moment."));
      setQuickStarting(false);
      return;
    }

    queuedForMatch.current = true;
    // The tier goes with the request. It decides the harbor when this
    // captain is the one who opens it; a captain seated into a harbor
    // that already exists sails at that harbor's tier instead.
    socket.emit("quickstart:join", { difficulty });
    toast(t("Looking for a harbor"), {
      description: t("Pairing you with the next captain who asks."),
    });

    // A match is answered within a round trip, so a long silence means the
    // reply went missing. Give up gracefully instead of spinning.
    if (quickStartTimer.current !== null) {
      window.clearTimeout(quickStartTimer.current);
    }
    quickStartTimer.current = window.setTimeout(() => {
      quickStartTimer.current = null;
      if (!queuedForMatch.current) return;
      queuedForMatch.current = false;
      socket.emit("quickstart:leave");
      setError(t("Quick Start timed out. Please try again."));
      setQuickStarting(false);
    }, 15000);
  }, [difficulty, socket, authed]);

  // The queue resolves here.
  //
  // The first captain to ask is seated straight away: if no open public
  // harbor is waiting, the realtime layer opens one and makes them the
  // host. The next captain to ask is seated into that same harbor, because
  // it is public and has not set sail. So both callers get a match, and
  // they end up in the same harbor. We fetch the full harbor detail and enter,
  // exactly as if the captain had typed the code in by hand.
  useEffect(() => {
    // The live socket off the hook, not a second one fetched from the
    // module: only the hook's is in a dependency array, so a module level
    // listener would stay on a socket torn down at sign out while the
    // queue effect above moves to the new one.
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
                t("Quick Start matched a harbor, but it could not be reached."),
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
      setError(data?.error ?? t("Quick Start is unavailable right now."));
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
    // A sealed voyage is opened by its phrase and by nothing else, so a
    // blank field is a request the harbor can only refuse. Answering here
    // spares the round trip and tells the captain why the door is shut.
    if (modeConfig(mode).sealed && !unlockPhrase.trim()) {
      setError(
        t(
          "This voyage is sealed. It opens with a phrase, and the harbor was not given one.",
        ),
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { room } = await api.createRoom({
        name: newName.trim(),
        isPublic,
        difficulty,
        mode,
        // The phrase rides only with the voyage that
        // asks for one. The route refuses a phrase whose door is not the
        // mode requested, which is the right answer for a request that
        // names a phrase and an open mode together, so the open modes
        // never send one.
        ...(modeConfig(mode).sealed ? { unlock: unlockPhrase } : {}),
      });
      setNewName("");
      setUnlockPhrase("");
      onEnterRoom(room);
    } catch (e) {
      // A refused phrase is the route's answer to a bad phrase rather than
      // a failure of the form, and its message already says which of the
      // two mistakes it was: nothing typed, or the wrong words.
      setError(e instanceof Error ? e.message : t("Failed to create harbor"));
    } finally {
      setBusy(false);
    }
  }

  async function joinByCode() {
    if (joinCode.trim().length !== 6) {
      setError(t("Harbor codes are 6 characters."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { room } = await api.joinRoomByCode(joinCode.trim().toUpperCase());
      setJoinCode("");
      onEnterRoom(room);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Failed to join harbor"));
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
      setError(e instanceof Error ? e.message : t("Failed to enter harbor"));
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

  // There is no effect here watching dmTarget to seed the thread: openDm
  // above is the only thing in the whole file that ever sets a target, so
  // the clear, the loading flag and the request all belong to that one
  // click that changes the target, and the thread is fetched once.

  // The square's backlog, read once on landing. Nothing reseeds it later,
  // and nothing needs to: this channel is written down rather than held in
  // the harbor's session log, so whatever was said while this captain was at
  // sea is simply part of the backlog they read on their next landing.
  useEffect(() => {
    api
      .getLobbyChat()
      .then(({ messages }) => setLobbyHistory(messages))
      .catch(() => {
        /* leave the square empty; it fills in live */
      });
  }, []);

  // Fetch the captain's chronicles when the
  // dialog opens. Newest first as returned by /api/chronicle.
  const openChronicle = useCallback(() => {
    setChronicleOpen(true);
    setChronicleLoading(true);
    api
      .listChronicles()
      .then(({ chronicles }) => setChronicles(chronicles))
      .catch(() => {
        toast.error(t("Could not load chronicles"));
      })
      .finally(() => setChronicleLoading(false));
  }, []);

  // Fetch harbor wide standings plus the
  // captain's current pledge when the House dialog opens. myHouseId is
  // resynced after a successful pledge so the chosen row stays marked.
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
        toast.error(t("Could not load House standings"));
      })
      .finally(() => setHouseLoading(false));
  }, []);

  const pledge = useCallback(async (houseId: HouseId) => {
    setPledgingHouse(houseId);
    try {
      await api.pledgeHouse(houseId);
      setMyHouseId(houseId);
      const house = HOUSES.find((h) => h.id === houseId);
      toast.success(
        t("Pledged to {houseName}", {
          houseName: t(house?.name ?? "House"),
        }),
        {
          description: t("Your House perk applies on your next fresh voyage."),
        },
      );
    } catch (e) {
      toast.error(t("Pledge failed"), {
        description:
          e instanceof Error ? e.message : t("Try again in a moment."),
      });
    } finally {
      setPledgingHouse(null);
    }
  }, []);

  const totalOnline = onlineUsers.length;

  // What the How to Play manual describes from this lobby. A captain who
  // has picked a mode of their own is answered by their choice, because
  // the pages they want next are the ones about the voyage they are
  // charting. A captain who has chosen nothing is answered by the harbor
  // they are browsing: on a board whose harbors all sail one voyage, that
  // voyage is the only table they can enter from the page the guide
  // button sits on, so the pages describe it rather than the founding
  // voyage they are not about to play. A mixed board (or an empty one)
  // names no single harbor being browsed, and the pages then fall to the
  // founding voyage, whose own page is the manual every other mode is
  // measured against (see voyagePage in ./HowToPlayModal).
  const boardMode = rooms[0]?.mode;
  const browsedMode: GameMode =
    modeChosen ||
    boardMode === undefined ||
    !rooms.every((r) => r.mode === boardMode)
      ? mode
      : boardMode;

  return (
    <div className={cn("pm-canvas min-h-screen w-full", styles.lobby)}>
      {/* ===============================================================
          The masthead.

          One card, answering one question in two rows: what can I reach
          from here, and what is the harbor doing. The tools sit on a
          single shelf, all of them the same height and the same shape,
          quiet by default, with color spent on the one thing actually
          waiting for the captain, so a row of controls doing the same
          kind of job reads as one instrument. The harbor's numbers sit
          under a hairline as a gauge row, and the figure that also opens
          a panel is the control that opens it, so nothing is printed
          twice.
         =============================================================== */}
      <header className="sticky top-0 z-30 mx-auto w-full max-w-7xl shrink-0 px-4 pb-2 pt-4 sm:px-6 lg:relative">
        {/* A scrim, so the board fades out as it slides under the masthead
            rather than showing through the strip above it. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background via-background/85 to-transparent" />
        <div className="pm-glass pm-panel-bar relative">
          {/* Wraps so the tool shelf can drop to its own row on a phone. The
              shelf cannot shrink and the title cannot grow past it, so
              without the wrap, below roughly a tablet, the shelf wins the
              whole row and the ship's name draws underneath the buttons. */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="pm-seal pm-grad-brand">
              <Anchor className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              {/* The name, then a tagline on its own line: the header
                  prints one title and one sentence under it, with nothing
                  trailing the name on its line. */}
              <h1 className="font-display text-sm font-bold leading-tight tracking-tight">
                {/* block, because pm-truncate cannot clip an inline box:
                    without it the title draws its full width out past its
                    own column instead of ending in an ellipsis. */}
                <span className="text-brand pm-truncate block">{APP_NAME}</span>
              </h1>
              <p className="pm-truncate text-[11px] leading-tight text-muted-foreground">
                {t(APP_TAGLINE)}
              </p>
            </div>

            {/* The shelf. One height, one shape, one quiet skin for every
                tool on it, because the tools all do the same kind of job
                and a row of different tints reads as a row of unrelated
                widgets; color is kept for Check In, the only tool that is
                ever waiting. */}
            <div className="order-last flex basis-full items-center gap-2 sm:order-none sm:basis-auto">
              <button
                onClick={openChronicle}
                className="pm-tool pm-pressable bg-black/[0.05] text-foreground dark:bg-white/10"
                title={t("Voyage Chronicles")}
                aria-label={t("Voyage Chronicles")}
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">{t("Chronicles")}</span>
              </button>
              <button
                onClick={openHouse}
                className="pm-tool pm-pressable bg-black/[0.05] text-foreground dark:bg-white/10"
                title={t("Great Houses")}
                aria-label={t("Great Houses")}
              >
                <Landmark className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">{t("Houses")}</span>
              </button>
              <button
                onClick={() => setLeaderboardOpen(true)}
                className="pm-tool pm-tool-icon pm-pressable bg-black/[0.05] text-foreground dark:bg-white/10"
                title={t("Harbor Leaderboard")}
                aria-label={t("Open harbor leaderboard")}
              >
                <Trophy className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setSettingsOpen(true)}
                className="pm-tool pm-tool-icon pm-pressable bg-black/[0.05] text-foreground dark:bg-white/10"
                title={t("Settings")}
                aria-label={t("Open settings")}
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setCheckInOpen(true)}
                className={cn(
                  "pm-tool pm-pressable relative",
                  checkInToday.canClaimToday
                    ? "pm-grad-checkin text-white"
                    : "bg-black/[0.05] text-foreground dark:bg-white/10",
                )}
                title={t("Daily Check In")}
                aria-label={t("Daily Check In")}
              >
                <Gift className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">{t("Check In")}</span>
                {checkInToday.canClaimToday && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-alarm ring-2 ring-background" />
                )}
              </button>
            </div>

            <div className="h-6 w-px shrink-0 bg-black/10 dark:bg-white/15" />

            <button
              onClick={() => setProfileOpen(true)}
              className="pm-tool pm-pressable gap-1.5 bg-black/[0.05] pl-0.5 pr-2.5 dark:bg-white/10"
              title={t("View captain profile")}
              aria-label={t("View captain profile")}
            >
              <Avatar hue={me.avatarHue} name={me.displayName} size={24} ring />
              <span className="hidden max-w-32 truncate md:inline">
                {me.displayName}
              </span>
            </button>
            <button
              onClick={onLogout}
              className="pm-tool pm-tool-icon pm-pressable bg-black/[0.05] text-muted-foreground dark:bg-white/10"
              title={t("Sign out")}
              aria-label={t("Sign out")}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* The gauge row. Four facts about the harbor, each with the same
              icon size, the same quiet label and the same tabular figure,
              divided by hairlines rather than scattered, so they read as
              one instrument instead of four loose labels. Your Renown is a
              button because the panel behind it is the rest of the story,
              and it is printed here and nowhere else on the screen. */}
          <div className="lobbyStats mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-black/[0.06] pt-2.5 dark:border-white/[0.08]">
            <Gauge
              icon={Users}
              tone="text-captains"
              label={t("Captains")}
              value={totalOnline}
            />
            <GaugeRule />
            <Gauge
              icon={Ship}
              tone="text-harbors"
              label={t("Open Harbors")}
              value={rooms.length}
            />
            <GaugeRule />
            <Gauge
              icon={Anchor}
              tone="text-sailing"
              label={t("Sailing")}
              value={rooms.filter((r) => r.started).length}
            />
            <GaugeRule />
            <button
              onClick={() => setLegacyOpen(true)}
              className="-mx-1.5 flex items-center gap-1.5 rounded-full px-1.5 py-0.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
              title={t("Captain's Legacy")}
              aria-label={t("View captain's legacy")}
            >
              <Star className="h-3.5 w-3.5 text-renown" />
              <span className="text-[11px] text-muted-foreground">
                {t("Your Renown")}
              </span>
              <b className="text-[11px] tabular-nums">
                {t("Lv {n}", { n: renownProgress(legacy.renownXP).level })}
              </b>
            </button>

            <div className="ml-auto flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <OnlineDot online={connected && authed} size={8} />
                <span className="text-[11px] text-muted-foreground">
                  {connected && authed ? t("Online") : t("Connecting")}
                </span>
              </span>
              <div className="hidden md:block">
                <AgeBanner className="pm-tool" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <main
        className={cn(
          "mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-4 pb-4 pt-2 sm:px-6",
          styles.workspace,
        )}
      >
        {/* News that arrived without this captain asking for it, on the
            screen they landed on afterwards. Neutral rather than alarming:
            nothing is wrong with this account, something simply happened
            out in the harbor. */}
        {notice && (
          <div
            className={cn(
              "pm-glass flex items-start gap-2.5 rounded-2xl px-4 py-3 lg:col-span-2",
              styles.notice,
            )}
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="flex-1 text-xs leading-relaxed">{notice}</p>
            {onDismissNotice && (
              <button
                onClick={onDismissNotice}
                className="-mr-1 -mt-0.5 shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                title={t("Dismiss")}
                aria-label={t("Dismiss")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        <section
          className={cn(
            "pm-glass pm-panel flex min-w-0 flex-col gap-4",
            styles.primary,
          )}
        >
          {/* Quick Start shares the main panel frame with the harbor controls. */}
          <div className="pm-tile lobbyQuickstart flex shrink-0 items-center gap-4 border">
            <div className="pm-seal pm-grad-quickstart">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-sm font-semibold">
                {t("Quick Start")}
              </div>
              <p className="text-[11px] leading-tight text-muted-foreground">
                {t(
                  "Match instantly with the next captain who hits Quick Start.",
                )}
              </p>
            </div>
            {/* The vermilion seal, the same color the harbor uses for a
                thing that must not be missed: the button wears the
                quickstart hue, so no two unrelated controls share a
                skin. */}
            <Button
              onClick={handleQuickStart}
              disabled={quickStarting || busy}
              className="pm-grad-quickstart h-10 shrink-0 rounded-xl font-semibold text-white"
            >
              {quickStarting ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />{" "}
                  {t("Waiting")}
                </>
              ) : (
                <>
                  <Zap className="mr-1 h-4 w-4" /> {t("Quick Start")}
                </>
              )}
            </Button>
          </div>

          {/* This column is one panel holding two views rather than three
              stacked cards. Charting a harbor and walking the open ones are
              the two things a captain comes here to do, and stacked they
              fight over the same scroll: the create form is the tallest
              thing on the screen by a wide margin, so the board beneath it
              starts around a screen and a half down and the room list is
              never in view on the screen whose whole job is showing rooms.
              A switch hands each of them the panel instead. */}
          <div className={styles.harbors}>
            <Tabs
              value={view}
              onValueChange={(next) => setView(next as "browse" | "create")}
              // Manual activation, because this switch carries two whole
              // views rather than a filter. Arrowing across it should let a
              // captain read both labels before committing, not swap the
              // panel out from under them on the way past.
              activationMode="manual"
              className={cn("gap-0", styles.navigation)}
            >
              {/* The switch is a recessed well with the live view raised
                  inside it, which is the pairing the tool shelf already uses.
                  Color is spent on the two icons, one per view, in the hue
                  that view already wears below: harbors dresses the board,
                  charter dresses the create form. Both hues are already on
                  this screen and they sit far enough apart on the ladder to
                  be read side by side, so the switch costs the palette
                  nothing. Its height is pm-field's, so it lines up with the
                  buttons and fields underneath it. */}
              <TabsList className="grid h-10 w-full shrink-0 grid-cols-2 bg-black/5 p-1 dark:bg-black/25">
                <TabsTrigger
                  value="browse"
                  className="text-muted-foreground data-[state=active]:text-foreground dark:data-[state=active]:bg-white/10"
                >
                  <Ship className="text-harbors" />
                  {t("Open Harbors")}
                </TabsTrigger>
                <TabsTrigger
                  value="create"
                  className="text-muted-foreground data-[state=active]:text-foreground dark:data-[state=active]:bg-white/10"
                >
                  <Plus className="text-charter" />
                  {t("Chart a new harbor")}
                </TabsTrigger>
              </TabsList>

              {/* Whatever went wrong last, whichever view it went wrong in.
                  It sits above both views rather than inside the board,
                  because the board is the one place a captain typing a room
                  name is not looking. */}
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
                className={cn(
                  "pm-scroll mt-4 outline-none data-[state=inactive]:hidden",
                  styles.view,
                )}
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
                  className="space-y-4"
                >
                  {/* The board's own controls, on the line that describes the
                      board. */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">
                      {t("Every harbor the fleet has open right now.")}
                    </p>
                    {/* How to Play is a plain button rather than the Button
                        primitive: the ghost variant exists to be transparent
                        and this control wears a solid gradient, so the
                        variant would contribute nothing but a hover tint
                        that cannot be seen through the paint. It is a tool,
                        the same as everything else on a shelf. The label
                        shortens below the sm width, because a control with
                        no room to shrink must fit the line it shares: the
                        full wording leads from sm up, and the title and the
                        aria label carry it at every width. */}
                    <button
                      onClick={() => setHowToPlayOpen(true)}
                      className="pm-tool pm-pressable pm-grad-guide text-white"
                      title={t("How to Play")}
                      aria-label={t("How to Play")}
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      <span className="sm:hidden">{t("Guide")}</span>
                      <span className="hidden sm:inline">
                        {t("How to Play")}
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="pm-tool pm-tool-icon rounded-full"
                      onClick={refreshRooms}
                      disabled={loadingRooms}
                      title={t("Refresh harbors")}
                      aria-label={t("Refresh the harbor list")}
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
                      not make", so it belongs here in the browse view, beside
                      Quick Start, rather than at the foot of the create form.
                      The label moves above the field on a narrow screen. */}
                  <div className="lobbyJoin grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                    <Label
                      htmlFor="join-code"
                      className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      {t("Join by code")}
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
                      {t("Join")}
                    </Button>
                  </div>
                  {/* The board of harbors already open. A hairline divides it
                      from the two ways in above, so the list reads as its own
                      band rather than as one more control. */}
                  <div className="space-y-2 border-t border-black/[0.06] pt-3 dark:border-white/[0.08]">
                    <HarborBoard
                      rooms={rooms}
                      loading={loadingRooms}
                      meId={me.id}
                      joining={joining}
                      onEnter={enterRoom}
                    />
                  </div>
                </motion.div>
              </TabsContent>

              {/* The creation form expands with its contents and uses the page scroll. */}
              <TabsContent
                value="create"
                forceMount
                className={cn(
                  "pm-scroll mt-4 outline-none data-[state=inactive]:hidden",
                  styles.view,
                  styles.creation,
                )}
              >
                <motion.div
                  initial={false}
                  animate={{
                    opacity: view === "create" ? 1 : 0,
                    y: view === "create" ? 0 : 6,
                  }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className={styles.form}
                >
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {t(
                      "Name a harbor, pick its waters, and open it to the fleet.",
                    )}
                  </p>

                  <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="harbor-name"
                        className="text-xs text-muted-foreground"
                      >
                        {t("Harbor name")}
                      </Label>
                      <Input
                        id="harbor-name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder={t("e.g. Silk Run · Voyage 1")}
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
                        {t("Public")}
                      </Label>
                    </div>
                    <Button
                      onClick={createRoom}
                      disabled={
                        busy ||
                        !newName.trim() ||
                        (modeConfig(mode).sealed && !unlockPhrase.trim())
                      }
                      className="pm-grad-charter pm-field text-white"
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="mr-1 h-4 w-4" /> {t("Create")}
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Which voyage, before how hard. Mode is the larger choice
                      of the two: it decides what the phases are and what
                      order they run in, where the tier only decides how
                      punishing they are. It is drawn the larger way for that
                      reason. */}
                  {/* The cards print the words the mode record carries, so the
                      three that are copy are read here, at the boundary where
                      this form hands them over, and the cards keep printing
                      whatever they are given. The icon is a glyph and the two
                      flags are switches, so they travel untouched. */}
                  <div>
                    <VoyageCards
                      label={t("Voyage")}
                      options={MODE_ORDER.map((key) => ({
                        key,
                        icon: MODES[key].icon,
                        badge: t(MODES[key].badge),
                        tagline: t(MODES[key].tagline),
                        summary: t(MODES[key].summary),
                        experimental: MODES[key].experimental,
                        sealed: MODES[key].sealed,
                      }))}
                      value={mode}
                      onChange={(m) => {
                        setMode(m);
                        setModeChosen(true);
                      }}
                    />
                  </div>

                  {/* The phrase, drawn under the cards
                      rather than inside one because it is an answer to the
                      choice rather than a third thing to choose, and it is
                      drawn only while the card above it is sealed. The
                      route is what decides whether a phrase opens anything:
                      nothing here checks it, so the form can never refuse a
                      phrase the harbor would have taken. */}
                  {modeConfig(mode).sealed && (
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="unlock-phrase"
                        className="text-xs text-muted-foreground"
                      >
                        {t("Unlock phrase")}
                      </Label>
                      <Input
                        id="unlock-phrase"
                        value={unlockPhrase}
                        onChange={(e) => setUnlockPhrase(e.target.value)}
                        placeholder={t("The phrase the harbor asks for")}
                        maxLength={120}
                        autoComplete="off"
                        spellCheck={false}
                        className="pm-field"
                        onKeyDown={(e) => e.key === "Enter" && createRoom()}
                      />
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        {t(
                          "A captain's tenth completed voyage hands them this phrase, and the guide keeps a copy for whoever goes looking. Anyone who has it can open the table, and every seat at that table sails the voyage it opens.",
                        )}
                      </p>
                    </div>
                  )}

                  <div>
                    <WatersScale
                      label={t("Waters")}
                      options={DIFFICULTY_ORDER.map((key) => ({
                        key,
                        icon: DIFFICULTIES[key].icon,
                        badge: t(DIFFICULTIES[key].badge),
                        // The length the voyage will actually run, not the
                        // tier's alone: a sealed mode pins its own (see
                        // voyageRoundsFor in src/lib/game/mode), and the
                        // chip is what the host is choosing the voyage on.
                        rounds: voyageRoundsFor(mode, key),
                      }))}
                      value={difficulty}
                      onChange={setDifficulty}
                    />
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                      {t(DIFFICULTIES[difficulty].tagline)}
                    </p>
                    {/* Difficulty Advisor */}
                    <DifficultyAdvisor
                      selectedDifficulty={difficulty}
                      mode={mode}
                      renownLevel={renownProgress(legacy.renownXP).level}
                      voyagesCompleted={legacy.voyagesCompleted}
                      bestReputation={legacy.bestReputation}
                      solventStreak={legacy.consecutiveSolventVoyages}
                    />
                  </div>
                </motion.div>
              </TabsContent>
            </Tabs>
          </div>
        </section>

        {/* The rail: who is about, and the conversation with whoever the
            captain picked from that list. See ./lobby/HarborRail for the
            two panels and for why they do not merge. */}
        <HarborRail
          totalOnline={totalOnline}
          connected={connected}
          onlineUsers={onlineUsers}
          me={me}
          otherLegacies={otherLegacies}
          openDm={openDm}
          chatTab={chatTab}
          onChatTabChange={setChatTab}
          dmTarget={dmTarget}
          dmLoading={dmLoading}
          socket={socket}
          lobbyHistory={lobbyHistory}
          dmHistory={dmHistory}
        />
      </main>

      <LegacyDialog
        open={legacyOpen}
        onOpenChange={setLegacyOpen}
        legacy={legacy}
      />

      <CheckInDialog
        open={checkInOpen}
        onOpenChange={setCheckInOpen}
        checkIn={checkInToday}
        claiming={claiming}
        onClaim={claimCheckIn}
      />

      <ChronicleDialog
        open={chronicleOpen}
        onOpenChange={setChronicleOpen}
        loading={chronicleLoading}
        chronicles={chronicles}
      />

      <HousesDialog
        open={houseOpen}
        onOpenChange={setHouseOpen}
        loading={houseLoading}
        standings={houseStandings}
        myHouseId={myHouseId}
        pledgingHouse={pledgingHouse}
        onPledge={pledge}
      />

      <CaptainProfileModal
        open={profileOpen}
        onOpenChange={setProfileOpen}
        me={me}
      />
      <HowToPlayModal
        open={howToPlayOpen}
        onOpenChange={setHowToPlayOpen}
        mode={browsedMode}
      />
      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        soundEnabled={soundOn}
        onToggleSound={toggleSound}
        colorblindSafe={colorblindSafe}
        onToggleColorblind={() => setColorblindSafe(!colorblindSafe)}
        volume={soundVolume}
        onVolumeChange={setSoundVolume}
        locale={locale}
        onSetLocale={setLanguage}
      />
      <LeaderboardModal
        open={leaderboardOpen}
        onOpenChange={setLeaderboardOpen}
        myUserId={me.id}
      />
    </div>
  );
}
