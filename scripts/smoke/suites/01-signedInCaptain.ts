// PortMasters 2.2 Parallel Release, smoke run: The signed in captain.

import { call, check } from "../harness";

export async function signedInCaptainSuite(inputs: {
  host: {
    id: string;
    token: string;
    cookie: string;
    username: string;
  };
}): Promise<void> {
  const { host } = inputs;
  const me = await call<{ user: { id: string } | null }>("/api/auth/me", {
    cookie: host.cookie,
  });
  check(me.status === 200, "GET /api/auth/me answers");
  check(
    me.body?.user?.id === host.id,
    "the session cookie identifies the host",
  );

  const anonymous = await call<{ user: unknown }>("/api/auth/me");
  check(anonymous.body?.user === null, "an anonymous visitor is not signed in");
}
