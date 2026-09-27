// GET /api/game/state?roomId=...: load my saved game state for a room
// PUT /api/game/state: save my game state for a room
//
// The PUT always writes the save, even if the integrity check flags it.
// The consequence lands at voyage end (the realtime layer reads
// integritySeverity and skips Renown for an impossible save). The
// response shape is identical whether or not the save tripped the guard,
// so a tampering client learns nothing about whether it was caught.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/api-auth";
import { DEFAULT_DIFFICULTY } from "@/lib/game/difficulty";
import { DEFAULT_MODE } from "@/lib/game/mode";
import {
  checkSave,
  describeFindings,
  snapshotFromSave,
} from "@/lib/game/integrity";
import { readJson } from "@/lib/api-json";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roomId = req.nextUrl.searchParams.get("roomId");
  if (!roomId) return NextResponse.json({ state: null });

  const state = await db.gameState.findUnique({
    where: { userId_roomId: { userId: user.id, roomId } },
  });

  // Always load the room's difficulty so the client can seed a fresh
  // voyage on the right tier and refresh a restored one from the room.
  // The room is the single source of truth for difficulty (a save can
  // predate a restart that changed it). A brand new captain (no save yet)
  // should also drop into the voyage at wherever the room currently is,
  // not back at round 1. The room's checkpoint is what the synchronized
  // ready check keeps everyone else lined up against.
  //
  // The room's mode rides along for exactly the same reasons, and one
  // sharper one: mode decides the order this captain's phases run in, and
  // a client that restored a save under the wrong lap would run the right
  // phases in the wrong order and desynchronize from the room without
  // either side being able to tell why.
  //
  // [H5: the quota rung] The seat count this voyage was pinned to rides
  // along as well, and it is the one room fact here a client cannot work
  // out for itself: the commission's quotas scale with the size of the
  // fleet the voyage was dealt to, so a captain who reloads mid voyage has
  // to be handed the departure's number rather than counting the names on
  // a roster that may have changed since. 0 means the room has no voyage
  // pinned, and the client draws the founding board for it.
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: {
      currentRound: true,
      currentPhase: true,
      voyageEpoch: true,
      voyageSeats: true,
      difficulty: true,
      mode: true,
    },
  });
  const difficulty = room?.difficulty ?? DEFAULT_DIFFICULTY;
  const mode = room?.mode ?? DEFAULT_MODE;
  const checkpoint =
    !state && room
      ? {
          currentRound: room.currentRound,
          currentPhase: room.currentPhase,
          voyageEpoch: room.voyageEpoch,
        }
      : null;

  return NextResponse.json({
    state: state?.data ?? null,
    checkpoint,
    difficulty,
    mode,
    seats: room?.voyageSeats ?? 0,
  });
}

const SaveSchema = z.object({
  roomId: z.string().min(1),
  data: z.record(z.string(), z.any()),
});

// [J1: the private information review] A bound on the blob itself, which
// no other part of this route has. The check above judges four numbers
// inside the save and the design is deliberately that everything else is
// written as sent: the engine is client authoritative, so a captain's own
// voyage is theirs to compute. What no client needs is an unbounded one.
// A save is not a private cost to the captain who wrote it either, because
// the harbor reads it: the conclusion parses every save at the table and
// the Manifest Audit samples one of them, so an enormous blob is paid for
// by everyone in the room, on every finish, in the code path that has to
// finish before a voyage can end.
//
// Measured before the number was chosen: five real rows on a live database
// run 1.5 KB to 3.5 KB. 64 KB is around twenty times the largest, which is
// room for a long voyage, a big hold and a full ledger. The parse has
// already happened by the time this runs, so what it bounds is everything
// after it rather than the request itself.
const SAVE_BODY_MAX = 64 * 1024;

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJson(req, SaveSchema);
  if (!body.ok) return body.response;
  const { roomId, data } = body.data;

  // Must be a member of the room to save state there.
  const member = await db.roomMember.findUnique({
    where: { userId_roomId: { userId: user.id, roomId } },
  });
  if (!member)
    return NextResponse.json(
      { error: "Not a member of that room" },
      { status: 403 },
    );

  // [MANIFEST 13: Ledger Integrity Pass] The one guard on an endpoint
  // that otherwise writes whatever arrives. The save is still accepted
  // either way: a captain mid voyage must never lose their game to a
  // false positive, and the ceiling in integrity.ts is set from the
  // theoretical maximum precisely so it cannot produce one. What an
  // implausible save does earn is a permanent mark on the row, so the
  // account level features that later read standings can decline to
  // trust it.
  //
  // Judged against the room's own currentRound rather than anything in
  // the payload. That is the one number here the client cannot forge:
  // the synchronized ready check in the realtime layer owns it.
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { currentRound: true },
  });
  const snapshot = snapshotFromSave(data);
  const verdict = snapshot
    ? checkSave(snapshot, room?.currentRound ?? 1)
    : { plausible: true, severity: "ok" as const, findings: [] };

  const json = JSON.stringify(data);
  if (json.length > SAVE_BODY_MAX) {
    return NextResponse.json(
      { error: "That voyage save is too large to store." },
      { status: 413 },
    );
  }
  // Only ever set the mark, never clear it. A save that was implausible
  // once stays flagged even if every later save looks ordinary, since
  // the point is that this account claimed it at all. The severity
  // rides alongside so the voyage conclusion can act on an impossible
  // one without having to read the note.
  const flag = verdict.plausible
    ? {}
    : {
        integritySeverity: verdict.severity,
        integrityNote: describeFindings(verdict.findings),
      };

  if (!verdict.plausible) {
    console.warn(
      `[integrity] ${verdict.severity} save user=${user.id} room=${roomId} ${describeFindings(verdict.findings)}`,
    );
  }

  const record = await db.gameState.upsert({
    where: { userId_roomId: { userId: user.id, roomId } },
    create: { userId: user.id, roomId, data: json, ...flag },
    update: { data: json, ...flag },
  });

  // Deliberately unchanged in shape. A tampering client learns nothing
  // about whether it tripped the guard, and an honest one has nothing
  // to act on.
  return NextResponse.json({ ok: true, updatedAt: record.updatedAt });
}
