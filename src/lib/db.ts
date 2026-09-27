import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export const PUBLIC_USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarHue: true,
} as const;

export type PublicUser = {
  id: string;
  username: string;
  displayName: string;
  avatarHue: number;
};

/**
 * The four fields every wire user carries, picked off a row that holds
 * more. A create returns the whole row, and the routes that mint a session
 * hand back only this much of it, so the picking happens in one place
 * rather than once per route.
 */
export function publicUser(row: PublicUser): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    avatarHue: row.avatarHue,
  };
}
