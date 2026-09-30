// PortMasters 2.2 Parallel Release, smoke run: Signing out.

import { call, check } from "../harness";

export async function signingOutSuite(inputs: {
  guest: {
    id: string;
    token: string;
    cookie: string;
    username: string;
  };
}): Promise<void> {
  const { guest } = inputs;
  const out = await call<{ ok: boolean }>("/api/auth/logout", {
    method: "POST",
    cookie: guest.cookie,
  });
  check(out.status === 200, "sign out succeeds");
  const afterOut = await call<{ user: unknown }>("/api/auth/me", {
    cookie: guest.cookie,
  });
  check(afterOut.body?.user === null, "the session is gone after signing out");
}
