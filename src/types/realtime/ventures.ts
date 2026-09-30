// =====================================================================
// PortMasters 2.2 Parallel Release: a convoy venture.
//
// A convoy venture as the venture channel sends it.
//
// The contributor row is read through the summary rather than named by any
// caller, and the status is a string here on purpose: this directory describes
// the wire and does not import the module that owns the words.
// =====================================================================

// A convoy venture as the venture channel sends it. Status is one of
// "open", "filled", "failed", or "destroyed" but kept as a string here
// so this file has no runtime dependency on the convoy module's enum.
export type VentureSummary = {
  id: string;
  posterId: string;
  posterName: string;
  targetGold: number;
  deadlineRound: number;
  payoutMultiplier: number;
  status: string;
  total: number;
  contributions: VentureContributor[];
};

// A single contributor to a convoy venture. Not exported: it is read
// through VentureSummary.contributions rather than named by any caller.
type VentureContributor = {
  userId: string;
  name: string;
  amount: number;
};
