// =====================================================================
// Realtime layer: the Loan ledger and Backing resolution.
//
// A granted loan (see aid:help) used to vanish from this server's view
// entirely the moment it was handed over. This is the one piece of
// state that makes it visible to the rest of the harbor, so a third
// captain can back it. Unlike roomAidRequests (which clears the instant
// Settlement's phase ends), a granted loan is a real debt that can span
// the rest of the voyage, so this only ever clears on repayment or a
// fresh voyage (room:restart).
//
// The in process copy stays the read path, so every handler reads a
// loan synchronously exactly as it always did. Every mutation is also
// written through to the Loan table, and the Map is rebuilt from that
// table when the process starts (see hydrateLoans). Why persist at all,
// when the mute list and the price tallies do not: a backer's pledge
// leaves their purse the moment it is accepted. Losing a mute costs
// nothing. Losing a loan destroys Gold a captain actually paid.
// =====================================================================
import type { Server } from "socket.io";
import { db } from "@/lib/db";
import { computeBackingResolution } from "@/lib/game/backing";
import type { LoanRecord } from "./types";
import { userSockets } from "./presence";

const roomOutstandingLoans = new Map<string, LoanRecord[]>();

export function loanList(roomId: string): LoanRecord[] {
  return roomOutstandingLoans.get(roomId) ?? [];
}

export function broadcastLoans(io: Server, roomId: string): void {
  io.to(`room:${roomId}`).emit("loans:update", {
    roomId,
    loans: loanList(roomId),
  });
}

// Writes for a room are chained rather than fired independently, because
// each one is two round trips and they are not commutative. Two races
// were reachable without this: a loan granted and repaid in quick
// succession issued its delete while its own create was still in flight,
// so the delete matched nothing and the create landed afterwards,
// leaving a settled loan in the table to be restored as a phantom debt
// on the next restart. And a pledge accepted immediately after the loan
// was granted issued an update against a row that did not exist yet.
//
// Keyed by room rather than by loan: the volume is a handful of writes
// per voyage, so the coarser key costs nothing and also orders
// clearLoans, which deletes by room.
const loanWriteChain = new Map<string, Promise<unknown>>();

function persistLoanWrite(
  roomId: string,
  what: string,
  work: () => Promise<unknown>,
): void {
  const previous = loanWriteChain.get(roomId) ?? Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(work)
    .catch((err) => {
      console.error(`[loans] failed to persist ${what}:`, err);
    });
  loanWriteChain.set(roomId, next);
  void next.then(() => {
    if (loanWriteChain.get(roomId) === next) loanWriteChain.delete(roomId);
  });
}

// The voyage epoch is read inside the write rather than passed in, so
// the caller stays synchronous and gains no database round trip on a
// path that is already mid settlement. The Map is correct before this
// resolves.
export function rememberLoan(roomId: string, loan: LoanRecord): void {
  roomOutstandingLoans.set(roomId, [...loanList(roomId), loan]);
  persistLoanWrite(roomId, `loan ${loan.debtId}`, async () => {
    const room = await db.room.findUnique({
      where: { id: roomId },
      select: { voyageEpoch: true },
    });
    if (!room) return;
    await db.loan.create({
      data: {
        id: loan.debtId,
        roomId,
        voyageEpoch: room.voyageEpoch,
        borrowerId: loan.borrowerId,
        borrowerName: loan.borrowerName,
        lenderId: loan.lenderId,
        lenderName: loan.lenderName,
        amount: loan.amount,
        round: loan.round,
      },
    });
  });
}

// Called whenever a backer or a redirect is attached to a loan already
// on the ledger. The Map holds the same object the handler just
// mutated, so only the database needs catching up.
export function updateLoan(roomId: string, loan: LoanRecord): void {
  persistLoanWrite(roomId, `loan ${loan.debtId}`, () =>
    db.loan.update({
      where: { id: loan.debtId },
      data: {
        backerId: loan.backerId ?? null,
        backerName: loan.backerName ?? null,
        backedAmount: loan.backedAmount ?? null,
        redirectToUserId: loan.redirectToUserId ?? null,
        redirectToName: loan.redirectToName ?? null,
      },
    }),
  );
}

