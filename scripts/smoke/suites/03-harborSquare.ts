// PortMasters 2.2 Parallel Release, smoke run: The harbor square.

import { db } from "@/lib/db";
import { call, check, waitForEvent } from "../harness";
import type { WireMessage } from "../wire";
import type { Socket } from "socket.io-client";

export async function harborSquareSuite(inputs: {
  ashore: { id: string; token: string; cookie: string; username: string };
  ashoreSocket: Socket;
  quay: { id: string; token: string; cookie: string; username: string };
  quayLine: "meet me at the quay before the tide turns";
  quaySocket: Socket;
}): Promise<void> {
  const { ashore, ashoreSocket, quay, quayLine, quaySocket } = inputs;
  // The lobby's own channel, which is the public half of the rail's chat.
  // Public is a shape rather than a flag: the row has no harbor and no
  // recipient, and that absence is the whole of what lets every captain
  // ashore read it and no captain at sea hear it. These two are still
  // standing in the Lobby, so both of them are in the square.
  const squareLine = "the tide is turning at the north quay";
  const heardAtQuaySquare = waitForEvent<{ message: WireMessage }>(
    quaySocket,
    "chat:lobby",
    (payload) => payload?.message?.content === squareLine,
  );
  const heardAtAshoreSquare = waitForEvent<{ message: WireMessage }>(
    ashoreSocket,
    "chat:lobby",
    (payload) => payload?.message?.content === squareLine,
  );
  ashoreSocket.emit("chat:lobby", { content: squareLine });
  const quaySquare = await heardAtQuaySquare;
  const ashoreSquare = await heardAtAshoreSquare;
  check(
    quaySquare?.message?.content === squareLine,
    "a line on the square reaches the other captain in the Lobby",
  );
  check(
    quaySquare?.message?.mine === false,
    "who does not read it as their own",
  );
  check(
    ashoreSquare?.message?.mine === true,
    "and the sender is given their own copy",
  );

  const squareWritten = await db.message.findMany({
    where: { senderId: ashore.id, content: squareLine },
    select: { roomId: true, recipientId: true },
  });
  check(squareWritten.length === 1, "the square's line is written down");
  check(
    squareWritten[0]?.roomId === null && squareWritten[0]?.recipientId === null,
    "with neither a harbor nor a recipient, which is what makes it public",
  );

  const squareHistory = await call<{ messages: Array<{ content: string }> }>(
    "/api/messages/lobby",
    { cookie: quay.cookie },
  );
  check(squareHistory.status === 200, "the square's history route answers");
  check(
    (squareHistory.body?.messages ?? []).some((m) => m.content === squareLine),
    "and hands the square back to a captain who did not say it",
  );
  check(
    (squareHistory.body?.messages ?? []).every((m) => m.content !== quayLine),
    "without the private thread written at the same moment",
  );
}
