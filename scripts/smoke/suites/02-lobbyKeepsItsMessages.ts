// PortMasters 2.2 Parallel Release, smoke run: The Lobby keeps its messages.

import { db } from "@/lib/db";
import {
  call,
  check,
  openAuthedSocket,
  signUp,
  waitForEvent,
} from "../harness";
import type { WireMessage } from "../wire";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function lobbyKeepsItsMessagesSuite(run: SmokeRun): Promise<{
  ashore: { id: string; token: string; cookie: string; username: string };
  ashoreSocket: Socket;
  quay: { id: string; token: string; cookie: string; username: string };
  quayLine: "meet me at the quay before the tide turns";
  quaySocket: Socket;
}> {
  // The one conversation the app is meant to write down, and the reason
  // the rule about a voyage is specific rather than absolute. Two
  // captains who are both ashore have no voyage for their thread to
  // belong to, so it goes to the database and is meant to still be there
  // tomorrow. These two are signed up here and never take a seat
  // anywhere, which is the branch that reaches it.
  const ashore = await signUp("ashore");
  const quay = await signUp("quay");
  run.extraAccounts.push(ashore, quay);
  const ashoreSocket = await openAuthedSocket(ashore);
  const quaySocket = await openAuthedSocket(quay);
  run.sockets.push(ashoreSocket, quaySocket);

  const quayLine = "meet me at the quay before the tide turns";
  const heardAtQuay = waitForEvent<WireMessage>(
    quaySocket,
    "chat:dm",
    (payload) => payload?.content === quayLine,
  );
  const heardAtAshore = waitForEvent<WireMessage>(
    ashoreSocket,
    "chat:dm",
    (payload) => payload?.content === quayLine,
  );
  ashoreSocket.emit("chat:dm", { recipientId: quay.id, content: quayLine });
  const quayGot = await heardAtQuay;
  const ashoreGot = await heardAtAshore;
  check(quayGot?.content === quayLine, "an ashore captain reaches another");
  check(quayGot?.mine === false, "who does not read it as their own");
  check(ashoreGot?.mine === true, "and the sender is given their own copy");

  const writtenDown = await db.message.findMany({
    where: { senderId: ashore.id, recipientId: quay.id },
    select: { roomId: true, content: true },
  });
  check(
    writtenDown.length === 1,
    "a message between two captains ashore is written down",
  );
  check(
    writtenDown[0]?.roomId === null,
    "against no harbor, because it belongs to none",
  );
  check(
    writtenDown[0]?.content === quayLine,
    "and what was written is what was sent",
  );

  const lobbyHistory = await call<{ messages: Array<{ content: string }> }>(
    `/api/messages/dm/${quay.id}`,
    { cookie: ashore.cookie },
  );
  check(lobbyHistory.status === 200, "the history route answers");
  check(
    (lobbyHistory.body?.messages ?? []).some((m) => m.content === quayLine),
    "and hands the conversation back, which is what the Lobby shows",
  );

  return { ashore, ashoreSocket, quay, quayLine, quaySocket };
}
