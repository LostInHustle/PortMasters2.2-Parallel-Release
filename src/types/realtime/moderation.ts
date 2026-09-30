// =====================================================================
// PortMasters 2.2 Parallel Release: the mute list and the report row.
//
// [J2: the mute and the report] The moderation surface on the wire.
//
// Two shapes, one each way. The roster frame carries the mute list, and
// the answer to a report travels back to the captain who filed it.
//
// The roster frame is declared here rather than typed inline at each of
// its readers, because the meaning of one of its fields narrowed and a
// narrowed meaning that lives in three places is a meaning that will drift
// back: mutedUserIds is what THIS recipient may see, not the room's list.
// The server builds the shape, so annotating the payload there is what
// holds it to this declaration, and both client readers take the type from
// here rather than restating it.
// =====================================================================

import type { RoomMemberLive } from "./presence";

export type RoomMembersPayload = {
  roomId: string;
  members: RoomMemberLive[];
  /** The room's current host, or null when the row has gone. Read so a
      reassigned host sees the Start Game control without a refresh. */
  hostId: string | null;
  /** The captains this recipient may see as muted. The host is handed the
      whole list, a muted captain is handed their own id, and every other
      captain is handed an empty list: a mute is the host's judgement of
      one captain, and the room is the wrong audience for it. Optional
      because a reader treats a wire field defensively whatever the writer
      intended, which is the same rule every other payload read follows. */
  mutedUserIds?: string[];
};

/** The answer a filed report gets, delivered to the captain who filed it
 *  and to nobody else. It carries no reason and no free text: the row
 *  holds who, about whom and in which voyage, and this exists so the
 *  button can settle rather than to explain anything. */
export type PlayerReportAck = {
  roomId: string;
  targetUserId: string;
  /** True when this captain had already reported this captain this
      voyage, so nothing new was written. */
  alreadyFiled: boolean;
};
