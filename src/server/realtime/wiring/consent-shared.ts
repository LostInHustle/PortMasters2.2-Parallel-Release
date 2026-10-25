// The wiring layer's part of the three priced markets.
//
// The refit bench, the module market and the escort market ask the same questions
// in the same order: who an offer is aimed at, whether a second offer may stand,
// whether the presser may take it, and the shape of a post and a take. Only the
// market's name, error event, phase, term and bound differ, and those travel in
// the spec, so a change to the order lives in one place.
//
// The order matters: every refusal is a sentence a captain reads, and a market
// asking in another order would refuse the same press for another reason.

import {
  OFFER_FOR_ANOTHER_CAPTAIN,
  STALE_OFFER,
  TARGET_NOT_IN_HARBOR,
  consentFeeRule,
} from "@/lib/game/constants/copy";
import type { Socket } from "socket.io";

import { db } from "@/lib/db";
import {
  agreeConsent,
  consentFeeFor,
  consentOfferStanding,
  type ConsentTerms,
} from "@/lib/game/engine";
import { tFor, type Locale } from "@/lib/game/i18n";
import type { Phase } from "@/lib/game/types";
import { auditSpentRound, auditSpentReason } from "../audit";
import { requireAuth, seated } from "../auth";
import { getCheckpoint } from "../checkpoint";
import { makeFail, marketOffRefusal, type MarketName } from "./fail";

type NamedBuyer =
  | { ok: true; buyerUserId: string | null; buyerName: string | null }
  | { ok: false; reason: string };

// The parts of an offer row the take rule reads: its target and its round.
type OfferRow = Pick<ConsentTerms, "buyerUserId" | "round">;

// Resolves the captain a direct offer is aimed at, or the refusal. No target is
// valid: it is the open offer the table can take. The self refusal is the
// caller's, because each market words its own; the missing captain gets the
// shared sentence in the seller's language.
async function resolveNamedBuyer(
  roomId: string,
  sellerId: string,
  targetUserId: string | undefined,
  selfSentence: string,
  locale: Locale,
): Promise<NamedBuyer> {
  if (!targetUserId) {
    return { ok: true, buyerUserId: null, buyerName: null };
  }
  if (targetUserId === sellerId) {
    return { ok: false, reason: selfSentence };
  }
  const targetMember = await db.roomMember.findUnique({
    where: { userId_roomId: { userId: targetUserId, roomId } },
    select: { user: { select: { displayName: true } } },
  });
  if (!targetMember) {
    return { ok: false, reason: tFor(locale, TARGET_NOT_IN_HARBOR) };
  }
  return {
    ok: true,
    buyerUserId: targetUserId,
    buyerName: targetMember.user.displayName,
  };
}

// The refusal for a second offer to the same end, or null. Open and direct
// offers are told apart in the sentence. Both sentences are pack rows in the
// seller's language, since this answers the seller whose post was refused.
function offerStandingRefusal<T extends ConsentTerms>(
  rows: T[],
  sellerId: string,
  buyerUserId: string | null,
  buyerName: string | null,
  locale: Locale,
): string | null {
  if (!consentOfferStanding(rows, sellerId, buyerUserId)) return null;
  return buyerUserId === null
    ? tFor(
        locale,
        "You already have an offer standing for anyone at this table.",
      )
    : tFor(locale, "You already have an offer standing for {buyerName}.", {
        buyerName: buyerName ?? "",
      });
}

// The refusal for an offer the captain may not take, or null.
//
// Two reasons, in the order the boards show them: an offer aimed at another
// captain is that captain's alone (open offers excepted), and an offer from an
// earlier round is not this round's. Both sentences answer the presser, so the
// caller's locale is theirs.
export function offerTakeRefusal(
  offer: OfferRow,
  userId: string,
  round: number,
  locale: Locale,
): string | null {
  if (offer.buyerUserId !== null && offer.buyerUserId !== userId) {
    return tFor(locale, OFFER_FOR_ANOTHER_CAPTAIN);
  }
  if (offer.round !== round) {
    return tFor(locale, STALE_OFFER);
  }
  return null;
}

// The wire a post arrives on. The market's own term rides in it, and the spec
// says which field that is.
type ConsentPostPayload = {
  roomId?: string;
  fee?: number;
  targetUserId?: string;
  good?: string;
  module?: string;
};

