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
//
// An action aimed at a selection is answered the same way, plus a report:
// a selection is allowed to hold accounts the action does not apply to, so
// the console is told what changed and what was left alone.
//
// An answer that never arrives is its own case, and it is the one that used
// to end in a console nobody could use: the rows an action named wait for
// the answer rather than firing twice, so an answer that never comes leaves
// them waiting for good, with the action bar disabled and nothing on screen
// saying why. Two things can eat an answer. The connection can drop, which
// takes the request with it, or the connection can be up while the server
// on the other end does not know the event at all, which is what a running
// dev server looks like after the server half of this feature changed
// underneath it. Both end the same way here: the console stops waiting,
// says nothing can vouch for what happened, and reads the register again,
// because the database is the only thing that knows.
// =====================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { api } from "@/lib/api";
import type {
  AdminAccount,
  AdminBulkAction,
  AdminBulkReport,
} from "@/types/realtime";

// The five things an operator can do to one account. The four of them a
// selection can take ride the same socket event, admin:bulk, and are named
// by the action rather than the event.
type AdminAction = "ban" | "unban" | "grant" | "revoke" | "purge";

// How long an action may wait for an answer that is not coming. It has to
// clear the slowest honest answer there is, which is a delete over a wide
// selection: every account in it is several writes and a socket emit per
// harbor it leaves. Twenty seconds is many times that, and the cost of the
// wait is a row that goes on spinning for a moment longer.
const ANSWER_TIMEOUT_MS = 20_000;

// What the operator is told when an action is given up on. It says what is
// actually known rather than what probably happened: the console has no way
// to see that the write landed, and the register it is about to read is.
function unanswered(count: number, why: string): string {
  return count === 1
    ? `One action ${why}, so nothing here can vouch for whether it landed. The register has been read again.`
    : `${count} actions ${why}, so nothing here can vouch for whether they landed. The register has been read again.`;
}

// The socket event each single account action is sent on. Kept together so
// a rename is one edit here and one on the server, rather than five
// scattered ones.
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
  onBulkReport: (report: AdminBulkReport) => void,
) {
  // null means "not asked for yet", which is what the console shows a
  // loading state for. An empty array is a harbor with no accounts, which
  // is a different thing.
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The rows with an action in flight, so their buttons can go quiet until
  // the server answers rather than fire twice. A bulk action puts every
  // account it names in here, so the rows it is aimed at wait exactly as
  // the row an individual click is aimed at does.
  const [pending, setPending] = useState<string[]>([]);
  // The same accounts, readable from the connection handler and the timer
  // below. Both are installed once and outlive any one render, so neither
  // can see a value that changes on every one of them.
  const inFlight = useRef<string[]>([]);
  const answerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The two callbacks the socket handlers reach for. Held in a ref rather
  // than listed as effect dependencies because onConsoleLost is written
  // inline at the call site and so is a new function on every render; the
  // listeners should be installed once per socket, not once per render.
  const handlers = useRef({ onConsoleLost, onBulkReport });
  useEffect(() => {
    handlers.current = { onConsoleLost, onBulkReport };
  }, [onConsoleLost, onBulkReport]);

  const refresh = useCallback(() => {
    if (!socket) return;
    socket.emit("admin:list");
  }, [socket]);

  // The answer arrived, or the console has given up on it. Either way the
  // rows stop waiting and the clock on them stops with them.
  const settle = useCallback(() => {
    if (answerTimer.current) clearTimeout(answerTimer.current);
    answerTimer.current = null;
    inFlight.current = [];
    setPending([]);
  }, []);

  // Giving up on an action: the rows stop waiting, the operator is told
  // what is and is not known, and the register is read again so what is on
  // screen is what the database holds rather than what was hoped for. Held
  // in a ref because both things that reach for it outlive the render that
  // armed them: the answer timer, and the connection coming back.
  const abandon = useRef<(count: number, why: string) => void>(() => {});
  useEffect(() => {
    abandon.current = (count: number, why: string) => {
      settle();
      setError(unanswered(count, why));
      refresh();
    };
  }, [settle, refresh]);

  // An action was sent. The rows it names wait from here, and the wait is
  // timed: a server that never answers leaves them waiting for good
  // otherwise, which is a console that has to be reloaded to be used again.
  const markPending = useCallback((ids: string[]) => {
    inFlight.current = ids;
    setPending(ids);
    if (answerTimer.current) clearTimeout(answerTimer.current);
    answerTimer.current = setTimeout(() => {
      answerTimer.current = null;
      if (inFlight.current.length === 0) return;
      abandon.current(inFlight.current.length, "went unanswered by the server");
    }, ANSWER_TIMEOUT_MS);
  }, []);

  // The same giving up, for the other thing that eats an answer: the
  // connection dropped while the request was on it. A console that installs
  // these listeners after the socket is already up must not read the next
  // connect as the first one, or it would swallow exactly the reconnect
  // this is here for.
  useEffect(() => {
    if (!socket) return;
    let wasConnected = socket.connected;
    const onConnect = () => {
      if (!wasConnected) {
        wasConnected = true;
        return;
      }
      if (inFlight.current.length === 0) return;
      abandon.current(
        inFlight.current.length,
        "was cut off by a dropped connection",
      );
    };
    socket.on("connect", onConnect);
    return () => {
      socket.off("connect", onConnect);
    };
  }, [socket]);

  // A timer that outlives the console has nothing to clear.
  useEffect(
    () => () => {
      if (answerTimer.current) clearTimeout(answerTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!socket || !active) return;
    let alive = true;

    const onAccounts = (data: { accounts?: AdminAccount[] }) => {
      if (!alive) return;
      setAccounts(data.accounts ?? []);
      settle();
    };

    const onBulkResult = (data: { report?: AdminBulkReport }) => {
      if (!alive || !data.report) return;
      handlers.current.onBulkReport(data.report);
    };

    const onError = async (data: { error: string }) => {
      if (!alive) return;
      settle();
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
      if (!answer || answer.role !== "admin") handlers.current.onConsoleLost();
    };

    socket.on("admin:accounts", onAccounts);
    socket.on("admin:bulk-result", onBulkResult);
    socket.on("admin:error", onError);
    return () => {
      alive = false;
      socket.off("admin:accounts", onAccounts);
      socket.off("admin:bulk-result", onBulkResult);
      socket.off("admin:error", onError);
    };
  }, [socket, active, settle]);

  // The roster is asked for the moment this console is allowed to have
  // one, which is after the socket has authenticated as an operator.
  useEffect(() => {
    if (active) refresh();
  }, [active, refresh]);

  const act = useCallback(
    (action: AdminAction, userId: string, confirmUsername?: string) => {
      if (!socket) return;
      markPending([userId]);
      setError(null);
      socket.emit(EVENT[action], { userId, confirmUsername });
    },
    [socket, markPending],
  );

  // The same actions over a selection. The count travels with the delete
  // alone: it is the number the operator typed into the confirmation, and
  // the server compares it against the accounts it is about to remove, so
  // it is a confirmation rather than a formality the console performs.
  const bulk = useCallback(
    (action: AdminBulkAction, userIds: string[], confirmCount?: number) => {
      if (!socket || userIds.length === 0) return;
      markPending(userIds);
      setError(null);
      socket.emit("admin:bulk", { action, userIds, confirmCount });
    },
    [socket, markPending],
  );

  const dismissError = useCallback(() => setError(null), []);

  return { accounts, error, pending, refresh, act, bulk, dismissError };
}