export function clearLoans(io: Server, roomId: string): void {
  if (!roomOutstandingLoans.has(roomId)) return;
  roomOutstandingLoans.delete(roomId);
  persistLoanWrite(roomId, `clear for room ${roomId}`, () =>
    db.loan.deleteMany({ where: { roomId } }),
  );
  broadcastLoans(io, roomId);
}

export function removeLoan(roomId: string, debtId: string): void {
  const list = roomOutstandingLoans.get(roomId);
  if (!list) return;
  const next = list.filter((l) => l.debtId !== debtId);
  if (next.length) roomOutstandingLoans.set(roomId, next);
  else roomOutstandingLoans.delete(roomId);
  persistLoanWrite(roomId, `settlement of ${debtId}`, () =>
    db.loan.deleteMany({ where: { id: debtId } }),
  );
}

// [MANIFEST 05: Backing] Resolves whatever pledge sits on a loan that
// has just closed, and tells both sides. Shared because there are
// exactly two ways a loan closes and they were carrying byte for byte
// copies of this: a borrower reporting their own settlement over
// aid:repay, and the conclusion sweep standing in for a borrower who
// never did. They differ only in how much the borrower actually paid,
// which is the argument.
//
// Both recipients come off the loan record rather than off anything a
// caller passes in. The loan is the server's own copy of who lent and
// who backed; a payload is whatever a client said.
export function resolveBackingFor(
  io: Server,
  roomId: string,
  loan: LoanRecord,
  repaidAmount: number,
): void {
  if (!loan.backerId || !loan.backedAmount) return;
  const { calledAmount, refundAmount } = computeBackingResolution(
    loan.amount,
    repaidAmount,
    loan.backedAmount,
  );
  for (const sid of userSockets.get(loan.backerId) ?? []) {
    io.to(sid).emit("backing:resolved", {
      roomId,
      debtId: loan.debtId,
      refundAmount,
      calledAmount,
    });
  }
  if (calledAmount > 0) {
    for (const sid of userSockets.get(loan.lenderId) ?? []) {
      io.to(sid).emit("backing:covered", {
        roomId,
        debtId: loan.debtId,
        amount: calledAmount,
        backerName: loan.backerName,
        borrowerName: loan.borrowerName,
      });
    }
  }
}

// Rebuilds the ledger when the process starts. Without this the table
// would be write only and the durability it exists for would never
// arrive: a restart mid voyage would still forget every loan, every
// pledge and every redirect. Loans whose room has moved on to a later
// voyage are dropped rather than restored, the same scoping
// ConvoyVenture uses, so a restarted voyage never inherits the last
// one's debts.
export async function hydrateLoans(): Promise<void> {
  try {
    const rows = await db.loan.findMany({
      include: { room: { select: { voyageEpoch: true } } },
    });
    let restored = 0;
    const stale: string[] = [];
    for (const row of rows) {
      if (row.voyageEpoch !== row.room.voyageEpoch) {
        stale.push(row.id);
        continue;
      }
      const record: LoanRecord = {
        debtId: row.id,
        borrowerId: row.borrowerId,
        borrowerName: row.borrowerName,
        lenderId: row.lenderId,
        lenderName: row.lenderName,
        amount: row.amount,
        round: row.round,
        ...(row.backerId ? { backerId: row.backerId } : {}),
        ...(row.backerName ? { backerName: row.backerName } : {}),
        ...(row.backedAmount !== null
          ? { backedAmount: row.backedAmount }
          : {}),
        ...(row.redirectToUserId
          ? { redirectToUserId: row.redirectToUserId }
          : {}),
        ...(row.redirectToName ? { redirectToName: row.redirectToName } : {}),
      };
      roomOutstandingLoans.set(row.roomId, [
        ...(roomOutstandingLoans.get(row.roomId) ?? []),
        record,
      ]);
      restored++;
    }
    if (stale.length) {
      await db.loan.deleteMany({ where: { id: { in: stale } } });
    }
    if (restored || stale.length) {
      console.log(
        `[loans] restored ${restored} outstanding loan(s), dropped ${stale.length} from an earlier voyage`,
      );
    }
  } catch (err) {
    console.error("[loans] failed to restore the ledger on startup:", err);
  }
}

// Wipes the ledger for a room without broadcasting or persisting. Called
// when the room itself is being torn down (last member departed) and
// the Loan rows went with it on cascade.
export function clearLoansSilent(roomId: string): void {
  roomOutstandingLoans.delete(roomId);
}
