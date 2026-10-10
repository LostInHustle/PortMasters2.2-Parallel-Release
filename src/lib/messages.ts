// =====================================================================
// PortMasters 2.2 Parallel Release: the message read, in one place.
//
// Plain database shaping with no Next specific imports, so the routes that
// answer with a timeline and anything else that has to read one can share
// it, the way ./rooms.ts is shared for the harbor.
//
// The two routes that read a message history (the harbor square and a
// direct thread) agreed about three things by copying them: which order a
// timeline comes back in, how many rows a page holds, and what a row looks
// like once the client has it. Copies of an agreement drift, and the drift
// here is silent: a route that lost the `mine` flag would render every
// bubble on the left, and nothing in the request would have failed.
// =====================================================================
import { PUBLIC_USER_SELECT, type PublicUser } from "./db";

// The one place a message row becomes the shape the client reads.
//
// `mine` is decided here rather than by the client because the client does
// not decide it either: three call sites in ChatPanel work it out for
// themselves from the sender's id (see the panel's socket handlers), and
// the flag has to mean the same thing in a fetched page as in a live
// frame. Answering it from the viewer's id at the read is what keeps a
// backlog row and a pushed row right aligned the same way.
//
// The parameter is structural rather than a Prisma type, so a caller whose
// row came back with a select projection or with extra columns is not
// turned away for it.
type MessageRow = {
  id: string;
  content: string;
  createdAt: string;
  sender: PublicUser;
  mine: boolean;
};

export function messageRows(
  rows: Array<{
    id: string;
    content: string;
    createdAt: Date;
    senderId: string;
    sender: PublicUser;
  }>,
  viewerId: string,
): MessageRow[] {
  return rows.map((m) => ({
    id: m.id,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    sender: m.sender,
    // Read from the sender's id rather than from `sender.id` so the answer
    // does not depend on which projection the caller asked for: a read
    // that selected a narrower sender still knows who wrote the row.
    mine: m.senderId === viewerId,
  }));
}

// What every timeline read asks the database for: the sender's public side
// included, oldest first so the panel renders it straight into the
// timeline without sorting, and the same page size on both channels. It is
// spread into a query rather than repeated: `take` differs nowhere today,
// and the day one channel wants a different page it can say so beside its
// own query rather than by editing this one.
export const MESSAGE_PAGE = {
  orderBy: { createdAt: "asc" },
  take: 200,
  include: { sender: { select: PUBLIC_USER_SELECT } },
} as const;
