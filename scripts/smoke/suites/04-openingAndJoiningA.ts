// PortMasters 2.2 Parallel Release, smoke run: Opening and joining a harbor.

import { call, check, suffix } from "../harness";

export async function openingAndJoiningASuite(inputs: {
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
}): Promise<{ code: string; roomId: string }> {
  const { guest, host } = inputs;
  let roomId: string;
  const created = await call<{ room: { id: string; code: string } }>(
    "/api/rooms",
    {
      method: "POST",
      cookie: host.cookie,
      body: JSON.stringify({
        name: `Smoke harbor ${suffix}`,
        isPublic: false,
      }),
    },
  );
  check(created.status === 200, "the host can create a room");
  if (created.status !== 200) throw new Error("No room, stopping here.");
  roomId = created.body.room.id;
  const code = created.body.room.code;

  const joined = await call<{ room: { id: string } }>("/api/rooms/join", {
    method: "POST",
    cookie: guest.cookie,
    body: JSON.stringify({ code }),
  });
  check(joined.status === 200, "the guest can join with the room code");

  const detail = await call<{
    room: {
      memberCount: number;
      members: Array<{ username: string }>;
      host: { id: string };
    };
  }>(`/api/rooms/${roomId}`, { cookie: host.cookie });
  check(
    detail.body?.room?.memberCount === 2,
    "the harbor reads back two members",
  );
  check(
    detail.body?.room?.host?.id === host.id,
    "the host is recorded as the host",
  );

  return { code, roomId };
}