// The wire an agreement arrives on. The row's id key is the market's spec,
// because a wire field is a contract with every connected client.
type ConsentAcceptPayload = {
  roomId?: string;
  [key: string]: unknown;
};

// What a market answers to the questions the post frame asks. Every field here
// is a difference between the three markets; the questions live in the frame.
export type ConsentPostSpec<T extends ConsentTerms> = {
  board: (roomId: string) => T[];
  market: MarketName;
  errorEvent: string;
  on: (mode: unknown) => boolean;
  phase: Phase;
  // The refusal for another phase, in the presser's language.
  phaseRefusal: (locale: Locale) => string;
  // The term a post names, where the market has one.
  term?: {
    // The term off the wire, or null when none.
    read: (payload: ConsentPostPayload | undefined) => string | null;
    known: (term: string) => boolean;
    refusal: (locale: Locale) => string;
  };
  // The audit's spend that closes this market, where it has one.
  auditSpend?: string;
  selfRefusal: (locale: Locale) => string;
  // The market's own bound on a seller, where it has one.
  bound?: {
    busy: (rows: T[], sellerId: string, term: string, round: number) => boolean;
    refusal: (locale: Locale) => string;
  };
};

// A post that passed every gate, and the facts the market's row is built from.
type ConsentPost<T extends ConsentTerms> = {
  roomId: string;
  sellerUserId: string;
  sellerName: string;
  // The target, or null for an open offer.
  buyerUserId: string | null;
  buyerName: string | null;
  fee: number;
  round: number;
  phase: Phase;
  // The named term, or "" where the market has none.
  term: string;
  // The board as it stood when the post was made.
  rows: T[];
};

// The frame a post is answered in, and the one place the three markets ask the
// same questions in the same order.
//
// That order is the frame: switch, price, term, phase, audit spend, target,
// seller's bound, standing offer. Each is a refusal a captain reads, so another
// order would refuse the same press for another reason.
//
// The commit runs in the same synchronous block as the standing check, and the
// caller writes the row from inside it. A write after an await would leave a
// microtask between check and write, and two posts in one tick would both read
// before either landed.
//
// Every refusal goes out on the market's event in the presser's language, and
// ends the frame.
export async function postConsentOffer<T extends ConsentTerms>(
  socket: Socket,
  payload: ConsentPostPayload | undefined,
  spec: ConsentPostSpec<T>,
  commit: (post: ConsentPost<T>) => void,
): Promise<boolean> {
  const s = seated(socket, payload);
  if (!s) return false;
  const { roomId } = s;
  const fail = makeFail(socket, roomId, spec.errorEvent);
  if (!spec.on(s.mode)) {
    fail(marketOffRefusal(spec.market, s.locale));
    return false;
  }
  // The fee is read through the panel's reader, so form and socket cannot
  // disagree (see consentFeeFor).
  const fee = consentFeeFor(payload?.fee);
  if (fee === null) {
    fail(consentFeeRule(s.locale));
    return false;
  }
  // The term is read against the game layer's table rather than bounded: a term
  // is a good, and a row naming an untradeable one is a row nobody could take.
  let term = "";
  if (spec.term) {
    const named = spec.term.read(payload);
    if (named === null || !spec.term.known(named)) {
      fail(spec.term.refusal(s.locale));
      return false;
    }
    term = named;
  }
  // Every check is after the last await, and the commit runs before this block
  // can yield, so nothing can run another post between the standing check and the
  // row it guards.
  const cp = await getCheckpoint(roomId);
  if (cp.phase !== spec.phase) {
    fail(spec.phaseRefusal(s.locale));
    return false;
  }
  // The audit spend closes this board on the tick it lands, not on the advance.
  if (spec.auditSpend !== undefined && auditSpentRound(roomId, cp.round)) {
    fail(auditSpentReason(spec.auditSpend, s.locale));
    return false;
  }
  const named = await resolveNamedBuyer(
    roomId,
    s.userId,
    payload?.targetUserId,
    spec.selfRefusal(s.locale),
    s.locale,
  );
  if (!named.ok) {
    fail(named.reason);
    return false;
  }
  const { buyerUserId, buyerName } = named;
  const rows = spec.board(roomId);
  // The market's own bound on a seller.
  if (spec.bound && spec.bound.busy(rows, s.userId, term, cp.round)) {
    fail(spec.bound.refusal(s.locale));
    return false;
  }
  const standing = offerStandingRefusal(
    rows,
    s.userId,
    buyerUserId,
    buyerName,
    s.locale,
  );
  if (standing !== null) {
    fail(standing);
    return false;
  }
  commit({
    roomId,
    sellerUserId: s.userId,
    sellerName: s.user.displayName,
    buyerUserId,
    buyerName,
    fee,
    round: cp.round,
    phase: cp.phase,
    term,
    rows,
  });
  return true;
}

