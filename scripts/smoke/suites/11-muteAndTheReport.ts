// PortMasters 2.2 Parallel Release, smoke run: The mute and the report.

import {
  PlayerReportAck,
  RoomMembersPayload,
} from "@/types/realtime/moderation";
import { db } from "@/lib/db";
import { check, waitForEvent } from "../harness";
import type { WireMessage } from "../wire";
import type { Socket } from "socket.io-client";

export async function muteAndTheReportSuite(inputs: {
  guest: {
    id: string;
    token: string;
    cookie: string;
    username: string;
  };
  guestSocket: Socket;
  hostId: string;
  hostSocket: Socket;
  roomId: string;
  third: {
    id: string;
    token: string;
    cookie: string;
    username: string;
  };
  thirdSocket: Socket;
}): Promise<void> {
  const { guest, guestSocket, hostId, hostSocket, roomId, third, thirdSocket } =
    inputs;
  // The moderation surface, and the one part of this suite that is read
  // adversarially rather than happily. Both claims under test are about
  // what a captain is NOT told: the room is not told who the host
  // silenced, and the captain a report names is told nothing at all.
  // Neither can be checked by waiting for a frame that arrives, so every
  // socket records everything it hears from here on and the claims are
  // read off the record.
  // The two ids this section names, held as consts because every use of
  // them below is inside a callback the waiters own, and a captain read
  // out of the enclosing scope is a captain TypeScript cannot narrow.
  // The host's id is already a string in this scope.
  const guestCaptainId = guest.id;
  const thirdCaptainId = third.id;
  const frameLog: Record<string, Array<{ event: string; text: string }>> = {
    host: [],
    guest: [],
    third: [],
  };
  for (const [who, socket] of [
    ["host", hostSocket],
    ["guest", guestSocket],
    ["third", thirdSocket],
  ] as const) {
    socket.onAny((event: string, ...args: unknown[]) => {
      frameLog[who].push({ event, text: JSON.stringify(args) });
    });
  }

  const hostMuted = waitForEvent<RoomMembersPayload>(
    hostSocket,
    "room:members",
    (payload) => (payload?.mutedUserIds ?? []).includes(thirdCaptainId),
  );
  const thirdMuted = waitForEvent<RoomMembersPayload>(
    thirdSocket,
    "room:members",
    (payload) => (payload?.mutedUserIds ?? []).length > 0,
  );
  const guestTold = waitForEvent<RoomMembersPayload>(
    guestSocket,
    "room:members",
    () => true,
  );
  hostSocket.emit("chat:mute", {
    roomId: roomId,
    targetUserId: thirdCaptainId,
  });
  check((await hostMuted) !== null, "the host is handed the list they set");
  const thirdHears = await thirdMuted;
  check(
    thirdHears?.mutedUserIds?.length === 1 &&
      thirdHears.mutedUserIds[0] === thirdCaptainId,
    "the captain who was silenced is handed their own row of it, since it is their own state",
  );
  const guestHears = await guestTold;
  check(
    (guestHears?.mutedUserIds ?? []).length === 0,
    "and a captain who is neither is handed nothing: a mute is not the room's news",
  );

  const heardMuted = waitForEvent<{ roomId: string }>(
    thirdSocket,
    "chat:muted",
    (payload) => payload?.roomId === roomId,
  );
  const mutedLine = "the harbor should not hear this line";
  thirdSocket.emit("chat:room", { roomId: roomId, content: mutedLine });
  check(
    (await heardMuted) !== null,
    "a silenced captain is told their line did not land",
  );
  check(
    !frameLog.host.some(
      (frame) => frame.event === "chat:room" && frame.text.includes(mutedLine),
    ),
    "and the harbor does not hear it",
  );

  const liftedLine = "and it reaches them again once the host relents";
  const hostHearsAgain = waitForEvent<{ message: WireMessage }>(
    hostSocket,
    "chat:room",
    (payload) => payload?.message?.content === liftedLine,
  );
  const thirdLifted = waitForEvent<RoomMembersPayload>(
    thirdSocket,
    "room:members",
    (payload) => (payload?.mutedUserIds ?? []).length === 0,
  );
  hostSocket.emit("chat:unmute", {
    roomId: roomId,
    targetUserId: thirdCaptainId,
  });
  check(
    (await thirdLifted) !== null,
    "unmuting is handed back to the captain it concerned",
  );
  thirdSocket.emit("chat:room", { roomId: roomId, content: liftedLine });
  check(
    (await hostHearsAgain) !== null,
    "and their next line reaches the room",
  );

  const strangerMute = waitForEvent<{ roomId: string; error: string }>(
    hostSocket,
    "room:error",
    (payload) => payload?.roomId === roomId,
  );
  hostSocket.emit("chat:mute", {
    roomId: roomId,
    targetUserId: "an-account-that-is-not-in-this-harbor",
  });
  check(
    (await strangerMute)?.error === "That captain is not in this harbor.",
    "a mute aimed at an account that is not in the harbor is refused rather than remembered",
  );

  // The report. It writes one row per pair per voyage, answers the
  // captain who filed it, and reaches nobody else: not the captain it
  // names, who would otherwise be handed something to hold against the
  // captain who filed it, and not the harbor either.
  const filedAck = waitForEvent<PlayerReportAck>(
    guestSocket,
    "player:report:filed",
    (payload) => payload?.targetUserId === hostId,
  );
  guestSocket.emit("player:report", {
    roomId: roomId,
    targetUserId: hostId,
  });
  const filed = await filedAck;
  check(
    filed?.alreadyFiled === false,
    "a report is filed and answered to the captain who filed it",
  );
  const filedRows = await db.report.count({
    where: {
      roomId: roomId,
      reporterId: guestCaptainId,
      targetUserId: hostId,
    },
  });
  check(
    filedRows === 1,
    "and is written down once, against the harbor it happened in",
  );

  const repeatedAck = waitForEvent<PlayerReportAck>(
    guestSocket,
    "player:report:filed",
    (payload) => payload?.targetUserId === hostId,
  );
  guestSocket.emit("player:report", {
    roomId: roomId,
    targetUserId: hostId,
  });
  check(
    (await repeatedAck)?.alreadyFiled === true,
    "a second report of the same captain in the same voyage is answered as already on the record",
  );
  check(
    (await db.report.count({
      where: {
        roomId: roomId,
        reporterId: guestCaptainId,
        targetUserId: hostId,
      },
    })) === 1,
    "and the row is not written twice",
  );

  const selfReport = waitForEvent<{ roomId: string; error: string }>(
    guestSocket,
    "room:error",
    (payload) => payload?.roomId === roomId,
  );
  guestSocket.emit("player:report", {
    roomId: roomId,
    targetUserId: guestCaptainId,
  });
  check(
    (await selfReport)?.error === "You can't report yourself.",
    "a captain cannot report themselves",
  );
  const strangerReport = waitForEvent<{ roomId: string; error: string }>(
    guestSocket,
    "room:error",
    (payload) => payload?.roomId === roomId,
  );
  guestSocket.emit("player:report", {
    roomId: roomId,
    targetUserId: "an-account-that-is-not-in-this-harbor",
  });
  check(
    (await strangerReport)?.error === "That captain is not in this harbor.",
    "and cannot report an account that is not in the harbor",
  );

  // What the captain the report named was told, and what the rest of the
  // harbor was told: nothing, on either count. Read off the event names,
  // because a frame about a report would have to be about a report:
  // there is no channel it could travel on where it would not say so.
  check(
    !frameLog.host.some((frame) => frame.event.includes("report")) &&
      !frameLog.third.some((frame) => frame.event.includes("report")),
    "the captain a report names, and every other captain in the harbor, are told nothing about it",
  );
}
