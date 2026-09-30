"use client";

import { VoyageResult, VoyageReveal } from "@/types/realtime/voyage";
import { RoomMembersPayload } from "@/types/realtime/moderation";
import {
  BROKERS_FAVOR_UNLOCK_LEVEL,
  TIDEWATCH_SURGE_THRESHOLD,
  WORD_ON_THE_DOCKS_THRESHOLD,
} from "@/lib/game/constants/world";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  api,
  type ChatMessage,
  type PublicUser,
  type RoomDetail,
} from "@/lib/api";
import type { CaptainLegacySummary } from "@/lib/game/legacy";
import type { GameState } from "@/lib/game/types";
import { meritById } from "@/lib/game/merits";
import { normalizeStandingOrders } from "@/lib/game/standing";
import { useRealtime } from "@/lib/use-realtime";
import { useGameSession } from "@/lib/use-game-session";
import { usePhaseSync } from "@/lib/use-phase-sync";
import {
  usePlayerDetail,
  type PlayerDetailData,
} from "@/lib/use-player-detail";
import { usePrivateLog } from "@/lib/use-private-log";
import { useVoyageLog } from "@/lib/use-voyage-log";
import { useObjective } from "@/lib/use-objective";
import { useLegReport } from "@/lib/use-leg-report";
import { useAudit } from "@/lib/use-audit";
import { useMaroon } from "@/lib/use-maroon";
import { useNotificationCenter } from "@/lib/use-notifications";
import { useHarborBoards } from "@/lib/use-harbor-boards";
import { PlayerDetailModal } from "./game/GameModals";
import { GameStatusPanel } from "./game/GameStatusPanel";
import { GamePhasePanel } from "./game/GamePhasePanel";
import { GameControlPanel } from "./game/GameControlPanel";
import { PrivateCard } from "./game/PrivateCard";
import { PathDraft } from "./game/PathDraft";
import { PathChip } from "./game/status/PathChip";
import { HarborTopBar } from "./game/HarborTopBar";
import { ShortcutLegend } from "./game/ShortcutLegend";
import { StandingOrdersModal } from "./game/StandingOrdersModal";
import { ObjectivePanel } from "./game/ObjectivePanel";
import { AuditRevealStrip } from "./game/AuditPanel";
import { MaroonResultStrip, PortShiftStrip } from "./game/MaroonPanel";
import {
  GuideModal,
  TipsModal,
  RumorBoardModal,
  TutorialModal,
  RestartConfirmModal,
  NotificationHistoryModal,
} from "./game/GameModals";
import { MembersPanel } from "./MembersPanel";
import { FleetTicker } from "./FleetTicker";
import { KeyboardShortcutHelp } from "./KeyboardShortcutHelp";
import { SettingsModal } from "./SettingsModal";
import { ChatPanel, type ChatTrade } from "./ChatPanel";
import { DmTab } from "./chat/DmTab";
import { MeritIcon } from "./shared";
import { NotificationCenter } from "./NotificationCenter";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { MessageCircle, Ship, LifeBuoy } from "lucide-react";
import { useColorPreference } from "@/lib/use-color-preference";
import { useSound } from "@/lib/use-sound";
import { useRoomRoster } from "@/lib/use-room-roster";
import { renownProgress } from "@/lib/game/legacy";
import {
  applyTidewatchSurge,
  claimWordOnTheDocksReward,
  coverFromBoard,
  leavePhase,
  purchaseIntel,
  repayLoan,
} from "@/lib/game/engine";

// Browser scoped: the onboarding guide is a "you have played this before"
// signal, not per room state, so joining a second harbor does not replay it.
const TUTORIAL_SEEN_KEY = "portmasters_tutorial_seen";

// Why a Next Phase press was refused, in the words of the seat the captain is
// standing in. Every case here is a seat the engine's canLeavePhase says no
// to, and every one of them has a way out that is not this button: the host
// sets sail, a boon is picked, the module draft is finished or skipped. The
// press is refused rather than sent, so the captain who pressed it is owed the
// reason: the room would otherwise hold a ready set no departure could carry
// out, and the bar would say "ready" while the voyage stood still.
function leaveRefusal(phase: GameState["phase"]): string {
  switch (phase) {
    case "harbor":
      return "A voyage leaves the pier when the host sets sail, not by readying up.";
    case "dawn":
      return "Dawn is left by locking in a Boon. Pick one of the cards and it goes with you.";
    case "bankruptcy":
    case "endgame":
      return "This voyage is over for you, so there is no seat left to leave.";
    default:
      return "Your own screen has work open on it. Finish or close it and the room moves on.";
  }
}

