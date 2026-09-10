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
