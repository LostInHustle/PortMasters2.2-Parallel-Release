// PortMasters 2.2 Parallel Release, smoke run: Recovering a session after a reload.

import { call, check } from "../harness";

export async function recoveringASessionAfterAReloadSuite(inputs: {
  guest: {
    id: string;
    token: string;
    cookie: string;
    username: string;
  };
  roomId: string;
}): Promise<void> {
  const { guest, roomId } = inputs;
  const active = await call<{ room: { id: string } | null }>(
    "/api/rooms/active",
    {
      cookie: guest.cookie,
    },
  );
  check(
    active.body?.room?.id === roomId,
    "a reloaded captain lands back in the harbor",
  );
}
