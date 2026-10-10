// PortMasters 2.2 Parallel Release, smoke run: The detail popup's question and answer.

import { SOCKET_PATH } from "@/lib/realtime-endpoint";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BASE, check, waitForEvent } from "../harness";
import type { Socket } from "socket.io-client";
import { connect } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function detailPopupsQuestionSuite(
  run: SmokeRun,
  inputs: {
    guest: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    };
    guestSocket: Socket;
    guestToken: string;
    hostId: string;
    hostSocket: Socket;
    roomId: string;
  },
): Promise<void> {
  const { guest, guestSocket, guestToken, hostId, hostSocket, roomId } = inputs;
  // [J1: the private information review] The one place a captain asks
  // another for a snapshot of their hold. The server used to relay the
  // answer on the sender's own word for who had asked and which room
  // the answer was about, so any authenticated captain could push a
  // forged snapshot at any account in the tree. It now holds the
  // question between the ask and the answer, and relays only what it
  // wrote down itself. These are the three ways that can go.
  // Read out here rather than inside the callbacks below, where the
  // captain the suite is holding could have been signed out from under
  // them as far as the compiler is concerned.
  const askerId = guest.id;
  const detailQuestions: { requesterId?: string }[] = [];
  hostSocket.on(
    "player:detail:request",
    (payload: { requesterId?: string }) => {
      detailQuestions.push(payload);
    },
  );
  const guestAnswers: { targetUserId?: string; data?: unknown }[] = [];
  guestSocket.on(
    "player:detail:response",
    (payload: { targetUserId?: string; data?: unknown }) => {
      guestAnswers.push(payload);
    },
  );

  // One. The question reaches the captain it is about, and their answer
  // reaches the captain who asked, carrying the snapshot they sent.
  guestSocket.emit("player:detail:request", {
    roomId: roomId,
    targetUserId: hostId,
  });
  await new Promise((resolve) => setTimeout(resolve, 400));
  check(
    detailQuestions.some((question) => question.requesterId === askerId),
    "a captain asking for another captain's detail is relayed to that captain, labelled with the asker",
  );
  hostSocket.emit("player:detail:response", {
    roomId: roomId,
    targetUserId: hostId,
    requesterId: askerId,
    data: { gold: 1234 },
  });
  await new Promise((resolve) => setTimeout(resolve, 400));
  check(
    guestAnswers.length === 1 &&
      guestAnswers[0].targetUserId === hostId &&
      (guestAnswers[0].data as { gold?: number } | null)?.gold === 1234,
    "and the answer comes back to the asker with the snapshot in it",
  );

  // Two. A second answer to the question that has already been answered.
  // The hold is consumed by the first one, so this names a question
  // nobody is waiting on and is dropped rather than relayed.
  hostSocket.emit("player:detail:response", {
    roomId: roomId,
    targetUserId: hostId,
    requesterId: askerId,
    data: { gold: 9999 },
  });
  await new Promise((resolve) => setTimeout(resolve, 400));
  check(
    guestAnswers.length === 1,
    "a second answer to the same question is dropped, so one question relays one answer",
  );

  // Three. A question the asker walks away from. The answer arrives
  // after they have left the harbor, so there is nobody the frame is
  // about any more and it is dropped rather than delivered.
  guestSocket.emit("player:detail:request", {
    roomId: roomId,
    targetUserId: hostId,
  });
  await new Promise((resolve) => setTimeout(resolve, 400));
  guestSocket.emit("room:leave", { roomId: roomId });
  await new Promise((resolve) => setTimeout(resolve, 400));
  hostSocket.emit("player:detail:response", {
    roomId: roomId,
    targetUserId: hostId,
    requesterId: askerId,
    data: { gold: 5555 },
  });
  await new Promise((resolve) => setTimeout(resolve, 400));
  check(
    guestAnswers.length === 1,
    "and an answer to a captain who has left the harbor is dropped rather than delivered",
  );

  // The seat is taken back, so the rest of the suite finds the harbor
  // as this block left it. room:leave is only the socket's half of
  // leaving: the membership the route writes is untouched by it, and
  // the seat is waiting to be sat in again.
  const retaken = waitForEvent<{
    roomId: string;
    members: { id: string }[];
  }>(
    guestSocket,
    "room:members",
    (payload) =>
      payload?.roomId === roomId &&
      payload.members.some((member) => member.id === askerId),
  );
  guestSocket.emit("room:join", { roomId: roomId });
  check(
    (await retaken) !== null,
    "and the guest takes their seat back, so the harbor is as it was",
  );

  // A late joiner is hydrated from the server's cache rather than
  // waiting for the next heartbeat, which is what makes a captain who
  // reloads mid voyage still see everyone.
  const guestReloadSocket = connect(BASE, {
    path: SOCKET_PATH,
    transports: ["websocket"],
    extraHeaders: { Cookie: guest.cookie },
    reconnection: false,
  });
  run.sockets.push(guestReloadSocket);
  await new Promise<void>((resolve) => {
    guestReloadSocket.on("connect", () => {
      guestReloadSocket.emit("auth", { token: guestToken });
    });
    guestReloadSocket.on("auth:ok", () => resolve());
    setTimeout(resolve, 8000);
  });
  const hydrated = waitForEvent<{ user: { id: string }; gold: number }>(
    guestReloadSocket,
    "game:status",
    (payload) => payload?.user?.id === hostId,
  );
  guestReloadSocket.emit("room:join", { roomId: roomId });
  const hydratedStatus = await hydrated;
  check(
    hydratedStatus?.gold === 777,
    "a captain who reloads is hydrated with the last known status",
  );

  // Four. The question the target's client never answers. The answer is
  // written on the target's own machine, so it can be late, or never:
  // their tab can close after their socket took the question, the
  // question expires on the server's own clock, and a restarted voyage
  // takes every open question with it. A latch only a response can clear
  // is then a row that spins for the rest of the session, so the wait is
  // timed. Read off the hook rather than driven, for the reason the
  // operator console's own timer was read off its file: the latch lives
  // in a React hook and this suite has no browser to press the eye in.
  const repoRoot = join(import.meta.dirname, "..", "..", "..");
  const peekHook = readFileSync(
    join(repoRoot, "src", "lib", "use-player-detail.ts"),
    "utf8",
  );
  const waitSites = peekHook.split("PEEK_TIMEOUT_MS").length - 1;
  check(
    waitSites === 2 &&
      peekHook.includes("{ ...prev, [targetUserId]: false }") &&
      peekHook.includes("stopWaiting(data.targetUserId)"),
    "a peek whose answer never comes stops waiting on its own clock, and one that does come stops the clock instead",
  );
}
