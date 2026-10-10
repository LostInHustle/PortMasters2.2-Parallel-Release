// =====================================================================
// PortMasters 2.2 Parallel Release: the conclusion, the reveal and the chronicle.
//
// The conclusion, the reveal and the chronicle.
//
// Three readings of one finished voyage, from the standings the room is shown
// as it ends, through the ledger of cards and verdicts, to the row the
// chronicle viewer reads back later. The reveal is the one frame allowed to
// carry an alignment, and it may because the voyage is over by the time it is
// built.
// =====================================================================

import type { Difficulty } from "@/lib/game/difficulty";
import type { GambitRole } from "@/lib/game/gambit";
import type { Objective } from "@/lib/game/objectives";
import type { ObjectiveTraceEntry, OrderFill } from "@/lib/game/types";

// The whole voyage conclusion payload: the standings sorted by
// Reputation, plus the id of the crowned Sea Master (or null when
// everyone went bankrupt).
export type VoyageResult = {
  roomId: string;
  winnerId: string | null;
  standings: StandingRow[];
};

// One row of the voyage conclusion standings, as the server emits it on
// room:voyage_complete and hands it to the reveal. Declared here so the
// Endgame panel, the Lobby's chronicle viewer and the conclusion itself
// all read one shape rather than a shape each.
export type StandingRow = {
  userId: string;
  displayName: string;
  avatarHue: number;
  reputation: number;
  crowned: boolean;
  bankrupt: boolean;
  // [H7: Maroon and the Harbormaster] Whether the harbor put this captain
  // ashore. Read beside bankrupt rather than folded into it because the
  // standings say what happened to a captain, and the two are different
  // things that can both be true of one seat.
  marooned: boolean;
  xpGained: number;
  leveledUp: boolean;
  brokersFavorUnlocked: boolean;
  newMerits: string[];
};

// [H8: the reveal and the replay ledger] One captain's card, flipped.
//
// This is the one frame in the mode that carries an alignment to the whole
// room, and the reason it may is that the voyage is over by the time it is
// built: there is nothing left for the secret to protect. It is emitted by
// the conclusion and by nothing else, and handed to a captain who reloads
// after it by the same room:join hand out the audit's reveal uses.
//
// Every field is either a verdict or a mark the conclusion already wrote to
// this captain's own Chronicle row, or a reading of the same save blob
// those came from, so the ledger and the record under it cannot disagree.
export type RevealedCaptain = {
  userId: string;
  displayName: string;
  avatarHue: number;
  // The card this captain was dealt, or null for a seat the hand never
  // reached. Null rather than a default role because a late arrival was
  // promised nothing and judged on nothing, and a ledger that drew them a
  // card would be telling a story that did not happen.
  role: GambitRole | null;
  // The personal goal an Honest card carried, by id. Sent as the id rather
  // than as the sentence for the reason the private entry sends it that
  // way: the deck is the one place a goal is written, and the surface
  // resolves it with flourishById, so the ledger and the card cannot print
  // two different goals. Null on the two cards that carry none, and on a
  // goal id the deck no longer holds, which the conclusion has already
  // resolved before this is built.
  flourishId: string | null;
  // Whether this captain won the game their card set them: the verdict the
  // Chronicle row holds, decided by the same rule the card printed. False
  // for a forged finish, which wins nothing, and false for a seat that was
  // dealt no card.
  won: boolean;
  crowned: boolean;
  bankrupt: boolean;
  marooned: boolean;
  // A finish the Ledger Integrity Pass disqualified. The numbers beside it
  // are the ones the harbor watched rather than the ones the save claimed,
  // and the ledger says so rather than printing them as a result.
  forged: boolean;
  gold: number;
  reputation: number;
  // Coin taken from other captains in trade, net of coin paid to them, and
  // never anything the port paid: for a Broker this is the whole verdict.
  peerTradeProfit: number;
  // What this captain handed to the commission themselves, by good,
  // cumulative. The other half of the fleet's number above, and the half
  // the ledger attributes to a name.
  delivered: Record<string, number>;
  // What this captain was seen to trade, from the order fulfillments their
  // own client recorded, oldest first. The window is the audit's
  // (AUDIT_WINDOW), so on a long voyage this is the closing legs rather
  // than all of it, which is everything that is durably kept.
  fills: OrderFill[];
};

// The reveal, as the conclusion builds it and as a rejoining captain is
// handed it. The card, the verdicts and the marks for every finisher, plus
// the two things a ledger needs to tell the story of the evening: what the
// fleet handed over, leg by leg, and what each captain handed over
// themselves.
export type VoyageReveal = {
  roomId: string;
  // The commission this harbor was working on, resolved rather than
  // seeded, because the ledger draws the board at the size the voyage
  // sailed at and a client redrawing it would have to know the rung.
  // Drawn by the server from the room's own epoch and pinned seats, which
  // is what keeps it the board the fleet was actually working against.
  objective: Objective;
  // The commission's progress leg by leg, merged across every captain's
  // record of it. Empty for a harbor whose captains never watched a board.
  fleetTrace: ObjectiveTraceEntry[];
  // Every finisher, in the order the standings arrive in.
  captains: RevealedCaptain[];
};

// A finished voyage's chronicle, as stored on the VoyageChronicle row
// and returned by /api/chronicle. Mirrors the engine's ChronicleOutput
// plus the persisted metadata the chronicle viewer renders.
export type VoyageChronicle = {
  id: string;
  roomId: string;
  voyageEpoch: number;
  difficulty: Difficulty;
  rounds: number;
  peakReputation: number;
  finalReputation: number;
  finalGold: number;
  largestTrade: number;
  lendCount: number;
  borrowCount: number;
  crowned: boolean;
  bankrupt: boolean;
  // Whether the harbor voted this captain ashore. Written from the
  // server's own record of the vote rather than from a reported status,
  // so a client cannot write one into its own history (see
  // recordMaroonVote and maybeConcludeVoyage).
  marooned: boolean;
  merchantRating: string;
  headline: string;
  body: string;
  createdAt: string;
};
