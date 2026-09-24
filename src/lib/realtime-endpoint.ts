// =====================================================================
// PortMasters 2.2 Parallel Release: what both ends of the realtime
// channel have to agree on.
//
// Both sides read it from here: the browser client in src/lib/realtime.ts
// when it opens the socket, and the server mount in
// src/server/realtime/index.ts when it creates the Socket.IO server. One
// constant means the two can never drift apart into the silent failure
// where the browser reconnects forever to a path nothing is listening on.
//
// This module must stay dependency free and side effect free: the client
// bundle imports it too.
// =====================================================================

export const SOCKET_PATH = "/socket.io";

// The longest line either chat surface will take, counted in characters
// before any markup. The client stops a captain typing past it and the
// server refuses anything longer, and the two used to be three separate
// literals, so a change to one would have been a change to the rule on
// one side only.
export const CHAT_MESSAGE_MAX = 1000;
