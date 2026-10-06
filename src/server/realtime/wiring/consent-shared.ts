// =====================================================================
// The two reads all three priced markets' post handlers share: naming the
// captain a direct offer is aimed at, and refusing a second offer to the
// same end. The board machinery under them is ../consent's; these two are
// the wiring layer's part, which is why they live here rather than in the
// board factory.
// =====================================================================

import { db } from "@/lib/db";
import { TARGET_NOT_IN_HARBOR } from "@/lib/game/constants/copy";
import { consentOfferStanding, type ConsentTerms } from "@/lib/game/engine";

type NamedBuyer =
  | { ok: true; buyerUserId: string | null; buyerName: string | null }
  | { ok: false; reason: string };

// Resolves the captain a direct offer is aimed at, or the sentence that
// refuses the aim. No target is a valid answer rather than a refusal: that
// is the open offer the whole table can take. The self refusal is the
// caller's sentence, because each market words its own version of it, and
// the captain who is not in the harbor gets the one shared sentence.
export async function resolveNamedBuyer(
  roomId: string,
  sellerId: string,
  targetUserId: string | undefined,
  selfSentence: string,
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
    return { ok: false, reason: TARGET_NOT_IN_HARBOR };
  }
  return {
    ok: true,
    buyerUserId: targetUserId,
    buyerName: targetMember.user.displayName,
  };
}

// The refusal for a second offer to the same end, or null when the board
// holds none. Open and direct offers are told apart in the sentence, the
// same way the board's own bound tells them apart.
export function offerStandingRefusal<T extends ConsentTerms>(
  rows: T[],
  sellerId: string,
  buyerUserId: string | null,
  buyerName: string | null,
): string | null {
  if (!consentOfferStanding(rows, sellerId, buyerUserId)) return null;
  return buyerUserId === null
    ? "You already have an offer standing for anyone at this table."
    : `You already have an offer standing for ${buyerName}.`;
}
