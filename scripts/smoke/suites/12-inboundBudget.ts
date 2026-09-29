// PortMasters 2.2 Parallel Release, smoke run: The inbound budget.

import { check, openAuthedSocket } from "../harness";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function inboundBudgetSuite(
  run: SmokeRun,
  inputs: {
    guestSocket: Socket;
    third: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    };
  },
): Promise<void> {
  const { guestSocket, third } = inputs;
  // [J2: the mute and the report] The one thing in the realtime layer
  // that decides whether to read a frame. It is checked here rather than
  // in a unit test because what it has to be true of is the app's own
  // client: the budget was read off that client's cadences, and the way
  // to know it is set above them is to run the frames the app itself
  // sends and watch them all land.
  //
  // The budget's own numbers are deliberately not in this file. What is
  // asserted is the shape: a burst the size of the client's tightest loop
  // is answered rather than refused, a flood far above any cadence a
  // captain can produce is cut, the captain behind it is told once, the
  // budget refills, and one socket's flood is not the captain on the
  // next socket's problem.
  //
  // One trap, learned from this probe failing its first full run:
  // presence:update is both the answer to this frame and the news a
  // connect broadcasts to every socket in the tree, so a count of it
  // read on a socket that is only listening counts other captains' news
  // as this captain's answers. The flood is therefore counted on the
  // socket it came from, where it is the loudest thing happening, and
  // the bystanding captain is counted as a difference across their own
  // frames rather than as a total, after a quiet moment that lets the
  // connect this probe caused finish reaching them.
  const floodSocket = await openAuthedSocket(third);
  run.sockets.push(floodSocket);
  let floodAnswered = 0;
  let floodNotices = 0;
  let politeAnswered = 0;
  floodSocket.on("presence:update", () => {
    floodAnswered += 1;
  });
  floodSocket.on("room:error", (payload: { error?: string }) => {
    if (
      payload?.error ===
      "Too many actions at once. Give the harbor a moment, then try again."
    ) {
      floodNotices += 1;
    }
  });
  guestSocket.on("presence:update", () => {
    politeAnswered += 1;
  });

  // Long enough for the new socket's arrival to have reached every other
  // socket and for every bucket in the harbor to refill past the twelve
  // frames below even from empty, so what follows measures the flood
  // rather than the frames this voyage has been sending all along.
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const politeBefore = politeAnswered;
  const floodBefore = floodAnswered;
  const FLOOD_FRAMES = 200;
  const POLITE_FRAMES = 12;
  for (let i = 0; i < FLOOD_FRAMES; i++) floodSocket.emit("presence:request");
  for (let i = 0; i < POLITE_FRAMES; i++) guestSocket.emit("presence:request");
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const flooded = floodAnswered - floodBefore;
  const politeAnsweredHere = politeAnswered - politeBefore;

  check(
    flooded > 0 && flooded < FLOOD_FRAMES,
    `a flood of ${FLOOD_FRAMES} frames is cut rather than answered in full (${flooded} were answered)`,
  );
  check(
    flooded >= POLITE_FRAMES,
    "and its first frames, which are a cadence this app really sends, are answered rather than refused",
  );
  check(
    floodNotices === 1,
    "the captain behind it is told once, rather than once per frame",
  );
  check(
    politeAnsweredHere === POLITE_FRAMES,
    `one socket's flood is not the captain on the next socket's problem (they heard ${politeAnsweredHere} of ${POLITE_FRAMES})`,
  );

  // And the budget is a rate rather than a ban: a frame sent after the
  // refill window is answered again, which is what keeps a human who has
  // somehow reached the ceiling from being locked out of the harbor.
  const beforeRefill = floodAnswered;
  await new Promise((resolve) => setTimeout(resolve, 1500));
  floodSocket.emit("presence:request");
  await new Promise((resolve) => setTimeout(resolve, 500));
  check(
    floodAnswered > beforeRefill,
    "and the socket is answered again once the budget refills",
  );

  // Closed here rather than left to the end of the run. A captain with a
  // second live socket is not a captain who has gone quiet, and the
  // bartering section below leans on the third captain having gone quiet:
  // their offer cannot be taken once they are unreachable. Leaving this
  // socket open is what made this probe's first full run fail there.
  floodSocket.close();
}
