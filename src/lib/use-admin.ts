"use client";

// =====================================================================
// The operator console's socket protocol.
//
// Every account change rides the socket rather than a REST route, and the
// reason is structural: a route handler runs in a different module
// instance from the realtime layer, with its own empty maps, so a route
// could flag an account in the database while the socket layer went on
// holding it as a signed in, seated, playing captain. See the note at the
// top of src/server/realtime/admin.ts.
//
// The roster is never held optimistically. Every action that succeeds is
// answered with the whole roster as it stands afterwards, so the console
// only ever shows what the database actually did, and a refusal leaves the
// previous roster exactly where it was.
// =====================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { api } from "@/lib/api";
import type { AdminAccount } from "@/types/realtime";

// The five things an operator can do to an account.
type AdminAction = "ban" | "unban" | "grant" | "revoke" | "purge";

// The socket event each action is sent on. Kept together so a rename is
// one edit here and one on the server, rather than five scattered ones.
const EVENT: Record<AdminAction, string> = {
  ban: "admin:ban",
  unban: "admin:unban",
  grant: "admin:grant",
  revoke: "admin:revoke",
  purge: "admin:purge",
};

export function useAdmin(
  socket: Socket | null,
  active: boolean,
  onConsoleLost: () => void,
) {
  // null means "not asked for yet", which is what the console shows a
  // loading state for. An empty array is a harbor with no accounts, which
  // is a different thing.
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The account row with an action in flight, so its buttons can go quiet
  // until the server answers rather than fire twice.
  const [pending, setPending] = useState<string | null>(null);

  const lostRef = useRef(onConsoleLost);
  useEffect(() => {
    lostRef.current = onConsoleLost;
  }, [onConsoleLost]);

  const refresh = useCallback(() => {
    if (!socket) return;
    socket.emit("admin:list");
  }, [socket]);

  useEffect(() => {
    if (!socket || !active) return;
    let alive = true;

    const onAccounts = (data: { accounts?: AdminAccount[] }) => {
      if (!alive) return;
      setAccounts(data.accounts ?? []);
      setPending(null);
    };

    const onError = async (data: { error: string }) => {
      if (!alive) return;
      setPending(null);
      setError(data.error);
      // A refusal is the moment to ask the one question that makes the
      // next click worth anything: is this account still an operator? The
      // answer is read from the database rather than guessed from the
      // message, so an operator whose role was taken away in another tab
      // lands back on the sign in card instead of clicking into silence.
      const answer = await api
        .me()
        .then((res) => res.user)
        .catch(() => undefined);
      if (!alive) return;
      // undefined means the question could not be asked at all, which is
      // not an answer and must not end the session.
      if (answer === undefined) return;
      if (!answer || answer.role !== "admin") lostRef.current();
    };

    socket.on("admin:accounts", onAccounts);
    socket.on("admin:error", onError);
    return () => {
      alive = false;
      socket.off("admin:accounts", onAccounts);
      socket.off("admin:error", onError);
    };
  }, [socket, active]);

  // The roster is asked for the moment this console is allowed to have
  // one, which is after the socket has authenticated as an operator.
  useEffect(() => {
    if (active) refresh();
  }, [active, refresh]);

  const act = useCallback(
    (action: AdminAction, userId: string, confirmUsername?: string) => {
      if (!socket) return;
      setPending(userId);
      setError(null);
      socket.emit(EVENT[action], { userId, confirmUsername });
    },
    [socket],
  );

  const dismissError = useCallback(() => setError(null), []);

  return { accounts, error, pending, refresh, act, dismissError };
}
