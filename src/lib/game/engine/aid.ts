// =====================================================================
// Loans between captains: the local Gold and ledger half of each step.
//
// A loan is real cross player state, the same category of problem as a
// barter trade. Both sides need to agree it happened, but neither side's
// Gold total is the server's to know, so posting a request and finding a
// captain to help happen over the aid:* socket events
// (src/server/realtime.ts, src/lib/use-aid.ts) while the functions here
// only move the money on whichever client they run on.
//
// grantHelperReputation lives here rather than in ./backingState because
// lending and backing deliberately share one per voyage Reputation
// ceiling: two separate ceilings would just move the exploit from
// whichever is capped to whichever is not. ./backingState imports it.
// =====================================================================
import { AID_REPUTATION_PER_GOLD, helperReputationCapFor } from "../constants";
import type { GameState } from "../types";

// The borrower's side: the Gold arrives and the debt goes on their ledger.
export function receiveLoan(
  state: GameState,
  loan: { id: string; fromUserId: string; fromName: string; amount: number },
  logs: string[],
) {
  state.money += loan.amount;
  state.debts.push({
    id: loan.id,
    counterpartyId: loan.fromUserId,
    counterpartyName: loan.fromName,
    amount: loan.amount,
    roundBorrowed: state.currentRound,
  });
  logs.push(
    `🆘 ${loan.fromName} lent you ${loan.amount} Gold. Repay it before the voyage ends, or it's deducted automatically.`,
  );
}

// Reputation earned by helping another captain, whether by lending (see
// grantLoan) or by backing someone else's loan (see receiveBackingOutcome).
// Both share one per voyage ceiling rather than having one each, because
// two separate ceilings would just move the exploit from whichever is
// capped to whichever is not. Returns what was actually granted, which can
// be zero once the ceiling is reached, so the caller can word its own log
// line honestly rather than claiming Reputation the captain did not get.
export function grantHelperReputation(
  state: GameState,
  rawGain: number,
  logs: string[],
): number {
  const cap = helperReputationCapFor(state.difficulty);
  const headroom = Math.max(0, cap - state.helperReputationEarned);
  const granted = Math.min(Math.max(1, rawGain), headroom);
  if (granted <= 0) {
    logs.push(
      `🤝 No Reputation this time: you have already earned this voyage's full ${cap} for helping other captains.`,
    );
    return 0;
  }
  state.score += granted;
  state.helperReputationEarned += granted;
  return granted;
}

export function grantLoan(
  state: GameState,
  loan: {
    id: string;
    borrowerId: string;
    borrowerName: string;
    amount: number;
  },
  logs: string[],
) {
  state.money -= loan.amount;
  state.loansGiven.push({
    id: loan.id,
    counterpartyId: loan.borrowerId,
    counterpartyName: loan.borrowerName,
    amount: loan.amount,
    roundBorrowed: state.currentRound,
  });
  const repGain = grantHelperReputation(
    state,
    Math.floor(loan.amount * AID_REPUTATION_PER_GOLD),
    logs,
  );
  if (repGain > 0) {
    logs.push(
      `🤝 Lent ${loan.borrowerName} ${loan.amount} Gold. Reputation +${repGain} for helping a fellow captain.`,
    );
  } else {
    logs.push(`🤝 Lent ${loan.borrowerName} ${loan.amount} Gold.`);
  }
}

// Voluntary, captain initiated repayment. The caller (GameRoom.tsx) reads
// the debt's amount and lender from state.debts before calling this, the
// same already known values pattern the Bartering panel uses for posting
// an offer, so it can relay the matching aid:repay itself right after.
export function repayLoan(state: GameState, debtId: string, logs: string[]) {
  const debt = state.debts.find((d) => d.id === debtId);
  if (!debt) return;
  if (state.money < debt.amount) {
    logs.push(
      `❌ Need ${debt.amount} Gold to repay ${debt.counterpartyName}, have ${state.money}`,
    );
    return;
  }
  state.money -= debt.amount;
  state.debts = state.debts.filter((d) => d.id !== debtId);
  logs.push(`💰 Repaid ${debt.counterpartyName}: ${debt.amount} Gold`);
}

// The lender's side of either a voluntary repayment or a forced one (see
// settleOutstandingDebts below); both arrive the same way, over aid:repay.
export function receiveRepayment(
  state: GameState,
  debtId: string,
  amount: number,
  fromName: string,
  logs: string[],
) {
  state.loansGiven = state.loansGiven.filter((l) => l.id !== debtId);
  state.money += amount;
  logs.push(`💰 ${fromName} repaid you ${amount} Gold`);
}

// [MANIFEST 07: Bequest Routing] Called only on the original lender's own
// client, only for a loan they redirected before it was repaid. No Gold
// changes here: the redirect target already received it via
// receiveRepayment on their own client instead. This only stops a debt
// that is no longer open from sitting in loansGiven forever, which is
// what would otherwise happen since aid:repaid never reaches this client
// for a redirected loan.
export function clearRedirectedLoan(
  state: GameState,
  debtId: string,
  redirectedToName: string,
  logs: string[],
) {
  state.loansGiven = state.loansGiven.filter((l) => l.id !== debtId);
  logs.push(`🤝 Your bequest was paid out to ${redirectedToName}`);
}

// Called once, at the true end of Round 8 (see endRound below), never
// before: any loan a captain hasn't already repaid by then gets forced
// through, paying whatever can be covered. Falling short of the full
// amount owed is what flags defaultedDebt for the endgame screen, rather
// than bankrupting mid voyage, since by this point the voyage is ending
// for everyone regardless.
export function settleOutstandingDebts(state: GameState, logs: string[]) {
  if (!state.debts.length) return;
  logs.push("\n📋=== Settling Outstanding Loans ===");
  const settlements: {
    lenderId: string;
    lenderName: string;
    amount: number;
    debtId: string;
  }[] = [];
  for (const debt of state.debts) {
    const paid = Math.min(state.money, debt.amount);
    state.money -= paid;
    // Reported even when paid is 0. This record is not only "credit the
    // lender", it is also the one signal that closes the debt on the server's
    // ledger and resolves any Backing pledge on it (see aid:repay in
    // src/server/realtime.ts). Skipping it for a total default used to strand
    // the loan open forever: the backer's escrowed Gold was neither returned
    // nor called, and the lender never received the coverage that pledge
    // existed for, which is precisely the case Backing is meant to cover.
    settlements.push({
      lenderId: debt.counterpartyId,
      lenderName: debt.counterpartyName,
      amount: paid,
      debtId: debt.id,
    });
    if (paid < debt.amount) {
      state.defaultedDebt = true;
      logs.push(
        `⚠️ Could not fully repay ${debt.counterpartyName}: paid ${paid} of ${debt.amount} Gold owed`,
      );
    } else {
      logs.push(
        `💰 Settled outstanding loan to ${debt.counterpartyName}: ${paid} Gold`,
      );
    }
  }
  state.debts = [];
  state._pendingDebtSettlements = [
    ...(state._pendingDebtSettlements ?? []),
    ...settlements,
  ];
}
