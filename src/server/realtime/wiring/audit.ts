// =====================================================================
// The Manifest Audit: the harbor's lighter vote, over ../audit's own rules.
// =====================================================================

import type { Server, Socket } from "socket.io";

import { auditTallyFor, recordAuditVote } from "../audit";
import { wireVote } from "./vote";

export function wireAudit(io: Server, socket: Socket): void {
  // The harbor's one majority vote (see ./audit). Its two frames are
  // wired by the helper the maroon's vote is wired by as well (see
  // ./vote), because the guards around a vote are the same rule on both
  // sides: the harbor is the caller's, the checkpoint is the Parley step
  // and the round is the one the vote names. Everything else the vote is
  // judged against, including the roster it needs a majority of, is
  // read in recordAuditVote from the harbor rather than from the payload,
  // so a doctored frame cannot widen a majority.
  //
  // What is left to this file is the vote's own naming: the four frames
  // the client listens for, and the module that holds the rules behind
  // them.
  wireVote({
    io,
    socket,
    events: {
      vote: "audit:vote",
      error: "audit:error",
      stateRequest: "audit:state:request",
      tally: "audit:tally",
    },
    record: recordAuditVote,
    tallyFor: auditTallyFor,
  });
}
