// =====================================================================
// PortMasters 2.2 Parallel Release: a loan between two captains.
//
// An outstanding loan between two captains.
//
// The backer and the redirect are the two ways a debt stops being between the
// two captains it started with, and both are optional because most debts never
// leave the pair.
// =====================================================================

// An outstanding loan between two captains. The optional backer and
// redirect fields are set only when a third captain has pledged a safety
// net, or the original lender has redirected future repayment elsewhere
// (typically at bankruptcy).
export type LoanRecord = {
  debtId: string;
  borrowerId: string;
  borrowerName: string;
  lenderId: string;
  lenderName: string;
  amount: number;
  round: number;
  backerId?: string;
  backerName?: string;
  backedAmount?: number;
  redirectToUserId?: string;
  redirectToName?: string;
};
