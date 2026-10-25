// =====================================================================
// The locale frame: the captain's language, kept current on the socket.
//
// The handshake reads it from the pm_locale cookie (../cookies), which
// covers every connection that follows a reload. This frame covers the
// one the cookie cannot: a captain who flips the pick with the tab
// still open. The server composes some captain facing lines at the send
// (tFor over SocketState.locale), so the write here is what carries a
// live flip to those lines. No authentication gate: a language is a
// taste rather than a credential, and a frame that arrives before the
// auth hold has settled writes the same field the handshake already
// filled.
//
// The write covers the harbor's log too, and in two steps. It lands on the
// socket's own copy of the language, which is the one the log's
// accumulator renders each frame from, so every line the harbor writes
// after a flip arrives in the new language. And it asks the log's
// history door for a reprint, because the lines already held on the
// captain's screen were built for the old one: the log is stored as
// facts, so the whole voyage can be read again in the language just
// picked, and the client replaces its copy wholesale rather than leaving
// a log that starts in one language and ends in another.
// =====================================================================

import type { Socket } from "socket.io";

import { isLocale } from "@/lib/game/i18n";
import { sockets } from "../presence";
import { sendVoyageLogHistory } from "../voyage-log";

export function wireLocale(socket: Socket): void {
  socket.on("locale:set", (payload: { locale?: unknown } | undefined) => {
    const next = payload?.locale;
    if (!isLocale(next)) return;
    const state = sockets.get(socket.id);
    if (!state) return;
    const changed = state.locale !== next;
    state.locale = next;
    // The socket's own copy, the one the voyage log reads (see
    // localeOfSocket in ../voyage-log) and the one every handshake writes.
    socket.data.locale = next;
    // The reprint itself. It travels the same socket as the flip and
    // socket.io keeps a connection's frames in order, so the server has
    // already written the new language onto this socket by the time the
    // log is built: the reprint cannot race the flip and land half
    // translated. A captain holding no harbor has no log to reprint, and a
    // harbor that never opened one answers the request path with
    // nothing, so both absences cost a no op rather than a frame.
    if (changed && state.roomId) sendVoyageLogHistory(socket, state.roomId);
  });
}
