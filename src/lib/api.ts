// =====================================================================
// PortMasters 2.2 Parallel Release: REST API helpers (typed fetch wrappers)
//
// Every URL is a relative path, so the browser calls whatever origin
// served the page. The API routes, the page and the realtime socket all
// live on that one origin, so nothing here needs a host or a port.
// =====================================================================
import type { CaptainLegacySummary } from "@/lib/game/legacy";
import type { CheckInStatus } from "@/lib/game/checkin";
import type { Difficulty } from "@/lib/game/difficulty";
import type { HouseId } from "@/lib/game/legacy";
import type {
  HouseStanding,
  LeaderboardEntry,
  PublicUser,
  RivalEntry,
  VoyageChronicle,
} from "@/types/realtime";

// Re-exported so existing call sites that imported PublicUser from
// "@/lib/api" keep compiling. The canonical home is @/types/realtime.
export type { PublicUser };

export type RoomSummary = {
  id: string;
  code: string;
  name: string;
  isPublic: boolean;
  started: boolean;
  difficulty: Difficulty;
  createdAt: string;
  host: PublicUser;
  memberCount: number;
  members: Array<PublicUser & { joinedAt: string }>;
};

export type RoomDetail = RoomSummary & { isMember: boolean };

export type ChatMessage = {
  id: string;
  content: string;
  createdAt: string;
  sender: PublicUser;
  mine?: boolean;
  recipient?: PublicUser;
};

async function jfetch<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      ...init,
    });
  } catch {
    throw new Error("Cannot reach the server. It may be temporarily offline.");
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg =
      data?.error || `Server error (${res.status}). Please try again later.`;
    throw new Error(msg);
  }
  return data as T;
}