// What a market answers to the questions the accept frame asks.
export type ConsentAcceptSpec<T extends ConsentTerms> = {
  board: (roomId: string) => T[];
  market: MarketName;
  errorEvent: string;
  on: (mode: unknown) => boolean;
  // The payload key the row's id arrives under, a wire contract.
  idKey: "contractId" | "tradeId";
  phase: Phase;
  phaseRefusal: (locale: Locale) => string;
  missingRefusal: (locale: Locale) => string;
  // The refusal for a row that is on the board but is not an offer.
  statusRefusal?: (row: T, locale: Locale) => string | null;
  selfRefusal: (locale: Locale) => string;
  // The audit spend that closes this market, where it has one.
  auditSpend?: string;
  busy?: (
    rows: T[],
    opening: T,
    userId: string,
    round: number,
    locale: Locale,
  ) => string | null;
};

// An agreement that was made, and the facts the market's line is built from.
type ConsentAccepted<T extends ConsentTerms> = {
  roomId: string;
  // The row as it stood before the agreement.
  opening: T;
  rows: T[];
  taker: { userId: string; name: string };
};

// The frame an agreement is answered in, and the one place the three markets ask
// the same questions in the same order.
//
// The order is the boards' order: switch, phase, row, self, take, audit spend,
// bound, agreement. A row that is not an offer is refused before the phase,
// because a captain pressing a row that already moved is owed that row's answer.
//
// The agreement itself is the engine's (see agreeConsent), so the board after it
// is the game layer's answer. The commit runs in the same synchronous block as
// the read it was built from, for the post frame's reason.
export async function acceptConsentOffer<T extends ConsentTerms>(
  socket: Socket,
  payload: ConsentAcceptPayload | undefined,
  spec: ConsentAcceptSpec<T>,
  commit: (accepted: ConsentAccepted<T>) => void,
): Promise<boolean> {
  const s = requireAuth(socket);
  if (!s) return false;
  const roomId = payload?.roomId ?? s.roomId;
  const id = payload?.[spec.idKey] as string | undefined;
  if (!roomId || roomId !== s.roomId || !id) return false;
  const fail = makeFail(socket, roomId, spec.errorEvent);
  if (!spec.on(s.mode)) {
    fail(marketOffRefusal(spec.market, s.locale));
    return false;
  }
  const cp = await getCheckpoint(roomId);
  // Synchronous from here down, so nobody else can take the offer between the
  // read and the write.
  const rows = spec.board(roomId);
  const opening = rows.find((r) => r.id === id);
  if (!opening) {
    fail(spec.missingRefusal(s.locale));
    return false;
  }
  const status = spec.statusRefusal
    ? spec.statusRefusal(opening, s.locale)
    : null;
  if (status !== null) {
    fail(status);
    return false;
  }
  if (opening.sellerUserId === s.userId) {
    fail(spec.selfRefusal(s.locale));
    return false;
  }
  const takeRefusal = offerTakeRefusal(opening, s.userId, cp.round, s.locale);
  if (takeRefusal !== null) {
    fail(takeRefusal);
    return false;
  }
  if (cp.phase !== spec.phase) {
    fail(spec.phaseRefusal(s.locale));
    return false;
  }
  // An agreement after the spend is trading the round the harbor just closed.
  if (spec.auditSpend !== undefined && auditSpentRound(roomId, cp.round)) {
    fail(auditSpentReason(spec.auditSpend, s.locale));
    return false;
  }
  const busy = spec.busy
    ? spec.busy(rows, opening, s.userId, cp.round, s.locale)
    : null;
  if (busy !== null) {
    fail(busy);
    return false;
  }
  commit({
    roomId,
    opening,
    rows: agreeConsent(rows, id, {
      userId: s.userId,
      name: s.user.displayName,
    }),
    taker: { userId: s.userId, name: s.user.displayName },
  });
  return true;
}
