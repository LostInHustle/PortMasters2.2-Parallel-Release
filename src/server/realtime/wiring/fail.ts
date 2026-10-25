// =====================================================================
// The refusal a handler answers with.
//
// Five markets in this directory answer a press they cannot take with a
// sentence, and each of them wrote the same three lines to do it: a
// closure that puts the harbor and the error on one frame and sends it
// back to the captain who pressed. The copies were harmless until one
// of them grew a second shape, and a second shape in one market is a
// refusal the captain cannot read.
//
// One factory holds the shape now, so a refusal is the same frame
// wherever it is sent, and a market that needs a frame of its own says
// so at the call rather than changing the one every other market uses.
//
// The frame it builds goes to the asking socket and to nobody else,
// which is the whole of the rule: a refusal is the captain's own
// business, and the harbor is not told that their press did not land.
//
// The sentence that says a market is not running lives here as well,
// because all five of them said the same sentence five times over, and
// five copies of one sentence are five chances to word it five ways.
// The five are not one sentence with a market's name dropped into it:
// each market names itself, in English and in Mandarin, and the
// Mandarin sits in the pack beside the English it answers (see
// @/lib/game/i18n), so the builder pairs the market with the row that
// is its own rather than printing one shape for all five.
// =====================================================================

import type { Socket } from "socket.io";

import { tFor, type Locale } from "@/lib/game/i18n";

// The refusal a handler answers with, built for the socket that asked
// and the harbor it asked about.
//
// The event is named by the caller because every market names its own,
// and the client that reads the refusal is listening for that name
// rather than for a general one.
export function makeFail(
  socket: Socket,
  roomId: string,
  event: string,
): (error: string) => void {
  return (error: string): void => {
    socket.emit(event, { roomId, error });
  };
}

// The markets in this directory that answer a press with a sentence of
// their own. The name is the market's, so a caller says which market it
// is rather than carrying the sentence with it.
export type MarketName = "bazaar" | "escort" | "module" | "pathDraft" | "refit";

// The refusal each market gives when its switch is off, one row per
// market because each names itself.
//
// The Mandarin rides beside the English in the pack rather than being
// written here: the pack is where a translation lives (see
// @/lib/game/i18n), and each of the five rows there says what its own
// market says, which is five sentences and not one sentence with a
// market's name dropped into it. The bazaar's row is the bazaar's, and
// the refit bench's row is the bench's.
const MARKET_OFF: Record<MarketName, string> = {
  bazaar: "The bazaar is not running in this harbor.",
  escort: "The escort market is not running in this harbor.",
  module: "The module market is not running in this harbor.",
  pathDraft: "The path draft is not running in this harbor.",
  refit: "The refit bench is not running in this harbor.",
};

// The refusal a market gives when it is not running, in the language the
// captain who pressed reads.
//
// The market is named rather than the sentence, so a market that finds
// its own wording holds it here without every other market's copy of
// the sentence moving with it.
export function marketOffRefusal(market: MarketName, locale: Locale): string {
  return tFor(locale, MARKET_OFF[market]);
}
