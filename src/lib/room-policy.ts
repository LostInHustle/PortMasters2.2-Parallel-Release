// =====================================================================
// PortMasters 2.2 Parallel Release: harbor policy shared by both ends
//
// Pure rules about a harbor that the browser and the server both read:
// whether a captain may enter, and how a harbor name is displayed. They
// live outside ./rooms because that module constructs the database client,
// and a lobby component that asked one of these questions would otherwise
// pull Prisma into its bundle.
// =====================================================================

// Whether a harbor is closed to a captain who is not already in it.
//
// Two callers reach this and they name the field differently: the lobby's
// summary carries members with an id, and the room row the join routes load
// carries members with a userId. Both hand over the started flag and the
// list of ids, which is everything the rule reads.
//
// The lobby had been drawing this as `started && !isMember` and stopping
// there, so a harbor whose whole crew had gone home showed as Locked, with
// its Enter button disabled under the label and the takeover described in
// ./rooms reachable only by whoever still had the code. Kept away from the
// database client, because the screen that asks it must not carry the
// server's Prisma graph into the browser.
export function roomLockedFor(
  started: boolean,
  memberIds: readonly string[],
  userId: string,
): boolean {
  if (!started || memberIds.includes(userId)) return false;
  return memberIds.length > 0;
}

// Mobile keyboards and pasted text love to leave behind double spaces or a
// stray non breaking space, which show up as odd gaps once a harbor name is
// rendered. Collapse any run of whitespace down to one regular space and
// trim the ends so a messy paste still looks clean. Used both when a harbor
// is created and defensively wherever a name gets rendered, so any harbor
// named before this existed still displays cleanly.
export function normalizeRoomName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}
