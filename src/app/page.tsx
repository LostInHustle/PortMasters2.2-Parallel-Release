"use client";

import { useEffect, useState } from "react";
import { PageSplash } from "@/components/ui/page-splash";
import { api } from "@/lib/api";
import { disconnectSocket, setAuthToken } from "@/lib/realtime";
import type { PublicUser } from "@/lib/db";
import { AuthScreen } from "@/components/portmasters/AuthScreen";
import { Lobby } from "@/components/portmasters/Lobby";
import { GameRoom } from "@/components/portmasters/GameRoom";
import type { RoomDetail } from "@/lib/rooms";
import type { RoomSummary } from "@/lib/api";

type Status = "loading" | "auth" | "lobby" | "game";

export default function Home() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [room, setRoom] = useState<RoomDetail | null>(null);
  // Something that happened to this captain from outside, kept for the
  // screen they landed on afterwards: the reason the server refused their
  // session, or the reason a harbor they were sitting in stopped existing.
  // Nothing else writes here, and signing in clears it.
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.me().catch(() => ({ user: null, token: null })),
      api.getActiveRoom().catch(() => ({ room: null })),
    ]).then(([meRes, activeRes]) => {
      if (cancelled) return;
      if (meRes.user) {
        if (meRes.token) setAuthToken(meRes.token);
        setUser(meRes.user);
        if (activeRes.room) {
          setRoom(activeRes.room);
          setStatus("game");
        } else {
          setStatus("lobby");
        }
      } else {
        setStatus("auth");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // best effort
    }
    disconnectSocket();
    setAuthToken(null);
    setUser(null);
    setRoom(null);
    setNotice(null);
    setStatus("auth");
  };

  // The realtime layer refused this connection's credentials, so the
  // session behind it is over: it ran out, or an operator banned the
  // account or deleted it. This is the same teardown signing out does,
  // with the reason kept for the sign in screen, because there is nothing
  // left to go back to either way.
  const handleSessionLost = (message: string) => {
    disconnectSocket();
    setAuthToken(null);
    setUser(null);
    setRoom(null);
    setNotice(message);
    setStatus("auth");
  };

  if (status === "loading") {
    return <PageSplash line="Reading the tide tables..." badge />;
  }

  if (status === "auth" || !user) {
    return (
      <AuthScreen
        onAuthed={(u, token) => {
          if (token) setAuthToken(token);
          setUser(u);
          setNotice(null);
          setStatus("lobby");
        }}
        notice={notice}
        onDismissNotice={() => setNotice(null)}
      />
    );
  }

  // Entering a harbor always means the same two things: hold the room
  // detail this page renders from, and switch to the game screen. Both
  // Lobby renders below hand over this handler, so the fall through one
  // cannot strand a click by having no room to pass on.
  const enterRoom = async (summary: RoomSummary) => {
    try {
      const { room: detail } = await api.getRoom(summary.id);
      setRoom(detail);
      setStatus("game");
    } catch {
      setRoom(null);
      setStatus("lobby");
    }
  };

  // The harbor screen, built once and returned from both places that draw
  // it: the lobby proper, and the fall through below.
  const harbor = (
    <Lobby
      me={user}
      onEnterRoom={enterRoom}
      onLogout={handleLogout}
      onSessionLost={handleSessionLost}
      notice={notice}
      onDismissNotice={() => setNotice(null)}
    />
  );

  if (status === "lobby") {
    return harbor;
  }

  if (status === "game" && room) {
    return (
      <GameRoom
        me={user}
        room={room}
        onLeave={(message) => {
          setRoom(null);
          // A walk out carries no message and clears whatever was here; a
          // harbor closed underneath this captain carries the reason.
          setNotice(message ?? null);
          setStatus("lobby");
        }}
        onSessionLost={handleSessionLost}
      />
    );
  }

  // The fall through: a game screen with no room to draw, which is where a
  // harbor that closed underneath this captain lands.
  return harbor;
}
