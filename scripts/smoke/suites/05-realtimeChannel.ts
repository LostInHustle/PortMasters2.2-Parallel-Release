// PortMasters 2.2 Parallel Release, smoke run: The realtime channel.

import { check, openAuthedSocket } from "../harness";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function realtimeChannelSuite(
  run: SmokeRun,
  inputs: {
    guest: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    };
    host: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    };
  },
): Promise<{ guestSocket: Socket; hostSocket: Socket }> {
  const { guest, host } = inputs;
  const hostSocket = await openAuthedSocket(host);
  run.sockets.push(hostSocket);
  check(hostSocket.connected, "the host socket is connected on the app port");

  const guestSocket = await openAuthedSocket(guest);
  run.sockets.push(guestSocket);
  check(guestSocket.connected, "the guest socket is connected on the app port");

  const presence = await new Promise<Array<{ username: string }>>((resolve) => {
    const timer = setTimeout(() => resolve([]), 5000);
    hostSocket.on(
      "presence:update",
      (payload: { users?: Array<{ username: string }> }) => {
        clearTimeout(timer);
        resolve(payload?.users ?? []);
      },
    );
    hostSocket.emit("presence:request");
  });
  const online = presence.map((u) => u.username);
  check(online.includes(host.username), "presence reports the host online");
  check(online.includes(guest.username), "presence reports the guest online");

  return { guestSocket, hostSocket };
}
