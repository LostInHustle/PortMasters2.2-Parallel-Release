// =====================================================================
// PortMasters 2.2 Parallel Release: the draft and the switch of papers.
//
// [D7: the draft, and switching] The draft, as one captain sees it, and the
// one change of papers a voyage allows.
//
// The steps are a union and a list of the same four, so a reader that has to
// ask whether a string off the wire is one of them asks in one place. The view
// is addressed to one captain because a hand is that captain's own, and the
// switch is room wide by design rather than by plumbing.
// =====================================================================

import type { PathId } from "@/lib/game/paths";

// [D7: the draft, and switching] The draft, as one captain sees it.
//
// This is the one frame in the tree that is private in its whole shape
// rather than in a field, and that is the plan's own reason for the
// feature being dealt by the server at all: "a hand of cards is private
// information and the client cannot be trusted to deal it." So the view is
// addressed to one captain through emitToUser and never broadcast: the
// hand below is that captain's own, and no frame that reaches a room
// carries a card nobody has played yet. The private scan holds the
// delivery rather than this comment (rule seven of
// scripts/private-scan.ts), and the suite holds the shape from the other
// end: the draft's pass in scripts/smoke/ keeps every frame the two
// sockets at its table receive, on every event rather than on the three
// the feature names, and reads them for a hand that is not the one that
// seat was dealt.
//
// The step is the draft's clock as well as its beat: three steps, fifteen
// seconds each, which is the plan's forty five second interface read as
// three decisions rather than one. `deadline` is an epoch stamp rather
// than a countdown so two clients cannot disagree about how much time is
// left, and it is the server's clock in both cases.
//
// `open` is how many captains at the table have still to choose this step,
// which is a count and never a card, so it is safe to put in front of the
// table and it is what makes the clock legible: a captain knows whether
// they are waiting on four people or on one.
//
// `path` is the whole of the result and is null until the draft is done.
// A finished view is sent once more to every seat when the last step
// closes, which is how a client that reloaded mid draft, or one that never
// answered at all, still learns what it sails on: the path rides the
// view rather than a frame of its own.
export type DraftStep = "first" | "second" | "last" | "done";

// The four steps as a list, for the reason VOYAGE_LOG_KINDS is one (see
// voyage-log.ts): a step arrives off the wire as a string, so the client
// that reads a view has to ask whether the string it was handed is one of
// these, and a reader that asked by writing the four out again in its own
// file would be a second answer to that question. Written out rather than
// derived from the type for the same reason: a step added to the union
// above and forgotten here is a step the client drops on the floor, and
// this list is where that would show.
export const DRAFT_STEPS: readonly DraftStep[] = [
  "first",
  "second",
  "last",
  "done",
];

export type DraftView = {
  roomId: string;
  step: DraftStep;
  deadline: number;
  hand: PathId[];
  open: number;
  path: PathId | null;
};

// [D7: the draft, and switching] The one change of papers a voyage allows,
// as the room is told about it.
//
// This one is room wide, unlike the draft's own frame, and the difference
// is the design rather than the plumbing: the plan's clause for switching
// is "the switch is published to the fleet log where everyone sees it...
// the price of changing your identity is that everyone knows." So the same
// fact travels twice, deliberately: the log line is the record the fleet
// reads back at Dusk, and this frame is the room watching it happen.
//
// The switching captain's own client applies the change off this frame
// rather than off its own press (see pathSwitchBlocked and
// applyPathSwitch), which is what makes the room's answer the authority:
// a switch the server refused is a switch that cost nobody anything.
//
// It carries the path taken up and not the one set aside, for the reason
// the log line does: the server has never read a captain's save, so a
// "from" here would be the room repeating a claim it cannot check.
export type PathSwitched = {
  roomId: string;
  userId: string;
  name: string;
  path: PathId;
};
