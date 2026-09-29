// =====================================================================
// PortMasters 2.2 Parallel Release: the account shapes both halves share.
//
// The account shapes both halves share.
//
// The wire of this game is described once, in this directory, and both halves
// read the same declarations: the client hooks in src/lib/use-*.ts and the
// realtime server in src/server/realtime. That is why nothing in here has a
// socket, a Prisma call or a React import in it, and why a shape a screen and
// a channel both need belongs here rather than in two files that drift.
// =====================================================================

// The public projection of a user account: what every other captain is
// allowed to know about anyone, never the password hash or the email.
export type PublicUser = {
  id: string;
  username: string;
  displayName: string;
  avatarHue: number;
};

// A public user plus the room they are currently seated in (or null when
// they are adrift in the lobby). This is the shape the presence channel
// broadcasts; mirroring it here lets the client presence hook and the
// server presence map agree on the wire format.
export type OnlineUser = PublicUser & { roomId: string | null };

// The same public user, used as the row in a room roster. The joinedAt
// stamp lives on the membership row and is included wherever the lobby
// or the room panel needs to render it.
export type RoomMemberLive = PublicUser & { joinedAt?: string };
