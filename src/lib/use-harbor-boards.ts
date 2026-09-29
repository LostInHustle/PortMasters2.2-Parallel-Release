"use client";

// =====================================================================
// The harbor's boards, as this captain's client holds them.
//
// Eight boards and the nine relays that close them, and what makes them
// one module is what they have in common: none of them lives in a save
// file. Each is real room wide state that no single client's
// deterministic engine can compute on its own, so each arrives over the
// socket and is written into this captain's own voyage here, on the side
// of the event they were on. Everything else about a voyage is the
// session's (see ./use-game-session) and everything else about the room
// is GameRoom's.
//
// The relays above each board are the whole vocabulary it has: a trade
// closed, a loan granted or repaid, a backer covering a shortfall, a
// venture settled, a contract or a refit this captain is a side of, and
// the two frames the draft writes to their own save. Each one figures
// out which side of the event this captain is on and then runs the
// matching engine function, which is what keeps a board a relay rather
// than a second engine.
// =====================================================================

import { useCallback, useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";

import { useBarter, type BarterOffer } from "./use-barter";
import {
  useAid,
  type GrantedLoan,
  type RepaidLoan,
  type RedirectedLoanClosed,
} from "./use-aid";
import {
  useBacking,
  type BackingCovered,
  type BackingResolved,
  type OutstandingLoan,
} from "./use-backing";
import {
  useConvoy,
  type VentureOutcome,
  type VentureSettlement,
} from "./use-convoy";
import {
  useEscortContracts,
  type EscortContract,
} from "./use-escort-contracts";
import { useRefitContracts, type RefitContract } from "./use-refit-contracts";
import { useBazaarRumors } from "./use-bazaar-rumors";
import { usePathDraft } from "./use-path-draft";
import {
  acceptBarterOffer,
  applyEscortSide,
  applyRefitSide,
  clearRedirectedLoan,
  contributeToVenture,
  grantLoan,
  pledgeBacking,
  receiveBackedCoverage,
  receiveBackingOutcome,
  receiveLoan,
  receiveRepayment,
  receiveVentureSettlement,
  refundBarterOffer,
  settleBarterTrade,
} from "./game/engine";

import type { useGameSession } from "./use-game-session";
import type { useSound } from "./use-sound";

/** The session's one mutation entry point: every engine call runs inside it. */
type Act = ReturnType<typeof useGameSession>["act"];

/** The harbor's own tones, as the sound hook hands them out. */
type PlaySound = ReturnType<typeof useSound>["play"];

export function useHarborBoards({
  socket,
  roomId,
  meId,
  act,
  loaded,
  playSound,
}: {
  socket: Socket | null;
  roomId: string;
  meId: string;
  act: Act;
  /** Whether the real voyage has arrived yet. See the held refunds below. */
  loaded: boolean;
  playSound: PlaySound;
}) {
  const onBarterFulfilled = useCallback(
    (offer: BarterOffer, accepterId: string) => {
      if (accepterId === meId) {
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
      } else if (offer.fromUserId === meId) {
        act((g, l) =>
          settleBarterTrade(
            g,
            offer.requestItem,
            offer.requestAmount,
            offer.offerItem,
            offer.offerAmount,
            l,
          ),
        );
      }
    },
    [act, meId],
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
      if (!loaded) {
        pendingRefunds.current.push(offer);
        return;
      }
      act((g, l) =>
        refundBarterOffer(g, offer.offerItem, offer.offerAmount, l),
      );
    },
    [act, loaded],
  );
  const barter = useBarter(
    socket,
    roomId,
    meId,
    onBarterFulfilled,
    onBarterRefund,
  );
  useEffect(() => {
    if (!loaded || pendingRefunds.current.length === 0) return;
    const held = pendingRefunds.current;
    pendingRefunds.current = [];
    act((g, l) => {
      for (const offer of held)
        refundBarterOffer(g, offer.offerItem, offer.offerAmount, l);
    });
  }, [loaded, act]);

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
    roomId,
    meId,
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
    roomId,
    meId,
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
      const mine = settlements.find((s) => s.userId === meId);
      if (!mine) return;
      act((g, l) => receiveVentureSettlement(g, mine.amount, l, outcome));
      if (outcome === "filled") {
        toast.success("⚓ Venture filled!", {
          description: `Your share: +${mine.amount} Gold.`,
        });
        playSound("coin");
      } else if (outcome === "failed") {
        toast("⚓ Venture missed its deadline", {
          description: `Partial refund: +${mine.amount} Gold.`,
        });
        playSound("warn");
      } else {
        toast("⚓ Venture cancelled", {
          description: `Another venture in the harbor already claimed this voyage's one chance. Full refund: +${mine.amount} Gold.`,
        });
      }
    },
    [act, meId, playSound],
  );
  const convoy = useConvoy(
    socket,
    roomId,
    onVentureContributed,
    onVentureSettled,
  );

  // [D3: Convoy: the Escort Contract] The tenth relay, and the last of the
  // ones that only ever touch this captain's own purse: a contract this
  // captain is a side of has moved, and the engine works out what that
  // means for them (see applyEscortSide). Both sides of a contract run this
  // same callback against their own state, which is what keeps the fee and
  // the absorbed raid on the two purses that agreed to them rather than on
  // any other captain's.
  //
  // It is idempotent on the engine's side, so the board may report the same
  // contract as often as it likes: the ledger is what decides whether the
  // Gold has already moved.
  const onEscortSettle = useCallback(
    (contract: EscortContract) => {
      act((g, l) => {
        applyEscortSide(g, contract, meId, l);
      });
    },
    [act, meId],
  );
  const escort = useEscortContracts(socket, roomId, meId, onEscortSettle);

  // [D4: Loom: the Refit] The bench's relay, which is the escort's shape
  // with one fewer number in it: a refit this captain is a side of has been
  // agreed, and the engine works out what that means for them (see
  // applyRefitSide). The customer pays and their own garment gets the points
  // back, both on their own machine, and the seller is paid the price the
  // two of them named. No third captain is touched.
  //
  // There is nothing to mirror into GameState afterwards, which is the
  // difference between this market and the escort's. A contract has to be
  // read back into escortCover because the raid roll consults a field; a
  // refit's whole result is the fee and the garment, and the garment is
  // already this captain's own state.
  const onRefitSettle = useCallback(
    (refit: RefitContract) => {
      act((g, l) => {
        applyRefitSide(g, refit, meId, l);
      });
    },
    [act, meId],
  );
  const refit = useRefitContracts(socket, roomId, meId, onRefitSettle);

  // [D5: Aroma: the Bazaar Rumor] The bazaar's relay, and it is the
  // shortest of the three because nothing about a rumor moves anything
  // between captains. There is no settle report to give and no field on
  // GameState to mirror into, which is the difference between this board
  // and the other two: a contract's cover has to be read back into a field
  // because the raid roll consults one, and a refit's whole result lands on
  // the customer's own garment. What a rumor does to a price never touches
  // this hook at all: the lean arrives on the advance frame and is applied
  // to the market by the engine (see applyMarketLeans in
  // @/lib/game/engine/market), so all this holds is what the harbor has
  // been told, for the desk and the board to draw.
  const bazaar = useBazaarRumors(socket, roomId);

  // [D7: the draft, and switching] The path draft's relay, which is the one
  // in this room that carries a card addressed to a single captain: the
  // draft deals every seat its own hand and this hook holds the one it was
  // dealt (see ./use-path-draft). It takes `act` where the three markets
  // above take nothing, because the two frames it listens for are writes to
  // this captain's own save: the settled view is the path they sail on, and
  // the room's published switch is applied to their own purse and manifest,
  // which is the same shape useMaroon's result hand-out takes.
  const draft = usePathDraft(socket, roomId, meId, act);

  return { barter, aid, backing, convoy, escort, refit, bazaar, draft };
}
