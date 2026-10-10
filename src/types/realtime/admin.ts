// =====================================================================
// PortMasters 2.2 Parallel Release: the operator console.
//
// The operator console.
//
// One row per account with the two counts that say how much of the live game it
// holds, the roster the console reads again after every change it makes, and the
// bulk action with its account by account report.
// =====================================================================

// One row of the operator console's roster, sent on admin:accounts. It
// carries the account facts plus the two counts that say how much of the
// live game the account is holding, which is exactly what an operator
// needs before banning or purging it: a captain with seats and harbors is
// a captain other people are currently sitting with.
//
// role is one of "captain" or "admin", kept as a string for the same
// reason VentureSummary keeps its status as one, so this file stays a
// pure description with no runtime dependency.
export type AdminAccount = {
  id: string;
  username: string;
  displayName: string;
  avatarHue: number;
  role: string;
  // ISO 8601 when the account is banned, null when it is in good standing.
  bannedAt: string | null;
  createdAt: string;
  roomsHosted: number;
  seatsHeld: number;
  online: boolean;
};

// The reply to admin:list and to every admin action that changes
// something: the roster as it stands after the change, so the console
// never has to guess what its own click did.
export type AdminRoster = {
  accounts: AdminAccount[];
};

// The four things an operator can do to a whole selection at once. The
// same four are on every row one account at a time, and they are worded
// from the console's side rather than the database's: "grant" is the
// console's Make admin, and "purge" is its Delete.
export type AdminBulkAction = "ban" | "unban" | "grant" | "purge";

// What a bulk action did. The request is answered account by account
// rather than as a yes or a no, because a selection is allowed to contain
// accounts an action does not apply to: one that is already banned, or
// the operator's own. Each of those is skipped with the reason the server
// would have given if it had been the only one asked for, and the console
// prints them rather than hiding them, so an operator who selected twelve
// accounts and sees eleven changes knows which one was left and why.
export type AdminBulkReport = {
  action: AdminBulkAction;
  // How many accounts the request named, and how many of them changed.
  requested: number;
  applied: number;
  skipped: string[];
};
