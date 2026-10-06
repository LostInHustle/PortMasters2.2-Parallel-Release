// =====================================================================
// The bazaar's two frames, reaching the rules in ../bazaar.
// =====================================================================

import type { Server, Socket } from "socket.io";

import { db } from "@/lib/db";
import {
  rumorCanLand,
  rumorClosingLine,
  rumorCooldownLeft,
  rumorCooldownLine,
  rumorGoodAllowed,
} from "@/lib/game/engine";
import { bazaarRumorsOn } from "@/lib/game/flags";
import { voyageRoundsFor } from "@/lib/game/mode";
import { seated } from "../auth";
import {
  bazaarList,
  bazaarPayloadFor,
  broadcastBazaar,
  publishBazaarRumor,
} from "../bazaar";
import { getCheckpoint } from "../checkpoint";
import { noteVoyageLog } from "../voyage-log";

// The refusal the desk answers with when the switch is off.
const BAZAAR_OFF = "The bazaar is not running in this harbor.";

export function wireBazaar(io: Server, socket: Socket): void {
  //
  // [D5: Aroma: the Bazaar Rumor] The desk's two frames, and the shape of
  // the feature shows in what this server is and is not authoritative
  // about.
  //
  // It is not authoritative about who may speak. The path a captain holds
  // lives in their own save, and this server has never read one, which is
  // the same line the barter board and both consent boards draw. So being
  // the Aroma is not checked here: what the server checks is everything
  // about the row that can be checked without reading anyone's save, which
  // is more than either of the other two markets can check about theirs.
  //
  // It is authoritative about the four things a row has to be true about
  // for the feature to work at all. A rumor is spoken at the Parley, so
  // the table hears it and so the market it moves is the next one. It is
  // spoken in a leg that has a leg after it, so the market it names is one
  // this voyage opens rather than a settlement that never comes. It
  // names a good the coming market actually trades, so a lean always lands
  // on a price rather than on nothing. And it respects the cooldown, which
  // is measured off the room's own rows rather than off a counter a client
  // could carry: the wait between two of one captain's rumors is a fact
  // about this room's voyage, and it is the one rule in this feature that
  // a doctored client could otherwise simply not obey.
  //
  // Where the direction travels is the last of it, and the server is what
  // makes that work: the publish broadcast and the state request both go
  // through the payload builder, which strips a standing row's direction
  // from every reader but its publisher (see publicRumors). There is no
  // frame in this feature that carries a live direction to the room, and
  // the delivery is held rather than trusted here: bazaar:update is the
  // private scan's eighth rule, which refuses a board that reaches a room
  // channel (see scripts/private-scan.ts).
  socket.on("bazaar:state:request", async (payload: { roomId?: string }) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
    const cp = await getCheckpoint(roomId);
    socket.emit("bazaar:update", bazaarPayloadFor(roomId, s.userId, cp.round));
  });

  socket.on(
    "bazaar:publish",
    async (payload: {
      roomId?: string;
      good?: unknown;
      direction?: unknown;
    }) => {
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      const fail = (error: string): void => {
        socket.emit("bazaar:error", { roomId, error });
      };
      if (!bazaarRumorsOn(s.mode)) {
        fail(BAZAAR_OFF);
        return;
      }
      // The lean itself, checked before anything is read: a row whose
      // direction is not exactly one way or the other is not a rumor, and
      // the row is what the whole market prices against.
      if (payload?.direction !== 1 && payload?.direction !== -1) {
        fail("A rumor leans a price one way or the other, and no other way.");
        return;
      }
      const direction = payload.direction;
      // Both reads first and every check after them, so nothing between a
      // check and the row it guards can yield. This is the bench's own
      // rule, stated there for the same reason: two votes, two publishes
      // or two publishes and a phase change arriving together must not be
      // able to interleave inside a handler that has already decided.
      //
      // The order between the two reads is part of that rule rather than
      // an accident of how the handler grew. The room's row is read first
      // because it is the read that waits on the database, and the
      // checkpoint is read last because its leg and its phase are what
      // every check below judges and what the row gets written with: a
      // checkpoint read before the wait would be a checkpoint a phase
      // change could have moved during it, and the refusal below would
      // then be deciding against the seat the room has already left. Both
      // reads stay ahead of every check, and nothing between the last one
      // and publishBazaarRumor below yields.
      const room = await db.room.findUnique({
        where: { id: roomId },
        select: { difficulty: true, mode: true },
      });
      const cp = await getCheckpoint(roomId);
      if (cp.phase !== "parley") {
        fail(
          "A rumor is spread at the Parley, where the whole table hears it.",
        );
        return;
      }
      // The one leg a rumor has nothing to land on. A row is a claim about
      // the port one leg ahead, so a row written in the closing leg would
      // lean a market this voyage never opens: the settlement the plan's
      // own Rollback note asks to be skipped cleanly rather than left half
      // applied, paid for with the publisher's whole cooldown. Read off the
      // voyage's length rather than off the tier, because the two answer
      // different voyages in a mode that pins a length of its own (see
      // voyageRoundsFor), and refused before the good is looked at because
      // there is no coming market to read a good against.
      if (
        !rumorCanLand(cp.round, voyageRoundsFor(room?.mode, room?.difficulty))
      ) {
        fail(rumorClosingLine());
        return;
      }
      // The good is read against the market the rumor will move, which is
      // the next one, and against the room's own tier rather than against
      // the catalogue: see bazaarGoods for why the two lists are one list.
      if (!rumorGoodAllowed(payload?.good, room?.difficulty, cp.round + 1)) {
        fail("The next port does not trade that good.");
        return;
      }
      const good = payload.good as string;
      const list = bazaarList(roomId);
      const left = rumorCooldownLeft(list, s.userId, cp.round);
      if (left > 0) {
        fail(rumorCooldownLine(left));
        return;
      }
      const row = publishBazaarRumor(roomId, {
        publisherUserId: s.userId,
        publisherName: s.user.displayName,
        good,
        direction,
        round: cp.round,
      });
      // [B4: the log surfaces] The room's line, which carries the good and
      // the captain and deliberately not the direction: the log is public
      // the instant it is written, and the direction is not public until
      // the market answers the row (see VoyageLogFacts for this kind).
      noteVoyageLog(io, roomId, {
        kind: "rumor_published",
        captain: row.publisherName,
        good: row.good,
      });
      // One broadcast, and it is the whole table's: the publisher reads
      // their own direction back and everyone else reads the row without
      // it, because the builder decides that per socket rather than this
      // handler deciding it once.
      broadcastBazaar(io, roomId, cp.round);
    },
  );
}
