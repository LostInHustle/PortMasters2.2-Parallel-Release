// PortMasters 2.2 Parallel Release, smoke run: Quick Start pairing.

import { db } from "@/lib/db";
import { check, requestQuickMatch } from "../harness";
import type { Socket } from "socket.io-client";

export async function quickStartPairingSuite(inputs: {
  guestSocket: Socket;
  hostSocket: Socket;
}): Promise<{ quickStartRoomId: string | null }> {
  const { guestSocket, hostSocket } = inputs;
  let quickStartRoomId: string | null;
  // Both captains ask in the same tick. That is the case the button
  // exists for, and the case that used to seat them in two separate
  // harbors: without serialized matching, both lookups find no open
  // harbor before either has created one, so each opens its own.
  // The host asks for a long voyage and the guest for a short one. The
  // host's request is sent first, so the host is the captain who opens
  // the room, and the room should carry the host's tier. The guest is
  // seated into that same room and sails at its tier, exactly as if they
  // had typed the room code in.
  const [hostMatch, guestMatch] = await Promise.all([
    requestQuickMatch(hostSocket, "monsoon"),
    requestQuickMatch(guestSocket, "fair_winds"),
  ]);
  check(hostMatch !== null, "the first captain asking for a match is seated");
  check(guestMatch !== null, "the second captain asking for a match is seated");
  check(
    hostMatch !== null &&
      guestMatch !== null &&
      hostMatch.roomId === guestMatch.roomId,
    "both captains are paired into the same harbor",
  );
  quickStartRoomId = hostMatch?.roomId ?? guestMatch?.roomId ?? null;

  const quickRoom = quickStartRoomId
    ? await db.room.findUnique({
        where: { id: quickStartRoomId },
        select: { difficulty: true },
      })
    : null;
  check(
    quickRoom?.difficulty === "monsoon",
    "the harbor opens in the tier the first captain picked",
  );

  return { quickStartRoomId };
}
