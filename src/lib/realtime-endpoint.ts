// =====================================================================
// PortMasters 2.2 Parallel Release: the one address the realtime channel
// answers on.
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
