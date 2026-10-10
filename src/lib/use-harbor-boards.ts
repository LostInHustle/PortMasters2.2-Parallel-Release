"use client";

// =====================================================================
// The harbor's boards, as this captain's client holds them.
//
// What makes them one module is what they have in common: none of them lives in a save
// file. Each is real room wide state that no single client's
// deterministic engine can compute on its own, so each arrives over the
// socket and is written into this captain's own voyage here, on the side
// of the event they were on. Everything else about a voyage is the
// session's (see ./use-game-session) and everything else about the room
// is GameRoom's.
//
// The relays above each board are the whole vocabulary it has: a trade
// closed, a loan granted or repaid, a backer covering a shortfall, a
// venture settled, a contract, a refit or a module trade this captain is
// a side of, and the two frames the draft writes to their own save. Each
// one figures out which side of the event this captain is on and then
// runs the matching engine function, which is what keeps a board a relay
// rather than a second engine.
// =====================================================================

import { useCallback, useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";

import { useBarter, type BarterOffer, type PostedOffer } from "./use-barter";
import {
  useAid,
  type GrantedLoan,
  type RepaidLoan,
  type RepaymentSettled,
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
import { useModuleTrades, type ModuleTrade } from "./use-module-trades";
import { useBazaarRumors } from "./use-bazaar-rumors";
import { usePathDraft } from "./use-path-draft";
import {
  acceptBarterOffer,
  applyEscortSide,
  applyModuleTradeSide,
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
  repayLoan,
  settleBarterTrade,
} from "./game/engine";

import type { GameState } from "./game/types";
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
  /** Whether the real voyage has arrived yet. See the held receipts below. */
  loaded: boolean;
  playSound: PlaySound;
}) {
  // Everything the boards write to a voyage waits for the voyage. The save
  // arrives over REST and the boards hydrate over the socket, so a receipt
  // can land while state.game is still the placeholder, and anything applied
  // then is thrown away the moment the real save replaces it (see the INIT
  // case in ./session/reducer). A receipt that arrives first is held here
  // instead, and everything held is replayed together, in arrival order,
  // once the real voyage has landed. The trade this makes is deliberate:
  // holding costs a gift of goods in the one case where the room is
  // restarted inside that same moment, while dropping loses a captain's
  // escrow, a loan, a payout or a garment silently, which is the worse of
  // the two.
  const heldReceipts = useRef<((g: GameState, l: string[]) => void)[]>([]);
  const onVoyage = useCallback(
    (apply: (g: GameState, l: string[]) => void) => {
      if (!loaded) {
        heldReceipts.current.push(apply);
        return;
      }
      act(apply);
    },
    [act, loaded],
  );
  useEffect(() => {
    if (!loaded || heldReceipts.current.length === 0) return;
    const waiting = heldReceipts.current;
    heldReceipts.current = [];
    act((g, l) => {
      for (const apply of waiting) apply(g, l);
    });
  }, [loaded, act]);

  const onBarterFulfilled = useCallback(
    (offer: BarterOffer, accepterId: string) => {
      if (accepterId === meId) {
        onVoyage((g, l) =>
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
        onVoyage((g, l) =>
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
    [onVoyage, meId],
  );
  // An offer of mine the board has stopped listing: its escrow has to come
  // back, and that is the whole of what this report says. The board never
  // names the reason it dropped the offer, so a withdrawal and a sweep are
  // one event here and the refund is named for the press, or for the load
  // itself when it arrives before this captain's voyage has.
  const onBarterRefund = useCallback(
    (offer: BarterOffer) => {
      if (!loaded) {
        heldReceipts.current.push((g, l) =>
          refundBarterOffer(
            g,
            offer.offerItem,
            offer.offerAmount,
            l,
            "pre-load",
          ),
        );
        return;
      }
      act((g, l) =>
        refundBarterOffer(
          g,
          offer.offerItem,
          offer.offerAmount,
          l,
          "withdrawal",
        ),
      );
    },
    [act, loaded],
  );
  // A post the room turned away. The composer had already escrowed the
  // offered goods on its own side (the engine's post takes them, which is
  // what stops one stock from being promised twice), so the refusal is
  // the one thing that can give them back, and the post it names is where
  // the amounts come from (see use-barter). The goods come home through
  // the same refund a withdrawal and a sweep take, so there is one route
  // back to a hold for all three, and a refusal that lands before the
  // voyage does is replayed with the rest rather than applied to a save
  // that is about to be replaced.
  const onBarterPostRefused = useCallback(
    (post: PostedOffer) => {
      onVoyage((g, l) =>
        refundBarterOffer(g, post.offerItem, post.offerAmount, l, "refusal"),
      );
    },
    [onVoyage],
  );
  const barter = useBarter(
    socket,
    roomId,
    meId,
    onBarterFulfilled,
    onBarterRefund,
    onBarterPostRefused,
  );

  // A loan that has been granted. It is the borrower's client that hears of
  // it without a press of its own, so it is the one this guard is really
  // for: a helper can fund an open request while the borrower is still
  // loading.
  const onAidGranted = useCallback(
    (loan: GrantedLoan, role: "borrower" | "helper") => {
      if (role === "borrower") {
        onVoyage((g, l) =>
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
        onVoyage((g, l) =>
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
    [onVoyage],
  );
  const onAidRepaid = useCallback(
    (loan: RepaidLoan) => {
      onVoyage((g, l) =>
        receiveRepayment(g, loan.debtId, loan.amount, loan.fromName, l),
      );
    },
    [onVoyage],
  );
  const onAidRedirectedClosed = useCallback(
    (closed: RedirectedLoanClosed) => {
      onVoyage((g, l) =>
        clearRedirectedLoan(g, closed.debtId, closed.redirectedToName, l),
      );
    },
    [onVoyage],
  );
  // The receipt for a repayment this captain sent. Nothing left the hold
  // when the press went out, so this is the moment the debt and the Gold
  // move on this side, and the only moment they do: a repayment the room
  // has no loan for is refused rather than answered, and a refusal leaves
  // both exactly where they were (see GameRoom's handleRepayLoan). The
  // forced settlement at the end of a voyage leaves its own receipts with
  // nothing to apply, since the debts were settled locally before the
  // frame went out and the engine finds no debt to close.
  const onAidRepaySettled = useCallback(
    (settled: RepaymentSettled) => {
      onVoyage((g, l) => repayLoan(g, settled.debtId, l));
    },
    [onVoyage],
  );
  const aid = useAid(
    socket,
    roomId,
    meId,
    onAidGranted,
    onAidRepaid,
    onAidRedirectedClosed,
    onAidRepaySettled,
  );

  const onBackingAccepted = useCallback(
    (loan: OutstandingLoan) => {
      if (loan.backedAmount)
        onVoyage((g, l) => pledgeBacking(g, loan.backedAmount!, l));
    },
    [onVoyage],
  );
  const onBackingResolved = useCallback(
    (resolved: BackingResolved) => {
      onVoyage((g, l) =>
        receiveBackingOutcome(
          g,
          resolved.refundAmount,
          resolved.calledAmount,
          l,
        ),
      );
    },
    [onVoyage],
  );
  const onBackingCovered = useCallback(
    (covered: BackingCovered) => {
      onVoyage((g, l) =>
        receiveBackedCoverage(
          g,
          covered.amount,
          covered.backerName,
          covered.borrowerName,
          l,
        ),
      );
    },
    [onVoyage],
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
      onVoyage((g, l) => contributeToVenture(g, accepted, l));
    },
    [onVoyage],
  );
  const onVentureSettled = useCallback(
    (
      _ventureId: string,
      outcome: VentureOutcome,
      settlements: VentureSettlement[],
    ) => {
      const mine = settlements.find((s) => s.userId === meId);
      if (!mine) return;
      // The purse moves on the receipt, and the receipt waits for the
      // voyage like every other one. The two spoken outcomes below are
      // news about the room rather than a write to the voyage, so they go
      // out when the frame arrives, held or not.
      onVoyage((g, l) => receiveVentureSettlement(g, mine.amount, l, outcome));
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
        toast("⚓ Venture canceled", {
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

  // [D3: Convoy: the Escort Contract] The last of the relays that only
  // ever touch this captain's own purse: a contract this
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
      onVoyage((g, l) => {
        applyEscortSide(g, contract, meId, l);
      });
    },
    [onVoyage, meId],
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
      onVoyage((g, l) => {
        applyRefitSide(g, refit, meId, l);
      });
    },
    [onVoyage, meId],
  );
  const refit = useRefitContracts(socket, roomId, meId, onRefitSettle);

  // [F3: modules in the shipyard ladder, and trading them between captains]
  // The market's relay, which is the bench's shape exactly: a trade this
  // captain is a side of has been agreed, and the engine works out what
  // that means for them (see applyModuleTradeSide). The buyer pays and
  // bolts the module on, the seller's hull gives it up and unwinds what it
  // carried, and both of those land on the two captains' own machines and
  // nobody else's. No third captain is touched.
  //
  // There is nothing to mirror into GameState afterwards, for the bench's
  // reason: a module trade's whole result is the fee and the hull, and the
  // hull is already this captain's own state. The one thing this relay
  // carries that the two above it do not is a durable object changing
  // hands, which is why its engine side is written the way the plan asked
  // it to be: the seller's side unequips automatically rather than
  // refusing, so an agreed trade always completes.
  const onModuleSettle = useCallback(
    (trade: ModuleTrade) => {
      onVoyage((g, l) => {
        applyModuleTradeSide(g, trade, meId, l);
      });
    },
    [onVoyage, meId],
  );
  const modules = useModuleTrades(socket, roomId, meId, onModuleSettle);

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
  // which is the same shape useMaroon's result handoff takes.
  const draft = usePathDraft(socket, roomId, meId, act);

  return {
    barter,
    aid,
    backing,
    convoy,
    escort,
    refit,
    modules,
    bazaar,
    draft,
  };
}
