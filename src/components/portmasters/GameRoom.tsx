"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  api,
  type ChatMessage,
  type PublicUser,
  type RoomDetail,
} from "@/lib/api";
import type { VoyageResult } from "@/types/realtime";
import type { CaptainLegacySummary } from "@/lib/game/legacy";
import {
  BROKERS_FAVOR_UNLOCK_LEVEL,
  WORD_ON_THE_DOCKS_THRESHOLD,
} from "@/lib/game/constants";
import { meritById } from "@/lib/game/merits";
import { useRealtime } from "@/lib/use-realtime";
import { useGameSession } from "@/lib/use-game-session";
import { usePhaseSync } from "@/lib/use-phase-sync";
import {
  usePlayerDetail,
  type PlayerDetailData,
} from "@/lib/use-player-detail";
import { useBarter, type BarterOffer } from "@/lib/use-barter";
import {
  useAid,
  type GrantedLoan,
  type RepaidLoan,
  type RedirectedLoanClosed,
} from "@/lib/use-aid";
import {
  useBacking,
  type BackingCovered,
  type BackingResolved,
  type OutstandingLoan,
} from "@/lib/use-backing";
import {
  useConvoy,
  type VentureOutcome,
  type VentureSettlement,
} from "@/lib/use-convoy";
import { useNotificationCenter } from "@/lib/use-notifications";
import { PlayerDetailModal } from "./game/GameModals";
import { GameStatusPanel } from "./game/GameStatusPanel";
import { GamePhasePanel } from "./game/GamePhasePanel";
import { GameControlPanel } from "./game/GameControlPanel";
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
import { AgeBanner } from "./AgeBanner";
import { ActionSuggester } from "./ActionSuggester";
import { KeyboardShortcutHelp } from "./KeyboardShortcutHelp";
import { SettingsModal } from "./SettingsModal";
import { ChatPanel, type ChatTrade } from "./ChatPanel";
import { Avatar, MeritIcon, OnlineDot, Pill } from "./shared";
import { NotificationCenter } from "./NotificationCenter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Anchor,
  DoorOpen,
  Copy,
  Users,
  MessageCircle,
  Ship,
  LifeBuoy,
  Bell,
  Palette,
  Volume2,
  VolumeX,
  Settings,
} from "lucide-react";
import { cn, normalizeRoomName } from "@/lib/utils";
import { useColorPreference } from "@/lib/use-color-preference";
import { useSound } from "@/lib/use-sound";
import { useRoomRoster } from "@/lib/use-room-roster";
import { renownProgress } from "@/lib/game/legacy";
import {
  acceptBarterOffer,
  applyTidewatchSurge,
  claimWordOnTheDocksReward,
  clearRedirectedLoan,
  contributeToVenture,
  grantLoan,
  nextPhase,
  pledgeBacking,
  purchaseIntel,
  receiveBackedCoverage,
  receiveBackingOutcome,
  receiveLoan,
  receiveRepayment,
  receiveVentureSettlement,
  refundBarterOffer,
  repayLoan,
  settleBarterTrade,
} from "@/lib/game/engine";

// Browser scoped: the onboarding guide is a "you have played this before"
// signal, not per room state, so joining a second harbor does not replay it.
const TUTORIAL_SEEN_KEY = "portmasters_tutorial_seen";