export const api = {
  // Auth
  me: () =>
    jfetch<{ user: PublicUser | null; token: string | null }>("/api/auth/me"),
  register: (body: {
    username: string;
    password: string;
    displayName?: string;
  }) =>
    jfetch<{ user: PublicUser; expiresAt: string; token: string }>(
      "/api/auth/register",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),
  login: (body: { username: string; password: string }) =>
    jfetch<{ user: PublicUser; expiresAt: string; token: string }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),
  logout: () => jfetch<{ ok: true }>("/api/auth/logout", { method: "POST" }),

  // Rooms
  listRooms: () => jfetch<{ rooms: RoomSummary[] }>("/api/rooms"),
  createRoom: (body: {
    name: string;
    isPublic?: boolean;
    difficulty?: Difficulty;
  }) =>
    jfetch<{ room: RoomSummary }>("/api/rooms", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getRoom: (id: string) =>
    jfetch<{ room: RoomDetail; messages: ChatMessage[] }>(`/api/rooms/${id}`),
  // The room this captain is still seated in, or null. Used on page load to
  // put a captain who merely reloaded back aboard instead of stranding them
  // in the Lobby while the harbor waits on their ready vote.
  getActiveRoom: () => jfetch<{ room: RoomDetail | null }>("/api/rooms/active"),
  joinRoomById: (id: string) =>
    jfetch<{ room: RoomSummary }>(`/api/rooms/${id}/join`, { method: "POST" }),
  joinRoomByCode: (code: string) =>
    jfetch<{ room: RoomSummary }>("/api/rooms/join", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  leaveRoom: (id: string) =>
    jfetch<{ ok: true }>(`/api/rooms/${id}/leave`, { method: "POST" }),

  // Game state
  getGameState: (roomId: string) =>
    jfetch<{
      state: string | null;
      checkpoint: {
        currentRound: number;
        currentPhase: string;
        voyageEpoch: number;
      } | null;
      difficulty: Difficulty;
    }>(`/api/game/state?roomId=${roomId}`),
  saveGameState: (roomId: string, data: unknown) =>
    jfetch<{ ok: true; updatedAt: string }>("/api/game/state", {
      method: "PUT",
      body: JSON.stringify({ roomId, data }),
    }),

  // DMs
  getDmHistory: (otherUserId: string) =>
    jfetch<{ other: PublicUser; messages: ChatMessage[] }>(
      `/api/messages/dm/${otherUserId}`,
    ),

  // Captain's Legacy (persistent Renown, across every voyage the account has
  // played). The current user's own legacy also carries their Daily Check In
  // status.
  getLegacy: () =>
    jfetch<{ legacy: CaptainLegacySummary; checkIn: CheckInStatus }>(
      "/api/legacy",
    ),
  getLegacyFor: (userId: string) =>
    jfetch<{ legacy: CaptainLegacySummary }>(`/api/legacy/${userId}`),
  getLegaciesFor: (userIds: string[]) =>
    jfetch<{ legacies: Record<string, CaptainLegacySummary> }>(
      "/api/legacy/batch",
      {
        method: "POST",
        body: JSON.stringify({ userIds }),
      },
    ),

  // Daily Check In: claim today's reward. Returns claimed:false (not an
  // error) when today was already claimed, so the caller can just re render.
  checkIn: () =>
    jfetch<{
      claimed: boolean;
      day?: number;
      xpGained?: number;
      leveledUp?: boolean;
      legacy: CaptainLegacySummary;
      checkIn: CheckInStatus;
    }>("/api/check-in", { method: "POST" }),

  // [MANIFEST] Voyage Chronicle: the prose recap of a finished voyage.
  // The list returns the current user's chronicles, newest first. A single
  // chronicle by id includes the full headline and body text. The save
  // endpoint is an opt in write for the Endgame "Save a short chronicle of
  // this voyage" checkbox: idempotent, returns the existing row when the
  // realtime auto write already landed, otherwise rebuilds and persists the
  // chronicle from the saved game state.
  listChronicles: () =>
    jfetch<{ chronicles: VoyageChronicle[] }>("/api/chronicle"),
  getChronicle: (voyageId: string) =>
    jfetch<{ chronicle: VoyageChronicle }>(`/api/chronicle/${voyageId}`),
  saveChronicle: (roomId: string) =>
    jfetch<{ chronicle: VoyageChronicle }>("/api/chronicle", {
      method: "POST",
      body: JSON.stringify({ roomId }),
    }),

  // [MANIFEST] Quick Start Match: asks to be seated with the next captain
  // who asks. The queue lives in the realtime layer's memory, so the real
  // request goes over the socket as `quickstart:join` and the answer comes
  // back as `quickstart:matched` or `quickstart:error` (see the Lobby).
  // This call is the signed in check in front of it, and answers
  // { queued: true } or fails with 401.
  quickStart: (body: { difficulty?: Difficulty } = {}) =>
    jfetch<{ queued: boolean }>("/api/quick-start", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // [MANIFEST] Captain's Rival: head to head lines for the current user.
  // The [userId] variant returns the rivalry between the current user and
  // one named partner, for the Legacy card's head to head line.
  listRivals: () => jfetch<{ rivals: RivalEntry[] }>("/api/rivals"),
  getRival: (userId: string) =>
    jfetch<{ rival: RivalEntry }>(`/api/rivals/${userId}`),

  // [MANIFEST] Great Houses: pledge allegiance to one House, and read the
  // harbor wide standings so the Lobby's House picker shows crowns and best
  // scores per House. Pledging is account level, persists across voyages,
  // and only takes effect on the next fresh voyage start.
  pledgeHouse: (houseId: HouseId) =>
    jfetch<{ houseId: HouseId }>("/api/house", {
      method: "POST",
      body: JSON.stringify({ houseId }),
    }),
  getHouseStandings: () =>
    jfetch<{
      standings: HouseStanding[];
      myHouseId: HouseId | null;
    }>("/api/houses/standings"),

  // Leaderboard: top captains across the whole harbor by various metrics.
  // Rows are ranked by /api/leaderboard itself; the caller renders them in
  // the order they arrive.
  getLeaderboard: () =>
    jfetch<{ leaderboard: LeaderboardEntry[] }>("/api/leaderboard"),
};
