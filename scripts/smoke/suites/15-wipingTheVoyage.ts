// PortMasters 2.2 Parallel Release, smoke run: Wiping the voyage.

import { check, openAuthedSocket, waitForEvent } from "../harness";
import type { WireHistory } from "../wire";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function wipingTheVoyageSuite(
  run: SmokeRun,
  inputs: {
    guest: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    };
    guestSocket: Socket;
    hostSocket: Socket;
    roomId: string;
  },
): Promise<void> {
  const { guest, guestSocket, hostSocket, roomId } = inputs;
  const clearedAtHost = waitForEvent<{ roomId: string }>(
    hostSocket,
    "chat:cleared",
    (payload) => payload?.roomId === roomId,
  );
  const clearedAtGuest = waitForEvent<{ roomId: string }>(
    guestSocket,
    "chat:cleared",
    (payload) => payload?.roomId === roomId,
  );
  hostSocket.emit("room:restart", { roomId: roomId });
  check(
    (await clearedAtHost) !== null,
    "restarting the voyage tells the room its conversation is gone",
  );
  check(
    (await clearedAtGuest) !== null,
    "and tells every captain in it the same",
  );

  const afterTheWipe = await openAuthedSocket(guest);
  run.sockets.push(afterTheWipe);
  const wipedHistory = waitForEvent<WireHistory>(
    afterTheWipe,
    "chat:history",
    (payload) => payload?.roomId === roomId,
  );
  afterTheWipe.emit("room:join", { roomId: roomId });
  const wiped = await wipedHistory;
  check(wiped !== null, "a captain who reloads still gets an answer");
  check(
    (wiped?.harbor ?? []).length === 0,
    "the harbor chat is gone with the voyage it belonged to",
  );
  check(
    (wiped?.direct ?? []).length === 0,
    "and so is every direct thread in it",
  );
}
