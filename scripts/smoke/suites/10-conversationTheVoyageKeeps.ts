// PortMasters 2.2 Parallel Release, smoke run: A conversation the voyage keeps to itself.

import { db } from "@/lib/db";
import {
  call,
  check,
  openAuthedSocket,
  signUp,
  waitForEvent,
} from "../harness";
import type { WireHistory, WireMessage } from "../wire";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function conversationTheVoyageKeepsSuite(
  run: SmokeRun,
  inputs: {
    code: string;
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
    hostId: string;
    hostSocket: Socket;
    roomId: string;
  },
): Promise<{
  third: {
    id: string;
    token: string;
    cookie: string;
    username: string;
  };
  thirdSocket: Socket;
}> {
  const { code, guest, guestSocket, host, hostId, hostSocket, roomId } = inputs;
  let third: {
    id: string;
    token: string;
    cookie: string;
    username: string;
  };
  // The third captain exists for one reason: a private thread is only
  // private if a captain who is not in it cannot be handed it.
  third = await signUp("third");
  const thirdJoined = await call<{ room: { id: string } }>("/api/rooms/join", {
    method: "POST",
    cookie: third.cookie,
    body: JSON.stringify({ code }),
  });
  check(thirdJoined.status === 200, "a third captain can join the harbor");

  const harborLine = "the tide is running high tonight";
  const dmLine = "two crates of hemp, and not a word to the others";
  const heardHarbor = waitForEvent<{ roomId: string; message: WireMessage }>(
    guestSocket,
    "chat:room",
    (payload) => payload?.message?.content === harborLine,
  );
  hostSocket.emit("chat:room", { roomId: roomId, content: harborLine });
  const heard = await heardHarbor;
  check(heard !== null, "a line in the harbor chat reaches the room");
  check(
    heard?.message?.sender?.id === hostId,
    "and is labelled with who said it",
  );

  const heardDm = waitForEvent<WireMessage>(
    guestSocket,
    "chat:dm",
    (payload) => payload?.sender?.id === hostId,
  );
  const heardOwnDm = waitForEvent<WireMessage>(
    hostSocket,
    "chat:dm",
    (payload) => payload?.sender?.id === hostId,
  );
  hostSocket.emit("chat:dm", { recipientId: guest.id, content: dmLine });
  const dmAtGuest = await heardDm;
  const dmAtHost = await heardOwnDm;
  check(
    dmAtGuest?.content === dmLine,
    "a direct message reaches its recipient",
  );
  check(dmAtGuest?.mine === false, "who does not read it as their own");
  check(dmAtHost?.content === dmLine, "and the sender is given their own copy");
  check(dmAtHost?.mine === true, "marked as theirs");

  // The claim under test: a session conversation is held in the server's
  // memory and nowhere else. Anything written down for this room, or
  // between these two captains, would be a trace of the voyage.
  const storedForRoom = await db.message.count({
    where: { roomId: roomId },
  });
  check(
    storedForRoom === 0,
    "nothing said in the session was written against the room",
  );
  const storedBetween = await db.message.count({
    where: {
      OR: [
        { senderId: host.id, recipientId: guest.id },
        { senderId: guest.id, recipientId: host.id },
      ],
    },
  });
  check(
    storedBetween === 0,
    "and the private thread between the two was not written either",
  );

  const reloaded = await openAuthedSocket(guest);
  run.sockets.push(reloaded);
  const reloadedHistory = waitForEvent<WireHistory>(
    reloaded,
    "chat:history",
    (payload) => payload?.roomId === roomId,
  );
  reloaded.emit("room:join", { roomId: roomId });
  const seeded = await reloadedHistory;
  check(seeded !== null, "a captain who reloads is handed the conversation");
  check(
    (seeded?.harbor ?? []).some((m) => m.content === harborLine),
    "the harbor chat comes back from the server's memory",
  );
  check(
    (seeded?.direct ?? []).some(
      (m) => m.content === dmLine && m.mine === false,
    ),
    "so does the private thread, keeping whose message it was",
  );

  const thirdSocket = await openAuthedSocket(third);
  run.sockets.push(thirdSocket);
  const thirdHistory = waitForEvent<WireHistory>(
    thirdSocket,
    "chat:history",
    (payload) => payload?.roomId === roomId,
  );
  thirdSocket.emit("room:join", { roomId: roomId });
  const thirdSeen = await thirdHistory;
  check(thirdSeen !== null, "the third captain joined the harbor channel");
  check(
    (thirdSeen?.harbor ?? []).some((m) => m.content === harborLine),
    "the harbor chat belongs to the room, so they see it",
  );
  check(
    (thirdSeen?.direct ?? []).length === 0,
    "a thread between two other captains is not handed to them",
  );

  return { third, thirdSocket };
}
