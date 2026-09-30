// PortMasters 2.2 Parallel Release, smoke run: The operator console.

import { BANNED_ACCOUNT_ERROR } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  accountIn,
  call,
  check,
  openAuthedSocket,
  password,
  registerOperator,
  signInAgain,
  signUp,
  suffix,
  waitForEvent,
} from "../harness";
import type { WireRoster } from "../wire";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function operatorConsoleSuite(
  run: SmokeRun,
  inputs: {
    guest: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    };
    guestSocket: Socket;
    host: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    };
    hostSocket: Socket;
  },
): Promise<{
  operator: { id: string; token: string; cookie: string; username: string };
  operatorSocket: Socket;
}> {
  const { guest, guestSocket, host, hostSocket } = inputs;
  const setupCode = process.env.ADMIN_SETUP_CODE;
  if (!setupCode) {
    throw new Error(
      "ADMIN_SETUP_CODE is not set for this process, so the operator route cannot be exercised.\n" +
        "Start the server and this script with the same value, or run them in the same shell.",
    );
  }

  const wrongCode = await registerOperator("sneak", "not-the-setup-code");
  check(
    wrongCode.status === 403 && wrongCode.error !== null,
    "a wrong setup code is refused without making an account",
  );
  // Belt and braces: if that refusal were ever wrong, the account it
  // made has to be cleaned up like any other this run created.
  if (wrongCode.captain) run.extraAccounts.push(wrongCode.captain);

  const made = await registerOperator("keeper", setupCode);
  check(made.status === 200, "the setup code admits an operator account");
  check(made.role === "admin", "and the account it makes is an administrator");
  if (!made.captain) throw new Error("No operator account, stopping here.");
  const operator = made.captain;
  run.extraAccounts.push(operator);
  const operatorSocket = await openAuthedSocket(operator);
  run.sockets.push(operatorSocket);

  // A captain who is not an operator asks for the roster. The console
  // only ever hides itself; the server is what has to refuse.
  const refusedList = waitForEvent<{ error: string }>(
    hostSocket,
    "admin:error",
  );
  const leakedList = waitForEvent<WireRoster>(
    hostSocket,
    "admin:accounts",
    undefined,
    1500,
  );
  hostSocket.emit("admin:list");
  check(
    (await refusedList) !== null,
    "a captain who is not an operator is refused the roster",
  );
  check((await leakedList) === null, "and is sent no roster at all");

  const asked = waitForEvent<WireRoster>(operatorSocket, "admin:accounts");
  operatorSocket.emit("admin:list");
  const roster = await asked;
  check(roster !== null, "the operator is handed the roster");
  check(
    accountIn(roster, host.id)?.username === host.username,
    "and it lists the captains it is there to manage",
  );

  // The ban, with every listener registered before the ban goes out so
  // nothing can arrive in the gap.
  const toldTheBanned = waitForEvent<{ error: string }>(
    guestSocket,
    "auth:fail",
  );
  const bannedSocketClosed = waitForEvent<unknown>(
    guestSocket,
    "disconnect",
    undefined,
    3000,
  );
  const afterBan = waitForEvent<WireRoster>(operatorSocket, "admin:accounts");
  operatorSocket.emit("admin:ban", { userId: guest.id });
  check(
    (await toldTheBanned) !== null,
    "a banned captain's socket is told why it is being closed",
  );
  check((await bannedSocketClosed) !== null, "and is closed");
  check(
    accountIn(await afterBan, guest.id)?.bannedAt != null,
    "the roster shows the account banned",
  );
  const noLongerSignedIn = await call<{ user: unknown }>("/api/auth/me", {
    cookie: guest.cookie,
  });
  check(
    noLongerSignedIn.body?.user === null,
    "the ban took the session the account already had",
  );
  const bannedLogin = await call<{ error: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: guest.username, password }),
  });
  check(bannedLogin.status === 403, "a banned captain cannot sign back in");
  check(
    bannedLogin.body?.error === BANNED_ACCOUNT_ERROR,
    "and is told the account is banned, not that the password is wrong",
  );

  const afterUnban = waitForEvent<WireRoster>(operatorSocket, "admin:accounts");
  operatorSocket.emit("admin:unban", { userId: guest.id });
  check(
    accountIn(await afterUnban, guest.id)?.bannedAt === null,
    "unbanning clears the ban",
  );
  // The signed in session has to come back too, and the smoke run needs
  // one for the sign out check at the end, so the fresh session is kept.
  const signedBackIn = await signInAgain(guest.username);
  check(signedBackIn !== null, "and the captain can sign in again");
  if (signedBackIn) {
    guest.cookie = signedBackIn.cookie;
    guest.token = signedBackIn.token;
  }

  const afterGrant = waitForEvent<WireRoster>(operatorSocket, "admin:accounts");
  operatorSocket.emit("admin:grant", { userId: host.id });
  check(
    accountIn(await afterGrant, host.id)?.role === "admin",
    "an operator can hand the role to another captain",
  );
  // The role is read from the account row on every event, so the socket
  // this captain already had is enough. Nothing was reconnected.
  const promotedList = waitForEvent<WireRoster>(
    hostSocket,
    "admin:accounts",
    undefined,
    3000,
  );
  hostSocket.emit("admin:list");
  check(
    (await promotedList) !== null,
    "and that captain can read the roster on the socket they already had",
  );

  const toldTheDemoted = waitForEvent<{ error: string }>(
    hostSocket,
    "admin:error",
  );
  const afterRevoke = waitForEvent<WireRoster>(
    operatorSocket,
    "admin:accounts",
  );
  operatorSocket.emit("admin:revoke", { userId: host.id });
  check(
    accountIn(await afterRevoke, host.id)?.role === "captain",
    "and take the role away again",
  );
  const demotion = await toldTheDemoted;
  check(
    demotion !== null,
    "telling the demoted captain's own console that it has lost the console",
  );
  const afterDemotion = waitForEvent<WireRoster>(
    hostSocket,
    "admin:accounts",
    undefined,
    1500,
  );
  hostSocket.emit("admin:list");
  check(
    (await afterDemotion) === null,
    "and the roster is refused from that socket from then on",
  );

  // Nothing here should be able to lock the operator out of their own
  // console, and a self ban or self deletion is never what was meant.
  const refusedSelfBan = waitForEvent<{ error: string }>(
    operatorSocket,
    "admin:error",
  );
  operatorSocket.emit("admin:ban", { userId: operator.id });
  check((await refusedSelfBan) !== null, "an operator cannot ban themselves");
  const refusedSelfPurge = waitForEvent<{ error: string }>(
    operatorSocket,
    "admin:error",
  );
  operatorSocket.emit("admin:purge", {
    userId: operator.id,
    confirmUsername: operator.username,
  });
  check((await refusedSelfPurge) !== null, "nor delete their own account");

  // A harbor with a captain sitting in it, belonging to an account that
  // is about to be deleted.
  const doomed = await signUp("doomed");
  const crew = await signUp("crew");
  run.extraAccounts.push(doomed, crew);
  const doomedSocket = await openAuthedSocket(doomed);
  const crewSocket = await openAuthedSocket(crew);
  run.sockets.push(doomedSocket, crewSocket);

  const doomedRoom = await call<{ room: { id: string; code: string } }>(
    "/api/rooms",
    {
      method: "POST",
      cookie: doomed.cookie,
      body: JSON.stringify({
        name: `Smoke doomed harbor ${suffix}`,
        isPublic: false,
      }),
    },
  );
  if (doomedRoom.status !== 200) {
    throw new Error("No harbor for the deletion checks, stopping here.");
  }
  const doomedRoomId = doomedRoom.body.room.id;
  // Two steps, because the harbor has to have a member before the
  // socket will seat anyone in it: the membership row is written over
  // REST, and the seat itself is taken on the socket.
  const joinedDoomed = await call<{ room: { id: string } }>("/api/rooms/join", {
    method: "POST",
    cookie: crew.cookie,
    body: JSON.stringify({ code: doomedRoom.body.room.code }),
  });
  check(
    joinedDoomed.status === 200,
    "a captain joins the harbor about to be deleted",
  );
  const takenASeat = waitForEvent<{ roomId: string }>(
    crewSocket,
    "chat:history",
    (payload) => payload?.roomId === doomedRoomId,
  );
  crewSocket.emit("room:join", { roomId: doomedRoomId });
  check((await takenASeat) !== null, "and takes a seat in it");

  const refusedConfirm = waitForEvent<{ error: string }>(
    operatorSocket,
    "admin:error",
  );
  operatorSocket.emit("admin:purge", {
    userId: doomed.id,
    confirmUsername: "a-different-name",
  });
  check(
    (await refusedConfirm) !== null,
    "a deletion the operator did not confirm by name is refused",
  );
  check(
    (await db.user.findUnique({
      where: { id: doomed.id },
      select: { id: true },
    })) !== null,
    "and the account is still there",
  );

  const harborClosed = waitForEvent<{ roomId: string; reason?: string }>(
    crewSocket,
    "room:closed",
    (payload) => payload?.roomId === doomedRoomId,
  );
  const toldTheDeleted = waitForEvent<{ error: string }>(
    doomedSocket,
    "auth:fail",
  );
  const deletedSocketClosed = waitForEvent<unknown>(
    doomedSocket,
    "disconnect",
    undefined,
    3000,
  );
  const afterPurge = waitForEvent<WireRoster>(operatorSocket, "admin:accounts");
  operatorSocket.emit("admin:purge", {
    userId: doomed.id,
    confirmUsername: doomed.username,
  });
  check(
    (await harborClosed) !== null,
    "the captains sitting in that account's harbor are told it is closing",
  );
  check(
    (await toldTheDeleted) !== null,
    "the deleted account's own socket is told why",
  );
  check((await deletedSocketClosed) !== null, "and is closed");
  check(
    accountIn(await afterPurge, doomed.id) === undefined,
    "the account is gone from the roster",
  );
  check(
    (await db.user.findUnique({
      where: { id: doomed.id },
      select: { id: true },
    })) === null,
    "and gone from the database",
  );
  check(
    (await db.room.findUnique({
      where: { id: doomedRoomId },
      select: { id: true },
    })) === null,
    "the harbor it hosted went with it",
  );
  const crewStillAboard = await call<{ user: { id: string } | null }>(
    "/api/auth/me",
    { cookie: crew.cookie },
  );
  check(
    crewStillAboard.body?.user?.id === crew.id,
    "and a captain who was only sitting there keeps their account",
  );

  // Everything the single account actions just proved, asked again for a
  // whole selection at once. The accounts used here are new ones rather
  // than the captains above, so a bulk ban landing on somebody cannot
  // change the answer to a check that already ran.
  return { operator, operatorSocket };
}
