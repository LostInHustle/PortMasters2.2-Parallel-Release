// =====================================================================
// The path draft, and switching: the two opposite kinds of frame the
// plan gives the fleet at departure.
// =====================================================================

import type { Server, Socket } from "socket.io";

import { pathSwitchOpenLine, pathSwitchSpentLine } from "@/lib/game/engine";
import { pathDraftOn } from "@/lib/game/flags";
import { normalizePath } from "@/lib/game/paths";
import { seated } from "../auth";
import { getCheckpoint } from "../checkpoint";
import { draftViewFor, recordPathSwitch, takeDraftPick } from "../draft";

export function wirePathDraft(io: Server, socket: Socket): void {
  //
  // [D7: the draft, and switching] The two surfaces the plan's clause
  // gives the fleet, and they are opposite kinds of frame, which is the
  // whole design of the feature.
  //
  // A draft is private in its whole shape. The hands are dealt here, the
  // pass is resolved here, and a captain is sent their own hand and
  // nobody else's, because "a hand of cards is private information and
  // the client cannot be trusted to deal it" (see the header of ./draft,
  // which is where the deal itself lives). Nothing below broadcasts a
  // card, and no frame that reaches the room carries one.
  //
  // A switch is the opposite, and that is its price: "the switch is
  // published to the fleet log where everyone sees it... the price of
  // changing your identity is that everyone knows." So the handler below
  // refuses what the room can check about a switch, and then hands the
  // publication to the module, which writes the frame, the log line and
  // the measurement as one act.
  //
  // Neither handler writes a save. The fee, the forfeiture and the once a
  // voyage stamp are the captain's own and are applied by the captain's
  // own engine when these frames come back (see applyDraftPath and
  // applyPathSwitch), which is the line every client authoritative fact
  // in this build draws, and the reason a draft can end on a server that
  // has never read a save.

  // The hand this captain is holding, asked for by a surface that just
  // mounted. A captain who is not in a draft is answered with a null,
  // which the client reads as nothing to draw rather than as an error, so
  // this request never has to explain which of the three nulls it was.
  socket.on("draft:state:request", (payload: { roomId?: string }) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
    socket.emit("draft:update", draftViewFor(roomId, s.userId));
  });

  // One card laid down. The pick is an index into this captain's own hand
  // and never a path, because a deck with a floor can hand one captain two
  // cards of the same path (see keepFrom). Everything the step needs is in
  // the module: the seat's own hand, who has answered, and what the table
  // is then sent.
  socket.on("draft:keep", (payload: { roomId?: string; pick?: unknown }) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
    const refused = takeDraftPick(io, roomId, s.userId, payload?.pick);
    if (refused !== null) {
      socket.emit("draft:error", { roomId, error: refused });
    }
  });

  // One captain's change of papers.
  //
  // Everything the room can check about a switch is checked here, and the
  // list is short for a reason worth stating: the fee, the forfeiture and
  // the window are about the captain's own purse, manifest and save, and
  // this server has never read any of them. What is left is what only a
  // room can know, and it is not nothing: whether the build deals paths at
  // all, whether the destination is a path this build has, whether the
  // voyage is in the season and the seat a switch may happen in, and
  // whether this captain has already spent their one switch. That last one
  // is kept in the room's own book rather than trusted to a client,
  // because the plan's clause is "once per voyage" and a rule only a
  // client enforces is a rule a doctored client can spend twice.
  socket.on(
    "path:switch",
    async (payload: { roomId?: string; path?: unknown }) => {
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      const fail = (error: string): void => {
        socket.emit("path:error", { roomId, error });
      };
      if (!pathDraftOn()) {
        fail("The path draft is not running in this build.");
        return;
      }
      // The destination is read off the wire and answered as a path this
      // build has or as nothing: a frame naming a path no table carries is
      // refused rather than published under a default, the reading
      // normalizePath takes everywhere else.
      const to = normalizePath(payload?.path);
      if (!to) {
        fail("No such path.");
        return;
      }
      // The checkpoint read first and every check after it, so nothing
      // between a check and the frame it guards can yield: two switches
      // arriving together, or a switch arriving with the phase change that
      // closed it, must not be able to interleave inside a handler that
      // has already decided.
      const cp = await getCheckpoint(roomId);
      // The window on both axes, in the words the captain's own engine
      // would have refused them in, because the frame a refusal becomes
      // and the line the engine writes are the same fact told once per
      // surface (see pathSwitchOpenLine).
      const when = pathSwitchOpenLine(cp.round, cp.phase);
      if (when !== null) {
        fail(when);
        return;
      }
      if (
        !recordPathSwitch(io, roomId, {
          userId: s.userId,
          name: s.user.displayName,
          path: to,
        })
      ) {
        fail(pathSwitchSpentLine());
      }
    },
  );
}
