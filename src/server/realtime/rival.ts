// =====================================================================
// Realtime layer: Captain's Rival recording.
//
// At voyage conclusion, every pair of finishers has met. recordRivalOutcomes
// writes one CaptainRival row per pair, recording who won (higher
// Reputation, ties broken by lower gold lost to bankruptcy, true ties
// when both figures match). These rows back the /api/rivals endpoint,
// which groups and folds them for the Legacy card.
//
// Uses rivalKey from the parent's engine/rival.ts so the (a, b) ordering
// is always lexicographic, regardless of who happened to finish first.
// =====================================================================
import { db } from "@/lib/db";
import { rivalKey } from "@/lib/game/engine/rival";

export type RivalStanding = {
  userId: string;
  reputation: number;
  gold: number;
  crowned: boolean;
  bankrupt: boolean;
  forged: boolean;
};

// Writes one CaptainRival row for every unordered pair of finishers.
// A forged finisher still appears in the standings (the room is never
// broken), but their rival rows record them as a tie rather than a
// win or loss, so a doctored save can't inflate a rivalry record.
export async function recordRivalOutcomes(
  roomId: string,
  voyageEpoch: number,
  standings: RivalStanding[],
): Promise<void> {
  for (let i = 0; i < standings.length; i++) {
    for (let j = i + 1; j < standings.length; j++) {
      const a = standings[i];
      const b = standings[j];
      const [userAId, userBId] =
        a.userId <= b.userId ? [a.userId, b.userId] : [b.userId, a.userId];
      const { aWon, bWon, tie } = resolveOutcome(a, b);
      await db.captainRival
        .create({
          data: {
            userAId,
            userBId,
            roomId,
            voyageEpoch,
            aScore: a.userId === userAId ? a.reputation : b.reputation,
            bScore: a.userId === userAId ? b.reputation : a.reputation,
            aWon: a.userId === userAId ? aWon : bWon,
            bWon: a.userId === userAId ? bWon : aWon,
            tie,
          },
        })
        .catch((err) => {
          console.error("[rival] failed to record outcome:", err);
        });
    }
  }
}

// Decides who won a head to head between two finishers. A forged
// finisher never wins: their score is treated as a tie regardless of
// the reported figure, so a doctored save can't claim a rivalry win it
// didn't earn. Between two honest finishers, higher Reputation wins;
// identical Reputation is a true tie.
function resolveOutcome(
  a: RivalStanding,
  b: RivalStanding,
): { aWon: boolean; bWon: boolean; tie: boolean } {
  if (a.forged || b.forged) return { aWon: false, bWon: false, tie: true };
  if (a.reputation > b.reputation)
    return { aWon: true, bWon: false, tie: false };
  if (b.reputation > a.reputation)
    return { aWon: false, bWon: true, tie: false };
  return { aWon: false, bWon: false, tie: true };
}

export { rivalKey };