export function GameRoom({
  me,
  room,
  onLeave,
}: {
  me: PublicUser;
  room:
    | RoomDetail
    | (PublicUser & {
        id: string;
        code: string;
        name: string;
        isPublic: boolean;
        host: PublicUser;
        memberCount: number;
        members: Array<PublicUser & { joinedAt: string }>;
      });
  onLeave: () => void;
}) {
  const { socket, connected, authed, onlineUsers } = useRealtime(me);
  const {
    enabled: soundOn,
    toggle: toggleSound,
    play: playSound,
    volume: soundVolume,
    setVolume: setSoundVolume,
  } = useSound();
  const { state, act, ctx, flush, startingGoldBonus } = useGameSession(
    room.id,
    socket,
    true,
    me.id,
  );
  const phaseSync = usePhaseSync(
    room.id,
    socket,
    state.game,
    act,
    authed,
    me.id,
    startingGoldBonus,
  );
  // Notification center needs to be initialized before the relay
  // callbacks and effects that call notifications.push, otherwise the
  // lint rule flags it as accessed before declaration.
  const notifications = useNotificationCenter();

  // The nine relay callbacks. Each translates a realtime event into a local
  // engine mutation: a barter trade closes, a loan lands, a backer covers a
  // shortfall, a convoy venture settles. Every callback is the same shape:
  // figure out which side of the event this captain is on, then run the
  // matching engine function inside `act`.
  const onBarterFulfilled = useCallback(
    (offer: BarterOffer, accepterId: string) => {
      if (accepterId === me.id) {
        act((g, l) =>
          acceptBarterOffer(
            g,
            offer.requestItem,
            offer.requestAmount,
            offer.offerItem,
            offer.offerAmount,
            l,
          ),
        );
      } else if (offer.fromUserId === me.id) {
        act((g, l) =>
          settleBarterTrade(g, offer.requestItem, offer.requestAmount, l),
        );
      }
    },
    [act, me.id],
  );
  // Refunds that arrived before this captain's voyage was loaded. The board
  // hydrates over the socket, which can be quicker than the save arriving
  // over REST, and anything applied while state.game is still the placeholder
  // is thrown away the moment the real save lands. They wait here instead and
  // are applied together once it has. The trade this makes is deliberate:
  // holding them costs a gift of goods in the one case where the room is
  // restarted inside that same moment, while dropping them loses a captain's
  // escrow silently, which is the worse of the two.
  const pendingRefunds = useRef<BarterOffer[]>([]);
  const onBarterRefund = useCallback(
    (offer: BarterOffer) => {
      if (!state.loaded) {
        pendingRefunds.current.push(offer);
        return;
      }
      act((g, l) =>
        refundBarterOffer(g, offer.offerItem, offer.offerAmount, l),
      );
    },
    [act, state.loaded],
  );
  const barter = useBarter(
    socket,
    room.id,
    me.id,
    onBarterFulfilled,
    onBarterRefund,
  );
  useEffect(() => {
    if (!state.loaded || pendingRefunds.current.length === 0) return;
    const held = pendingRefunds.current;
    pendingRefunds.current = [];
    act((g, l) => {
      for (const offer of held)
        refundBarterOffer(g, offer.offerItem, offer.offerAmount, l);
    });
  }, [state.loaded, act]);

  const onAidGranted = useCallback(
    (loan: GrantedLoan, role: "borrower" | "helper") => {
      if (role === "borrower") {
        act((g, l) =>
          receiveLoan(
            g,
            {
              id: loan.requestId,
              fromUserId: loan.helperId,
              fromName: loan.helperName,
              amount: loan.amount,
            },
            l,
          ),
        );
      } else {
        act((g, l) =>
          grantLoan(
            g,
            {
              id: loan.requestId,
              borrowerId: loan.borrowerId,
              borrowerName: loan.borrowerName,
              amount: loan.amount,
            },
            l,
          ),
        );
      }
    },
    [act],
  );
  const onAidRepaid = useCallback(
    (loan: RepaidLoan) => {
      act((g, l) =>
        receiveRepayment(g, loan.debtId, loan.amount, loan.fromName, l),
      );
    },
    [act],
  );
  const onAidRedirectedClosed = useCallback(
    (closed: RedirectedLoanClosed) => {
      act((g, l) =>
        clearRedirectedLoan(g, closed.debtId, closed.redirectedToName, l),
      );
    },
    [act],
  );
  const aid = useAid(
    socket,
    room.id,
    me.id,
    onAidGranted,
    onAidRepaid,
    onAidRedirectedClosed,
  );

  const onBackingAccepted = useCallback(
    (loan: OutstandingLoan) => {
      if (loan.backedAmount)
        act((g, l) => pledgeBacking(g, loan.backedAmount!, l));
    },
    [act],
  );
  const onBackingResolved = useCallback(
    (resolved: BackingResolved) => {
      act((g, l) =>
        receiveBackingOutcome(
          g,
          resolved.refundAmount,
          resolved.calledAmount,
          l,
        ),
      );
    },
    [act],
  );
  const onBackingCovered = useCallback(
    (covered: BackingCovered) => {
      act((g, l) =>
        receiveBackedCoverage(
          g,
          covered.amount,
          covered.backerName,
          covered.borrowerName,
          l,
        ),
      );
    },
    [act],
  );
  const backing = useBacking(
    socket,
    room.id,
    me.id,
    onBackingAccepted,
    onBackingResolved,
    onBackingCovered,
  );

  const onVentureContributed = useCallback(
    (_ventureId: string, accepted: number) => {
      act((g, l) => contributeToVenture(g, accepted, l));
    },
    [act],
  );
  const onVentureSettled = useCallback(
    (
      _ventureId: string,
      outcome: VentureOutcome,
      settlements: VentureSettlement[],
    ) => {
      const mine = settlements.find((s) => s.userId === me.id);
      if (!mine) return;
      act((g, l) => receiveVentureSettlement(g, mine.amount, l, outcome));
      if (outcome === "filled") {
        toast.success("⚓ Convoy Venture filled!", {
          description: `Your share: +${mine.amount} Gold.`,
        });
        playSound("coin");
      } else if (outcome === "failed") {
        toast("⚓ Convoy Venture missed its deadline", {
          description: `Partial refund: +${mine.amount} Gold.`,
        });
        playSound("warn");
      } else {
        toast("⚓ Convoy Venture cancelled", {
          description: `Another venture in the harbor already claimed this voyage's one chance. Full refund: +${mine.amount} Gold.`,
        });
      }
    },
    [act, me.id, playSound],
  );
  const convoy = useConvoy(
    socket,
    room.id,
    onVentureContributed,
    onVentureSettled,
  );

  // The six effects: join the room channel on every reconnect, watch for
  // voyage conclusion, relay the engine's pending debt settlements, relay
  // the Word on the Docks claim, watch for the docks race resolution, and
  // watch for the Tidewatch surge flip.

  useEffect(() => {
    if (!socket || !authed) return;
    socket.emit("room:join", { roomId: room.id });
  }, [socket, authed, room.id]);

  const [voyageResult, setVoyageResult] = useState<VoyageResult | null>(null);
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
    };
    socket.on("room:voyage_complete", onVoyageComplete);
    socket.on("room:restarted", onRestarted);
    return () => {
      socket.off("room:voyage_complete", onVoyageComplete);
      socket.off("room:restarted", onRestarted);
    };
  }, [socket, room.id, me.id]);

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
          "The harbor crossed 500 combined Reputation.",
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
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const [guideOpen, setGuideOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [rumorOpen, setRumorOpen] = useState(false);
  const [tutOpen, setTutOpen] = useState(false);
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
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
    const onMembers = (data: {
      roomId: string;
      members?: Array<PublicUser & { joinedAt?: string }>;
      hostId: string | null;
      mutedUserIds?: string[];
    }) => {
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
    if (!seen && state.loaded && state.game.phase === 0) {
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
    phaseSync.markReady((g, l) => nextPhase(g, ctx, l));
  }, [phaseSync, ctx]);

  const handleSetSail = useCallback(() => {
    phaseSync.startGame();
  }, [phaseSync]);

  const handleRestart = useCallback(() => {
    if (!isHost) {
      toast.error("Only the host can restart the voyage");
      return;
    }
    setRestartConfirmOpen(true);
  }, [isHost]);

  const confirmRestart = useCallback(() => {
    phaseSync.restartVoyage();
  }, [phaseSync]);

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

  return (
    <div className="pm-canvas min-h-screen w-full flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 px-3 sm:px-5 py-3">
        <div className="pm-glass rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3 max-w-[1600px] mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <div className="pm-grad-brand h-9 w-9 rounded-xl flex items-center justify-center shrink-0">
              <Anchor className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-bold leading-tight truncate font-display">
                  {normalizeRoomName(room.name)}
                </h1>
                <Pill tone="sea" className="shrink-0">
                  <Users className="h-3 w-3" /> {members.length}
                </Pill>
              </div>
              <button
                onClick={copyCode}
                className="pm-pressable text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <span className="font-mono tracking-widest">{room.code}</span>
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-end">
            <AgeBanner variant="pill" className="hidden md:inline-flex" />
            <div className="relative hidden sm:block">
              <ActionSuggester game={state.game} />
            </div>
            <Pill tone="gain" className="hidden sm:inline-flex">
              <OnlineDot online={connected && authed} size={8} />{" "}
              {connected && authed ? "Live" : "Linking…"}
            </Pill>
            <Button
              variant="ghost"
              size="sm"
              className={cn("rounded-lg", colorblindSafe && "text-gain")}
              onClick={() => setColorblindSafe(!colorblindSafe)}
              title={
                colorblindSafe
                  ? "Colorblind safe palette on, click to use the default colors"
                  : "Use a colorblind safe palette for goods"
              }
            >
              <Palette className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("rounded-lg", soundOn && "text-gain")}
              onClick={toggleSound}
              title={
                soundOn
                  ? "Harbor sounds on, click to mute"
                  : "Turn on harbor sounds and UI feedback"
              }
              aria-label={
                soundOn ? "Mute harbor sounds" : "Turn on harbor sounds"
              }
            >
              {soundOn ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-lg"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
              aria-label="Open settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-lg relative"
              onClick={() => {
                setNotificationsOpen((v) => !v);
                notifications.markAllRead();
              }}
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              {notifications.unreadCount > 0 && (
                <Pill
                  tone="alarm"
                  className="absolute -top-1 -right-1 !px-1 !py-0 min-w-[16px] h-4 justify-center text-[10px]"
                >
                  {notifications.unreadCount > 9
                    ? "9+"
                    : notifications.unreadCount}
                </Pill>
              )}
            </Button>
            <div className="flex items-center gap-2 pl-2 border-l border-black/5 dark:border-white/10">
              <Avatar hue={me.avatarHue} name={me.displayName} size={30} ring />
              <Button
                variant="ghost"
                size="sm"
                className="rounded-lg"
                onClick={handleLeave}
              >
                <DoorOpen className="h-4 w-4 mr-1.5" /> Leave
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <main className="flex-1 px-3 sm:px-5 pb-4 max-w-[1600px] w-full mx-auto">
        <FleetTicker
          socket={socket}
          roomId={room.id}
          me={me}
          initialMembers={members}
        />
        <div className="grid grid-cols-1 lg:grid-cols-[clamp(220px,22vw,300px)_minmax(0,1fr)_clamp(260px,26vw,360px)] gap-3">
          {/* Left: the captain's own rail */}
          <div className="order-2 lg:order-1 lg:sticky lg:top-20 lg:h-[calc(100dvh-6rem)]">
            <div className="pm-glass h-full rounded-2xl p-3">
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

          {/* Center: phase + controls */}
          <div className="space-y-3 order-1 lg:order-2 min-w-0">
            <GamePhasePanel
              game={state.game}
              ctx={ctx}
              act={act}
              members={members}
              phaseSync={phaseSync}
              barter={barter}
              aid={aid}
              backing={backing}
              convoy={convoy}
              me={me}
              room={{
                id: room.id,
                code: room.code,
                name: room.name,
                hostId,
              }}
              voyageResult={voyageResult}
              myLegacy={myLegacy}
              onRestart={handleRestart}
              onRumorBoardOpen={() => setRumorOpen(true)}
              onTutorialOpen={() => setTutOpen(true)}
              colorFor={colorFor}
              roster={roster}
            />
            <GameControlPanel
              game={state.game}
              saving={state.saving}
              isHost={isHost}
              onSetSail={handleSetSail}
              onNextPhase={handleNext}
              onGuide={() => setGuideOpen(true)}
              onSave={handleSave}
              onRestart={handleRestart}
              waiting={phaseSync.waiting}
              readyCount={phaseSync.readyCount}
              requiredCount={phaseSync.requiredCount}
              onCancelReady={phaseSync.cancelReady}
            />
            {/* Wraps rather than overflowing. These five hint chips and
                their labels are wider than a phone, and a centred row
                with no wrap spills off both edges at once, which both
                hides the first hint and gives the whole page a sideways
                scrollbar. */}
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
              <kbd className="rounded bg-black/5 dark:bg-white/10 px-1.5 py-0.5">
                Ctrl+S
              </kbd>{" "}
              Save
              <kbd className="rounded bg-black/5 dark:bg-white/10 px-1.5 py-0.5">
                Ctrl+N
              </kbd>{" "}
              Next Phase
              <kbd className="rounded bg-black/5 dark:bg-white/10 px-1.5 py-0.5">
                Ctrl+R
              </kbd>{" "}
              Restart
              <kbd className="rounded bg-black/5 dark:bg-white/10 px-1.5 py-0.5">
                F1
              </kbd>{" "}
              Guide
              <button
                onClick={() => setShortcutHelpOpen(true)}
                className="pm-pressable rounded bg-black/5 dark:bg-white/10 px-1.5 py-0.5 hover:bg-black/10 dark:hover:bg-white/20"
                title="Show all keyboard shortcuts"
              >
                ?
              </button>{" "}
              Shortcuts
            </div>
          </div>

          {/* Right: roster + chat */}
          <div className="order-3 space-y-3 min-w-0">
            <div className="h-[320px]">
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
            <div
              className="pm-glass rounded-2xl overflow-hidden flex flex-col"
              style={{ height: 380 }}
            >
              <Tabs
                value={chatTab}
                onValueChange={(v) => setChatTab(v as "room" | "dm")}
                className="flex flex-col h-full"
              >
                <TabsList className="grid grid-cols-2 m-2 mb-0">
                  <TabsTrigger value="room">
                    <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Harbor
                  </TabsTrigger>
                  <TabsTrigger value="dm">
                    <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Direct
                  </TabsTrigger>
                </TabsList>
                <TabsContent
                  value="room"
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
        difficulty={state.game.difficulty}
      />
      <TipsModal
        open={tipsOpen}
        onOpenChange={setTipsOpen}
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
        difficulty={state.game.difficulty}
      />
      <RestartConfirmModal
        open={restartConfirmOpen}
        onOpenChange={setRestartConfirmOpen}
        onConfirm={confirmRestart}
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

function DmTab({
  socket,
  me,
  target,
  history,
  trade,
  candidates,
  onPick,
  onClear,
}: {
  socket: unknown;
  me: PublicUser;
  target: PublicUser | null;
  history: ChatMessage[];
  trade?: ChatTrade;
  candidates: Array<PublicUser & { roomId?: string | null }>;
  onPick: (u: PublicUser) => void;
  onClear: () => void;
}) {
  // Deduplicate candidates by id, exclude self.
  const seen = new Map<string, PublicUser & { roomId?: string | null }>();
  for (const c of candidates)
    if (c.id !== me.id && !seen.has(c.id)) seen.set(c.id, c);
  const list = Array.from(seen.values());

  if (target) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-3 py-2 border-b border-black/5 dark:border-white/10 flex items-center gap-2">
          <Avatar hue={target.avatarHue} name={target.displayName} size={24} />
          <span className="text-xs font-medium truncate">
            {target.displayName}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 px-2 text-[11px]"
            onClick={onClear}
          >
            Switch
          </Button>
        </div>
        <div className="flex-1 min-h-0">
          <ChatPanel
            socket={socket as never}
            me={me}
            mode="dm"
            other={target}
            initialMessages={history}
            trade={trade}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-black/5 dark:border-white/10 text-[11px] text-muted-foreground">
        Pick a captain to message privately
      </div>
      <div className="pm-scroll flex-1 min-h-0 overflow-y-auto">
        <div className="p-2 space-y-1">
          {list.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-6 px-4">
              No other captains available right now. They will appear here once
              they are online.
            </p>
          ) : (
            list.map((u) => (
              <button
                key={u.id}
                onClick={() => onPick(u)}
                className="pm-pressable w-full flex items-center gap-2.5 p-2 rounded-lg text-left hover:bg-black/5 dark:hover:bg-white/5"
              >
                <Avatar hue={u.avatarHue} name={u.displayName} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {u.displayName}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    @{u.username}
                  </div>
                </div>
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
