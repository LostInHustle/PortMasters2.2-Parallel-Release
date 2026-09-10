"use client";

import { useEffect, useState } from "react";
import { Anchor } from "lucide-react";
import { api } from "@/lib/api";
import { disconnectSocket, setAuthToken } from "@/lib/realtime";
import type { PublicUser } from "@/lib/db";
import { AuthScreen } from "@/components/portmasters/AuthScreen";
import { Lobby } from "@/components/portmasters/Lobby";
import { GameRoom } from "@/components/portmasters/GameRoom";
import type { RoomDetail } from "@/lib/rooms";

type Status = "loading" | "auth" | "lobby" | "game";

export default function Home() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [room, setRoom] = useState<RoomDetail | null>(null);

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
    setStatus("auth");
  };

  if (status === "loading") {
    return (
      <main className="pm-canvas flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="pm-grad-primary flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg">
            <Anchor className="h-8 w-8" />
          </div>
          <p className="pm-text-sea font-display text-lg">
            Reading the tide tables...
          </p>
        </div>
      </main>
    );
  }

  if (status === "auth" || !user) {
    return (
      <AuthScreen
        onAuthed={(u, token) => {
          if (token) setAuthToken(token);
          setUser(u);
          setStatus("lobby");
        }}
      />
    );
  }

  if (status === "lobby") {
    return (
      <Lobby
        me={user}
        onEnterRoom={async (r) => {
          try {
            const { room: detail } = await api.getRoom(r.id);
            setRoom(detail);
            setStatus("game");
          } catch {
            setRoom(null);
            setStatus("lobby");
          }
        }}
        onLogout={handleLogout}
      />
    );
  }

  if (status === "game" && room) {
    return (
      <GameRoom
        me={user}
        room={room}
        onLeave={() => {
          setRoom(null);
          setStatus("lobby");
        }}
      />
    );
  }

  return (
    <Lobby
      me={user}
      onEnterRoom={async () => {
        setStatus("lobby");
      }}
      onLogout={handleLogout}
    />
  );
}