export function GameRoom({
  me,
  room,
  onLeave,
  onSessionLost,
}: {
  me: PublicUser;
  // The room's own record, which is what the page already holds by the time
  // this renders. It used to be declared here as a union with a hand written
  // copy of the same shape that listed every field except difficulty, which
  // meant the lap deciding field was the one a second copy was free to forget.
  // Nothing ever passed that branch. Typing it as the real thing is what lets
  // the session below be told which mode this harbor is playing.
  room: RoomDetail;
  // The optional message is why the captain is leaving, for the times the
  // harbor was taken away rather than walked out of. The page owns the
  // screen that comes next, so it owns the telling.
  onLeave: (notice?: string) => void;
  // Handed straight to the realtime hook, which calls it when the server
  // refuses this connection's credentials.
  onSessionLost?: (message: string) => void;
}) {
  const { socket, connected, authed, onlineUsers } = useRealtime(
    me,
    onSessionLost,
  );
  const {
    enabled: soundOn,
    toggle: toggleSound,
    play: playSound,
    volume: soundVolume,
    setVolume: setSoundVolume,
  } = useSound();
  const { state, act, ctx, flush, startingGoldBonus, seats } = useGameSession(
    room.id,
    socket,
    true,
    me.id,
    // Only read if the save load never reaches the server, so this captain
    // still starts their voyage on the lap the rest of the harbor is keeping.
    room.mode,
  );
  const phaseSync = usePhaseSync({
    roomId: room.id,
    socket,
    game: state.game,
    act,
    // The voyage's own seed identity, which the engine's autoCommit needs to
    // leave a seat on the clock's behalf (see [B2] in @/lib/use-phase-sync).
    ctx,
    authed,
    myUserId: me.id,
    startingGoldBonus,
  });
  // Notification center needs to be initialized before the effects that
  // call notifications.push, otherwise the lint rule flags it as accessed
  // before declaration.
  const notifications = useNotificationCenter();

  // The eight boards this room runs outside a save file, and the nine
  // relays that close them into this captain's own voyage. They live in
  // one hook because they are one kind of thing: see ./use-harbor-boards
  // for the boards themselves and for what each relay is watching for.
  const { barter, aid, backing, convoy, escort, refit, bazaar, draft } =
    useHarborBoards({
      socket,
      roomId: room.id,
      meId: me.id,
      act,
      loaded: state.loaded,
      playSound,
    });

  // The cover the raid roll consults, mirrored from the board this captain
  // can see. The engine asks one field and never the network (see
  // escortCoverOf), so the board has to be read into that field here, and
  // here is the only place that turns a board into state.
  //
  // Gated on the load for the reason the refunds the boards hook holds back
  // are: a board that arrives before the save does would be written onto the
  // placeholder and thrown away the moment the real voyage landed, and this
  // effect runs again when the load finishes. The comparison before the
  // dispatch is what keeps an ordinary board update, one that has nothing to
  // do with this captain's cover, from cloning the whole voyage to write a
  // value it already holds.
  useEffect(() => {
    if (!state.loaded) return;
    const covered = coverFromBoard(
      escort.contracts,
      me.id,
      state.game.currentRound,
    );
    if (
      state.game.escortCover?.contractId === covered?.contractId &&
      state.game.escortCover?.sellerName === covered?.sellerName
    ) {
      return;
    }
    act((g) => {
      g.escortCover = covered;
    });
  }, [
    escort.contracts,
    state.loaded,
    state.game.currentRound,
    state.game.escortCover,
    me.id,
    act,
  ]);

  // The claim a covered raid leaves behind, relayed to the room and cleared.
  // The raid itself stays a pure engine mutation (it sets the field rather
  // than reaching for a socket it does not have), so this is the one place
  // the covered captain's own report of what the pirates would have taken
  // becomes a frame, which is also the one place it can be.
  //
  // Cleared before it is sent rather than after: a claim that the server
  // refuses, because the leg moved on or the contract is already claimed,
  // is still a raid that happened, and re-sending it every render would only
  // be a way to keep asking.
  useEffect(() => {
    const pending = state.game.pendingEscortClaim;
    if (!pending || !socket) return;
    act((g) => {
      g.pendingEscortClaim = null;
    });
    escort.claim(pending.contractId, pending.raidGold);
  }, [state.game.pendingEscortClaim, socket, act, escort.claim]);

  // The six effects: join the room channel on every reconnect, watch for
  // voyage conclusion, relay the engine's pending debt settlements, relay
  // the Word on the Docks claim, watch for the docks race resolution, and
  // watch for the Tidewatch surge flip.

  useEffect(() => {
    if (!socket || !authed) return;
    socket.emit("room:join", { roomId: room.id });
  }, [socket, authed, room.id]);

  const [voyageResult, setVoyageResult] = useState<VoyageResult | null>(null);
  // [H8: the reveal and the replay ledger] The harbor's cards, face up.
  // It arrives once, when the voyage concludes, and again for a captain
  // who reloads onto a finished table: the server hands the same payload
  // to a joining socket, which is the only way a browser that was not
  // there for the reveal can be given one.
  const [reveal, setReveal] = useState<VoyageReveal | null>(null);
  const [myLegacy, setMyLegacy] = useState<CaptainLegacySummary | null>(null);
  useEffect(() => {
    if (!socket) return;
    const onVoyageComplete = (data: VoyageResult) => {
      if (data.roomId !== room.id) return;
      setVoyageResult(data);
      api
        .getLegacy()
        .then(({ legacy }) => setMyLegacy(legacy))
        .catch(() => {});
      const mine = data.standings.find((s) => s.userId === me.id);
      if (mine?.crowned) {
        toast.success("Crowned Sea Master!", {
          description: `Highest Reputation in the harbor this voyage: ${mine.reputation}.`,
        });
        playSound("success");
      }
      if (mine?.brokersFavorUnlocked) {
        toast.success("🤝 Broker's Favor unlocked!", {
          description: `Renown Level ${BROKERS_FAVOR_UNLOCK_LEVEL} reached. The Broker owes you one, starting next voyage.`,
        });
      }
      for (const meritId of mine?.newMerits ?? []) {
        const merit = meritById(meritId);
        if (!merit) continue;
        toast.success(`Captain's Merit earned: ${merit.name}`, {
          description: merit.desc,
          icon: <MeritIcon id={merit.id} className="h-4 w-4" />,
        });
        playSound("confirm");
      }
    };
    const onRestarted = (data: { roomId: string }) => {
      if (data.roomId !== room.id) return;
      setVoyageResult(null);
      // The cards belonged to the voyage that just ended, so they go with
      // it. The next departure deals a fresh hand and the next conclusion
      // is what flips it.
      setReveal(null);
    };
    const onReveal = (data: VoyageReveal) => {
      if (data.roomId !== room.id) return;
      setReveal(data);
    };
    socket.on("room:voyage_complete", onVoyageComplete);
    socket.on("voyage:reveal", onReveal);
    socket.on("room:restarted", onRestarted);
    return () => {
      socket.off("room:voyage_complete", onVoyageComplete);
      socket.off("voyage:reveal", onReveal);
      socket.off("room:restarted", onRestarted);
    };
  }, [socket, room.id, me.id]);

  // Held in a ref so a fresh inline arrow from the page does not resubscribe
  // the handler below on every render of a screen that renders often.
  const leaveRef = useRef(onLeave);
  useEffect(() => {
    leaveRef.current = onLeave;
  }, [onLeave]);

  // The harbor stopped existing underneath its crew, which today means an
  // operator deleted the account hosting it. Every action from here would
  // be aimed at a room row that is already gone, so this captain is handed
  // back to the Lobby rather than left in the wreck. The reason goes up to
  // the page, which owns that Lobby and has somewhere to print it; a
  // notification raised here would leave with this component.
  useEffect(() => {
    if (!socket) return;
    const onClosed = (data: { roomId: string; reason?: string }) => {
      if (data.roomId !== room.id) return;
      leaveRef.current(data.reason);
    };
    socket.on("room:closed", onClosed);
    return () => {
      socket.off("room:closed", onClosed);
    };
  }, [socket, room.id]);

  // settleOutstandingDebts runs deep inside the endRound mutation, with no
  // way to call socket.emit itself, so it leaves the settlements it made on
  // this transient field for this effect to relay and clear.
  useEffect(() => {
    const pending = state.game._pendingDebtSettlements;
    if (!pending || pending.length === 0) return;
    for (const s of pending) aid.repay(s.lenderId, s.amount, s.debtId);
    act((g) => {
      g._pendingDebtSettlements = [];
    });
  }, [state.game._pendingDebtSettlements, aid.repay, act]);

  // Word on the Docks: completeOrder sets this the instant this captain's
  // own running total crosses the threshold; only the server knows whether
  // anyone else got there first, so this just reports the claim.
  useEffect(() => {
    if (!state.game._pendingDocksClaim || !socket) return;
    socket.emit("docks:claim", { roomId: room.id });
    act((g) => {
      g._pendingDocksClaim = undefined;
    });
  }, [state.game._pendingDocksClaim, socket, room.id, act]);

  // The docks race resolution. Only the winner's own client credits the
  // Gold; everyone else just hears about it.
  useEffect(() => {
    if (!socket) return;
    const onDocksWon = (data: {
      roomId: string;
      winnerId: string;
      winnerName: string;
      reward: number;
    }) => {
      if (data.roomId !== room.id) return;
      if (data.winnerId === me.id) {
        act((g, l) => claimWordOnTheDocksReward(g, l));
        toast.success("📣 Word on the Docks!", {
          description: `First to complete ${WORD_ON_THE_DOCKS_THRESHOLD} trade orders this voyage. +${data.reward} Gold.`,
        });
        notifications.push({
          icon: "📣",
          title: "Word on the Docks!",
          lines: [
            `You won the race to ${WORD_ON_THE_DOCKS_THRESHOLD} orders. +${data.reward} Gold.`,
          ],
          category: "docks",
        });
      } else {
        toast("📣 Word on the Docks", {
          description: `${data.winnerName} was first to complete ${WORD_ON_THE_DOCKS_THRESHOLD} trade orders this voyage.`,
        });
        notifications.push({
          icon: "📣",
          title: "Word on the Docks",
          lines: [
            `${data.winnerName} was first to ${WORD_ON_THE_DOCKS_THRESHOLD} orders.`,
          ],
          category: "docks",
        });
      }
    };
    socket.on("docks:won", onDocksWon);
    return () => {
      socket.off("docks:won", onDocksWon);
    };
  }, [socket, room.id, me.id, act, notifications.push]);

  // Tidewatch Alerts: every captain in the room applies the same flip and
  // sees the same toast.
  useEffect(() => {
    if (!socket) return;
    const onSurge = (data: { roomId: string }) => {
      if (data.roomId !== room.id) return;
      act((g, l) => applyTidewatchSurge(g, l));
      toast("🌊 Tidewatch Alert", {
        description:
          "The harbor takes notice of a bustling crew. One more cargo lot joins the Port Purchase board for the rest of this voyage.",
      });
      notifications.push({
        icon: "🌊",
        title: "Tidewatch Alert",
        lines: [
          `The harbor crossed ${TIDEWATCH_SURGE_THRESHOLD} combined Reputation.`,
          "One extra cargo lot joins every Port Purchase board.",
        ],
        category: "tidewatch",
      });
    };
    socket.on("tidewatch:surge", onSurge);
    return () => {
      socket.off("tidewatch:surge", onSurge);
    };
  }, [socket, room.id, act, notifications.push]);

  const handleRepayLoan = useCallback(
    (debtId: string) => {
      const debt = state.game.debts.find((d) => d.id === debtId);
      if (!debt) return;
      act((g, l) => repayLoan(g, debtId, l));
      aid.repay(debt.counterpartyId, debt.amount, debtId);
    },
    [act, aid, state.game.debts],
  );

  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Colorblind safe palette: threaded down to every panel that colors a
  // good's name. Stays client only.
  const { colorblindSafe, setColorblindSafe, colorFor } = useColorPreference();

  const myDetail = useCallback(
    (): PlayerDetailData => ({
      money: state.game.money,
      score: state.game.score,
      shipLevel: state.game.shipLevel,
      round: state.game.currentRound,
      phase: state.game.phase,
      gameOver: state.game.gameOver,
      inventory: state.game.inventory,
      workers: state.game.workers,
      equippedModules: state.game.equippedModules,
      logs: state.logs.slice(-30),
    }),
    [state.game, state.logs],
  );
  const playerDetail = usePlayerDetail(socket, room.id, myDetail);
  // Whatever this voyage has told this captain and no one else. Empty in
  // every Classic harbor, because nothing is ever sent there.
  const privateLog = usePrivateLog(socket, room.id);
  // [B4: the log surfaces] The room's own log, which is the other half of
  // the same pair and is read beside it at Dusk. It subscribes here, where
  // the socket is, but it asks the server for nothing until the screen
  // that draws it says so.
  const voyageLog = useVoyageLog(socket, room.id);
  // The other half of that contrast: the one thing this voyage tells
  // everyone. No objective is drawn in Classic, so the hook stays inert
  // and the panel renders nothing there. The fleet's size goes with it,
  // because the commission's quotas are scaled by it and only the room
  // knows what it was pinned to.
  const objective = useObjective(socket, room.id, state.game, ctx, act, seats);
  // [I1: the telemetry spine] What this voyage's records are missing
  // otherwise: the orders each leg dealt and filled, and how varied the
  // hold closed it. Nothing comes back from this, and nothing on the
  // screen reads it: it is the one subscription in this component that is
  // purely a measurement.
  useLegReport(socket, room.id, state.game);
  // [H6: the Manifest Audit] The harbor's vote and its finding, in one
  // hook because they are one interaction: the vote is what the Parley
  // phase offers, and the finding is what outlives it. Both are broadcast
  // and both are room stamped inside the hook. Inert in Classic, where no
  // vote can be called and none is ever sent.
  const audit = useAudit(socket, room.id, state.game, me.id);
  // [H7: Maroon and the Harbormaster] The second vote, and the one piece
  // of state in this component a client applies to its own books on
  // somebody else's word, which is why this hook is handed `act`. Inert in
  // Classic, where no rung exists, no vote can be called and no leaning
  // port can be named.
  const maroon = useMaroon(socket, room.id, state.game, me.id, act);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const [guideOpen, setGuideOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [rumorOpen, setRumorOpen] = useState(false);
  const [tutOpen, setTutOpen] = useState(false);
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  // [B3: standing orders] The captain's own record, edited in place.
  const [standingOpen, setStandingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [roomMessages, setRoomMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<
    Array<PublicUser & { joinedAt?: string }>
  >(room.members ?? []);

  // The live roster for spectator mode. The Bankruptcy panel uses this
  // to show a live standings board of captains still sailing. The
  // MembersPanel also calls useRoomRoster internally, but the two
  // subscriptions are harmless: both ride the same room:members and
  // game:status broadcasts, and React's reconciliation keeps them in
  // sync.
  const roster = useRoomRoster(socket, room.id, members);

  // The host can change (the original one left before the voyage even
  // started, say), so this is kept live from the room:members broadcast
  // rather than frozen at whatever it was when this component mounted.
  const [hostId, setHostId] = useState<string>(
    (room as { host?: PublicUser }).host?.id ?? me.id,
  );
  const [mutedUserIds, setMutedUserIds] = useState<string[]>([]);
  useEffect(() => {
    if (!socket) return;
    // Read defensively, field by field, even though the server always
    // writes all three: this is a wire frame, and a client that has
    // reloaded into a slightly older bundle should read the part it can
    // rather than drop the whole roster over a field it does not expect.
    const onMembers = (data: RoomMembersPayload) => {
      if (data.roomId !== room.id) return;
      if (data.hostId) setHostId(data.hostId);
      if (data.members) setMembers(data.members);
      if (data.mutedUserIds) setMutedUserIds(data.mutedUserIds);
    };
    socket.on("room:members", onMembers);
    return () => {
      socket.off("room:members", onMembers);
    };
  }, [socket, room.id]);
  const isHost = hostId === me.id;
  const amIMuted = mutedUserIds.includes(me.id);

  // DM state
  const [dmTarget, setDmTarget] = useState<PublicUser | null>(null);
  const [dmHistory, setDmHistory] = useState<ChatMessage[]>([]);
  // Every direct thread this captain is part of in this harbor, as the
  // server hydrated them on join and as they arrive live. Session only, so
  // it dies with the room like the harbor log beside it.
  const [dmSession, setDmSession] = useState<ChatMessage[]>([]);

  // The session conversation, sent by the server when this captain joined.
  // It is the room's own memory, so this is the only place it can come from:
  // nothing about a voyage is written down.
  useEffect(() => {
    if (!socket) return;
    const onHistory = (data: {
      roomId: string;
      harbor: ChatMessage[];
      direct: ChatMessage[];
    }) => {
      if (data.roomId !== room.id) return;
      setRoomMessages(data.harbor);
      setDmSession(data.direct);
    };
    // The host wiped the voyage. The words that belonged to it go with it,
    // and these seeds follow, so switching threads afterwards cannot bring
    // any of them back.
    const onCleared = (data: { roomId: string }) => {
      if (data.roomId !== room.id) return;
      setRoomMessages([]);
      setDmSession([]);
    };
    socket.on("chat:history", onHistory);
    socket.on("chat:cleared", onCleared);
    return () => {
      socket.off("chat:history", onHistory);
      socket.off("chat:cleared", onCleared);
    };
  }, [socket, room.id]);

  // Who is in this harbor right now. It decides which of the two places a
  // private thread is read from.
  const memberIds = useMemo(() => new Set(members.map((m) => m.id)), [members]);

  // The thread the DM tab is showing: the session lines this captain
  // exchanged with that one, plus the stored thread when the other captain
  // is outside the harbor. Memoised because the panel reseeds from this
  // array's identity, so handing it a fresh array every render would wipe
  // the conversation and seed it again endlessly.
  const dmThread = useMemo(() => {
    if (!dmTarget) return [];
    const session = dmSession.filter(
      (m) => m.sender.id === dmTarget.id || m.recipient?.id === dmTarget.id,
    );
    return [...dmHistory, ...session].sort((a, b) =>
      a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
    );
  }, [dmSession, dmHistory, dmTarget]);

  // Which chat tab is showing, lifted out of the Tabs component itself so
  // a notification click can jump the user straight to the right one.
  const [chatTab, setChatTab] = useState<"room" | "dm">("room");

  // Load the room's members on mount. The conversation is deliberately not
  // fetched with them: a session's chat is held in the server's memory and
  // arrives over the socket on join, because there is no stored history to
  // ask for.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { room: detail } = await api.getRoom(room.id);
        if (!alive) return;
        setMembers(detail.members);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [room.id]);

  // Pop up a notification for every action's worth of new ledger entries,
  // grouped together.
  useEffect(() => {
    if (!state.loaded) return;
    const lines = state.newLines.filter((l) => l.trim().length > 0);
    if (lines.length === 0) return;
    notifications.push({
      icon: "📜",
      title: "Captain's Ledger",
      lines,
    });
  }, [state.newLines, state.loaded, notifications.push]);

  const openDmRef = useCallback(
    async (user: PublicUser) => {
      if (user.id === me.id) return;
      setDmTarget(user);
      // A captain in this harbor is talked to through the session's own in
      // memory thread, which arrives over the socket and cannot be fetched.
      // Only a captain outside it, in the Lobby, has a stored thread, and
      // that one is fetched exactly as it always was.
      if (memberIds.has(user.id)) {
        setDmHistory([]);
        return;
      }
      try {
        const { messages } = await api.getDmHistory(user.id);
        setDmHistory(messages);
      } catch {
        setDmHistory([]);
      }
    },
    [me.id, memberIds],
  );
  // Reference the openDm declared above so the chat notification effect
  // keeps the stable identity; this alias keeps the existing call sites
  // (DM tab onPick, etc.) readable without reorganising the JSX.
  const openDm = openDmRef;

  // Every room/DM message pops up as its own notification too, regardless
  // of which chat tab is currently open. Clicking it jumps to the
  // conversation it came from.
  useEffect(() => {
    if (!socket) return;
    const onRoomMsg = (data: { roomId: string; message: ChatMessage }) => {
      if (data.roomId !== room.id || data.message.sender.id === me.id) return;
      notifications.push({
        icon: "⚓",
        title: `${data.message.sender.displayName} · Harbor`,
        lines: [data.message.content],
        onActivate: () => setChatTab("room"),
        category: "room",
      });
    };
    const onDm = (message: ChatMessage) => {
      if (message.sender.id === me.id) return;
      notifications.push({
        icon: "✉️",
        title: `${message.sender.displayName} · Direct`,
        lines: [message.content],
        onActivate: () => {
          setChatTab("dm");
          openDm(message.sender);
        },
      });
    };
    socket.on("chat:room", onRoomMsg);
    socket.on("chat:dm", onDm);
    return () => {
      socket.off("chat:room", onRoomMsg);
      socket.off("chat:dm", onDm);
    };
  }, [socket, room.id, me.id, notifications.push, openDm]);

  // First time tutorial hint.
  const autoTutorialFired = useRef(false);
  useEffect(() => {
    if (autoTutorialFired.current) return;
    const seen =
      typeof window !== "undefined"
        ? localStorage.getItem(TUTORIAL_SEEN_KEY)
        : null;
    if (!seen && state.loaded && state.game.phase === "harbor") {
      autoTutorialFired.current = true;
      const t = setTimeout(() => setTutOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [state.loaded, state.game.phase]);

  const handleTutorialOpenChange = useCallback((open: boolean) => {
    setTutOpen(open);
    if (!open && typeof window !== "undefined") {
      try {
        localStorage.setItem(TUTORIAL_SEEN_KEY, "1");
      } catch {
        /* storage unavailable; the guide simply offers itself again */
      }
    }
  }, []);

  const handleSave = useCallback(async () => {
    try {
      await api.saveGameState(room.id, state.game);
      toast.success("Progress saved", {
        description: "Your voyage is recorded on the server.",
      });
    } catch {
      toast.error("Save failed", {
        description: "Could not reach the harbour master.",
      });
    }
  }, [room.id, state.game]);

  const handleNext = useCallback(() => {
    // Leaving a phase settles nothing about the barter board any more: an
    // offer outlives the phase it was posted in and is returned to its owner
    // when the board itself drops it, wherever the voyage has got to by then.
    //
    // The departure is leavePhase, which is the seat's own work and then the
    // lap's step off it, and it is the same one the room's clock runs for a
    // captain who is not there. It used to be a bare nextPhase, which moves a
    // captain out of most seats but names no work for the ones that need it:
    // at Dawn it does nothing at all, so a captain who pressed this readied
    // the room into an advance nobody could carry out. The press is refused
    // instead (markReady returns false), and the captain is told why rather
    // than left pressing a button that looks like it worked.
    if (!phaseSync.markReady((g, l) => leavePhase(g, ctx, l))) {
      toast.error("This seat is not left by pressing Next Phase", {
        description: leaveRefusal(state.game.phase),
      });
    }
  }, [phaseSync, ctx, state.game.phase]);

  const handleRestart = useCallback(() => {
    if (!isHost) {
      toast.error("Only the host can restart the voyage");
      return;
    }
    setRestartConfirmOpen(true);
  }, [isHost]);

  // Keyboard shortcuts (preserved from original).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        handleSave();
      } else if (e.ctrlKey && e.key === "n") {
        e.preventDefault();
        handleNext();
      } else if (e.ctrlKey && e.key === "r") {
        e.preventDefault();
        handleRestart();
      } else if (e.key === "F1") {
        e.preventDefault();
        setGuideOpen(true);
      } else if (e.key === "?" || e.key === "F2") {
        e.preventDefault();
        setShortcutHelpOpen(true);
      } else if (e.key === "Escape") {
        setShortcutHelpOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, handleNext, handleRestart]);

  async function handleLeave() {
    try {
      await flush();
    } catch {
      /* ignore */
    }
    try {
      await api.leaveRoom(room.id);
      socket?.emit("room:leave", { roomId: room.id });
    } catch {
      /* ignore */
    }
    onLeave();
  }

  // Renown (Captain's Legacy) is server side, account wide data. Fetched
  // fresh on every click so a captain who just finished another voyage
  // elsewhere shows their current standing.
  const [otherLegacy, setOtherLegacy] = useState<
    Record<string, CaptainLegacySummary>
  >({});
  const handleSelectPlayer = useCallback(
    (userId: string) => {
      setSelectedPlayerId(userId);
      playerDetail.requestDetail(userId);
      api
        .getLegacyFor(userId)
        .then(({ legacy }) =>
          setOtherLegacy((prev) => ({ ...prev, [userId]: legacy })),
        )
        .catch(() => {});
    },
    [playerDetail],
  );

  function copyCode() {
    navigator.clipboard?.writeText(room.code).then(
      () => toast.success("Room code copied", { description: room.code }),
      () => {},
    );
  }

  const onlineInLobby = onlineUsers.filter((u) => u.id !== me.id);
  // My own Renown level drives the Partial Sight trust threshold for the
  // MembersPanel peek button. Falls back to 1 while the legacy is loading.
  const myRenownLevel = myLegacy
    ? myLegacy.renownLevel
    : state.game.renownLevel || renownProgress(0).level;

  if (!state.loaded) {
    return (
      <div className="pm-canvas min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground flex items-center gap-2">
          <Ship className="h-5 w-5 animate-pulse text-brand" /> Weighing anchor…
        </div>
      </div>
    );
  }

  // What both chats in this room need to carry the shared offer board. The
  // harbor thread offers to the harbor; a private thread with a captain in
  // the room offers to that captain alone, and one with a captain outside it
  // carries no trade surface, since an offer can only be aimed at a captain
  // the board can reach.
  const chatTrade: ChatTrade = {
    barter,
    game: state.game,
    act,
    members,
    colorFor,
  };
  const dmTrade =
    dmTarget && memberIds.has(dmTarget.id)
      ? { ...chatTrade, defaultTarget: dmTarget }
      : undefined;

  // On a wide window the room is an app shell: it takes the window's own
  // height and never grows past it, so the three columns below can each
  // scroll inside themselves and the rails stay where the captain left
  // them. Below the lg breakpoint it is an ordinary document again, with
  // the page doing the scrolling, because a narrow window has no room for
  // fixed rails and needs the whole thing to move as one.
  return (
    <div className="pm-canvas min-h-screen w-full flex flex-col lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden">
      <HarborTopBar
        room={room}
        memberCount={members.length}
        onCopyCode={copyCode}
        game={state.game}
        connected={connected}
        authed={authed}
        colorblindSafe={colorblindSafe}
        onToggleColorblind={() => setColorblindSafe(!colorblindSafe)}
        soundOn={soundOn}
        onToggleSound={toggleSound}
        onOpenSettings={() => setSettingsOpen(true)}
        unreadCount={notifications.unreadCount}
        onToggleNotifications={() => {
          setNotificationsOpen((v) => !v);
          notifications.markAllRead();
        }}
        me={me}
        onLeave={handleLeave}
      />

      {/* Main layout. A column on a wide window, so the band below can be
          measured against the window rather than against its own content
          and the columns under it can take whatever is left. Its own cap is
          wider than the lobby's, because the lobby is a list of harbors and
          this is a board: on a large monitor the three columns would
          otherwise stop growing at the width a two column screen already
          has, which is the one place a captain gets nothing for the extra
          glass. */}
      <main className="flex-1 min-h-0 px-3 sm:px-5 pb-4 max-w-[1760px] w-full mx-auto flex flex-col gap-3">
        {/* The table band: everything the whole harbor shares, above the
            three columns rather than inside one of them. It is capped at a
            share of the window on a wide screen and scrolls inside that cap.
            Uncapped it is what pushed the columns off the fold, because a
            voyage carrying a draft and three notices stacks half a window of
            strips before the first column starts. The draft leads the band
            rather than following the ticker: it is the one entry here with a
            deadline on it, and reading it should never mean scrolling for
            it. */}
        <div className="shrink-0 space-y-3 lg:max-h-[45vh] lg:overflow-y-auto pm-scroll lg:pr-1">
          {/* [D7: the draft, and switching] The deal, at the very top of the
              voyage's own column because of when it happens rather than what
              it is: it is dealt as the voyage leaves the dock, over the
              opening leg, so a captain who is reading this panel is also
              reading their first market behind it. Renders nothing at all
              outside a live draft (see PathDraft), and the hook holding the
              hand is fed by the server rather than by anything on this
              screen. */}
          {draft.view && (
            <PathDraft
              view={draft.view}
              error={draft.error}
              onKeep={draft.keep}
              onDismissError={draft.clearError}
            />
          )}
          <FleetTicker
            socket={socket}
            roomId={room.id}
            me={me}
            initialMembers={members}
          />
          {/* The table's notices. They sit in a wrapping row rather than in a
              stack, so two of them cost one row instead of two, and they wrap
              rather than sharing a fixed grid so a single live notice keeps
              the full width the strips were drawn for. The row styles its own
              children rather than wrapping each one: a wrapper would still be
              in the layout on a voyage with nothing to say, and the gap
              between two empty wrappers is a band of nothing above the
              columns. The four are the row's own children, so each one that
              draws nothing simply is not there. */}
          <div className="flex flex-wrap items-start gap-3 [&>*]:grow [&>*]:basis-[420px] [&>*]:min-w-[280px]">
            {/* The voyage's public objective, owed by the whole harbor
                rather than by the captain whose column it would otherwise
                sit in. Renders nothing at all in Classic. */}
            <ObjectivePanel
              game={state.game}
              objective={objective.objective}
              progress={objective.progress}
              deliverable={objective.deliverable}
              onDeliver={objective.deliver}
            />
            {/* Whatever the harbor voted to open, and nothing at all in a
                voyage that has not audited anyone. It sits under the
                commission because it is the other thing the whole table
                shares, and it stays for the rest of the voyage: the argument
                about what it means is the feature. */}
            <AuditRevealStrip reveal={audit.reveal} />
            {/* The harbor's heavier vote, and the market condition it leaves
                behind. Both sit in the same place for the same reason: they
                belong to the table rather than to a column, and the market
                strip has to be readable while a captain is pricing a card.
                Each renders nothing at all in a voyage neither has touched. */}
            <MaroonResultStrip result={maroon.result} />
            <PortShiftStrip
              shift={maroon.shift}
              round={state.game.currentRound}
            />
          </div>
        </div>
        {/* The three columns, and the widths they are allowed. The two rails
            are rails: they hold readings and channels rather than the board
            itself, so they are held to a share of the window that leaves the
            stage the rest of it. The clamps are narrower than the pair they
            replaced by about a hundred and fifty pixels at a middling
            window, which is the difference between a market card that fits
            its own goods row and one that wraps every line. This clamp is a
            share of the window, and it is the last width on this screen that
            reads that way: what the boards inside the stage measure
            themselves against is the stage (see the container on it below),
            because a card is as wide as its column and not as wide as the
            glass. */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-rows-1 lg:grid-cols-[clamp(216px,19vw,268px)_minmax(0,1fr)_clamp(228px,20vw,288px)] gap-3">
          {/* Left: the captain's own rail. It takes the height of the row
              and scrolls inside itself, the same shape ./game/GameStatusPanel
              is built for: the numbers a captain checks constantly stay in
              one place while everything beside them moves.

              What this captain sails as is the first line of it, above the
              voyage header, because an identity is not a panel a captain
              scrolls to: it dresses everything below it, and the stage it
              used to sit in is the table's board rather than the captain's
              own. The chip draws nothing at all in a harbor with the draft
              switched off, so the rail still opens on the voyage header. */}
          <div className="order-2 lg:order-1 lg:min-h-0">
            <div className="pm-glass h-full rounded-2xl p-3 lg:min-h-0 flex flex-col gap-2.5">
              <PathChip
                game={state.game}
                error={draft.error}
                onSwitch={draft.switchPath}
                onDismissError={draft.clearError}
              />
              <div className="flex-1 min-h-0">
                <GameStatusPanel
                  game={state.game}
                  logs={state.logs}
                  onRepayLoan={handleRepayLoan}
                  convoy={convoy}
                  myUserId={me.id}
                  colorFor={colorFor}
                />
              </div>
            </div>
          </div>

          {/* Center: the stage, and the row of controls that acts on it.
              On a wide window the stage scrolls inside its own column and
              the controls stay under it, so pressing the next phase never
              means scrolling to find the button first. Below the
              breakpoint the bar leads the column, because a narrow window
              has one scroll and the bar is the thing a thumb reaches for.
              The bar is the same component either way; only its place in
              the column changes. */}
          <div className="order-1 lg:order-2 min-w-0 flex flex-col gap-3 lg:min-h-0">
            {/* The bar and the key hints under it, in one block. The hints
                belong to the controls the way a legend belongs to a map, so
                they travel with the bar rather than with the board, and this
                is also what keeps them legible: inside the stage's scroller
                they were the one thing under a phase panel that fills the
                stage, which put them exactly one row below the fold on every
                screen whose board was short enough to fit. A hint nobody can
                see is not a hint. */}
            <div className="shrink-0 lg:order-2 space-y-2">
              <GameControlPanel
                game={state.game}
                saving={state.saving}
                isHost={isHost}
                onSetSail={phaseSync.startGame}
                onNextPhase={handleNext}
                onGuide={() => setGuideOpen(true)}
                onSave={handleSave}
                onRestart={handleRestart}
                waiting={phaseSync.waiting}
                readyCount={phaseSync.readyCount}
                requiredCount={phaseSync.requiredCount}
                clock={phaseSync.phaseClock}
                onStandingOrders={() => setStandingOpen(true)}
                onCancelReady={phaseSync.cancelReady}
              />
              <ShortcutLegend onOpen={() => setShortcutHelpOpen(true)} />
            </div>
            {/* The stage, and the one thing on this screen the boards
                inside it are allowed to measure themselves against. It is a
                container rather than a plain scroller because a phase board
                laid out against the window is a board laid out for a width
                it does not have: the market board used to read the window's
                own breakpoint and deal three columns into a column half the
                width of a phone's, so every card wrapped every line. The
                boards ask this instead, and a board in a modal asks the
                window, which is what a modal is as wide as. */}
            <div className="@container space-y-3 lg:order-1 lg:flex-1 lg:min-h-0 lg:overflow-y-auto pm-scroll lg:pr-1">
              <GamePhasePanel
                game={state.game}
                ctx={ctx}
                act={act}
                members={members}
                phaseSync={phaseSync}
                barter={barter}
                aid={aid}
                backing={backing}
                escort={escort}
                refit={refit}
                bazaar={bazaar}
                audit={audit}
                maroon={maroon}
                voyageLog={voyageLog}
                privateLog={privateLog}
                me={me}
                room={{
                  id: room.id,
                  code: room.code,
                  name: room.name,
                  hostId,
                }}
                voyageResult={voyageResult}
                reveal={reveal}
                myLegacy={myLegacy}
                onRestart={handleRestart}
                onRumorBoardOpen={() => setRumorOpen(true)}
                onTutorialOpen={() => setTutOpen(true)}
                colorFor={colorFor}
                roster={roster}
              />
              {/* The captain's own card. It sits at the foot of the stage
                  rather than up among the controls, because it is
                  something a captain reads about their own voyage and not
                  something they press: the bar under the stage holds the
                  buttons, and the reading is what scrolls. It draws
                  nothing at all in a harbor that has not dealt one.

                  The peer ledger is the one thing a card shows that the
                  server did not send: it is read from the captain's own
                  voyage, on the captain's own screen, and no drawer holds
                  it, which is why the card asks for it rather than it
                  travelling on the private entry. Only a Broker's card
                  prints it. */}
              {privateLog.map((entry, index) => (
                <PrivateCard
                  key={`${entry.kind}:${index}`}
                  entry={entry}
                  peerTradeProfit={state.game.peerTradeProfit}
                />
              ))}
            </div>
          </div>

          {/* Right: roster + chat, last of the three columns at every width.
              The chat used to sit at the very bottom of the page, under the
              phase panel and the roster, which put it three screens down on
              a narrow window and left captains reading it as missing. The
              FleetTicker above already carries the roster at these widths,
              so the pair can follow the stage rather than opening with it.

              On a wide window this is the column a captain scrolls least and
              reads most, so it holds still: the roster keeps a share of the
              column and the chat takes the rest, and if the two together need
              more room than the column has, the column scrolls rather than
              either panel being cut off at the knee. Each panel still scrolls
              inside itself, which is the behaviour the two of them were
              always meant to have and the reason seeing them travel with the
              page read as wrong. */}
          <div className="order-3 min-w-0 flex flex-col gap-3 lg:min-h-0 lg:overflow-y-auto pm-scroll lg:pr-1">
            <div className="h-[320px] shrink-0 lg:h-[26vh] lg:min-h-[150px] lg:max-h-[320px]">
              <MembersPanel
                socket={socket}
                roomId={room.id}
                me={me}
                initialMembers={members}
                hostId={hostId}
                onSelectPlayer={handleSelectPlayer}
                myRenownLevel={myRenownLevel}
              />
            </div>
            <div className="pm-glass rounded-2xl overflow-hidden flex flex-col h-[380px] lg:h-auto lg:flex-1 lg:min-h-[260px]">
              <Tabs
                value={chatTab}
                onValueChange={(v) => setChatTab(v as "room" | "dm")}
                className="flex flex-col h-full"
              >
                {/* The panel names itself. The tabs below say which channel
                    is open, and without a head above them the harbor chat
                    was only ever legible as a tab label rather than as a
                    widget a captain could look for. */}
                <div className="flex items-center gap-2 px-3 pt-3">
                  <MessageCircle className="h-3.5 w-3.5 text-chat" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-chat">
                    {chatTab === "room" ? "Harbor chat" : "Direct messages"}
                  </span>
                </div>
                <TabsList className="grid grid-cols-2 m-2 mb-0">
                  <TabsTrigger value="room">
                    <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Harbor
                  </TabsTrigger>
                  <TabsTrigger value="dm">
                    <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Direct
                  </TabsTrigger>
                </TabsList>
                {/* Both channels stay mounted. The panel holds the lines it
                    was handed live, so unmounting the harbor on the way to
                    Direct would drop every line said while the captain was
                    looking at the other one, and switching back would show
                    the log as it stood when the voyage started. The room's
                    history reaches this panel once, on join, so there is
                    nothing to re seed it from. */}
                <TabsContent
                  value="room"
                  forceMount
                  className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden"
                >
                  <ChatPanel
                    socket={socket}
                    me={me}
                    mode="room"
                    roomId={room.id}
                    initialMessages={roomMessages}
                    disabled={amIMuted}
                    trade={chatTrade}
                  />
                </TabsContent>
                <TabsContent
                  value="dm"
                  forceMount
                  className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden"
                >
                  <DmTab
                    socket={socket}
                    me={me}
                    target={dmTarget}
                    history={dmThread}
                    trade={dmTrade}
                    candidates={[
                      ...members.map((m) => ({ ...m, roomId: room.id })),
                      ...onlineInLobby,
                    ]}
                    onPick={openDm}
                    onClear={() => setDmTarget(null)}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </main>

      <GuideModal
        open={guideOpen}
        onOpenChange={setGuideOpen}
        mode={state.game.mode}
        difficulty={state.game.difficulty}
      />
      <TipsModal
        open={tipsOpen}
        onOpenChange={setTipsOpen}
        mode={state.game.mode}
        difficulty={state.game.difficulty}
      />
      <RumorBoardModal
        open={rumorOpen}
        onOpenChange={setRumorOpen}
        game={state.game}
        onBuy={() => act((g, l) => purchaseIntel(g, l))}
      />
      <TutorialModal
        open={tutOpen}
        onOpenChange={handleTutorialOpenChange}
        mode={state.game.mode}
        difficulty={state.game.difficulty}
      />
      {/* [B3: standing orders] The form writes the record the way the
          load heal does, through the normalizer, rather than trusting
          what the controls composed. The controls can only build the
          closed vocabulary, so this is not a guard against them: it is
          what keeps one shape of the record on the voyage whether it
          arrived from a form, from a save, or from a restart. */}
      <StandingOrdersModal
        open={standingOpen}
        onOpenChange={setStandingOpen}
        game={state.game}
        onChange={(orders) =>
          act((g) => {
            g.standingOrders = normalizeStandingOrders(orders);
          })
        }
      />
      <RestartConfirmModal
        open={restartConfirmOpen}
        onOpenChange={setRestartConfirmOpen}
        onConfirm={phaseSync.restartVoyage}
      />
      <NotificationHistoryModal
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        items={notifications.items}
      />
      <NotificationCenter
        current={notifications.current}
        dismiss={notifications.dismissCurrent}
      />
      <PlayerDetailModal
        open={selectedPlayerId !== null}
        onOpenChange={(v) => {
          if (!v) setSelectedPlayerId(null);
        }}
        player={
          selectedPlayerId
            ? (members.find((m) => m.id === selectedPlayerId) ?? null)
            : null
        }
        isMe={selectedPlayerId === me.id}
        difficulty={state.game.difficulty}
        colorFor={colorFor}
        detail={
          selectedPlayerId ? playerDetail.detail[selectedPlayerId] : undefined
        }
        loading={
          selectedPlayerId
            ? Boolean(playerDetail.loading[selectedPlayerId])
            : false
        }
        legacy={selectedPlayerId ? otherLegacy[selectedPlayerId] : undefined}
        myDetail={state.loaded ? state.game : undefined}
        myPlayer={me}
      />

      <KeyboardShortcutHelp
        open={shortcutHelpOpen}
        onOpenChange={setShortcutHelpOpen}
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
      />

      {/* Floating help when bankrupt / endgame */}
      {(state.game.phase === "bankruptcy" ||
        state.game.phase === "endgame") && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setTipsOpen(true)}
          className="fixed bottom-5 right-5 pm-grad-advisor rounded-full h-12 w-12 flex items-center justify-center shadow-lg z-40"
          title="Strategy tips"
        >
          <LifeBuoy className="h-5 w-5" />
        </motion.button>
      )}
    </div>
  );
}
