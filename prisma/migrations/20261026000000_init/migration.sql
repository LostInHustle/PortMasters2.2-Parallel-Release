-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarHue" INTEGER NOT NULL DEFAULT 180,
    "role" TEXT NOT NULL DEFAULT 'captain',
    "bannedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lobbyOpenedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentRound" INTEGER NOT NULL DEFAULT 1,
    "currentPhase" TEXT NOT NULL DEFAULT '0',
    "voyageEpoch" INTEGER NOT NULL DEFAULT 0,
    "voyageSeats" INTEGER NOT NULL DEFAULT 0,
    "started" BOOLEAN NOT NULL DEFAULT false,
    "difficulty" TEXT NOT NULL DEFAULT 'fair_winds',
    "mode" TEXT NOT NULL DEFAULT 'classic',
    "unlock" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Room_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoomMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "integritySeverity" TEXT,
    "integrityNote" TEXT,
    CONSTRAINT "GameState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GameState_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VoyageRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "flourish" TEXT,
    "drawnAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VoyageRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VoyageRole_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaptainLegacy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "renownLevel" INTEGER NOT NULL DEFAULT 1,
    "renownXP" INTEGER NOT NULL DEFAULT 0,
    "voyagesCompleted" INTEGER NOT NULL DEFAULT 0,
    "seaMasterCrowns" INTEGER NOT NULL DEFAULT 0,
    "bestScore" INTEGER NOT NULL DEFAULT 0,
    "consecutiveSolventVoyages" INTEGER NOT NULL DEFAULT 0,
    "statsByDifficulty" TEXT NOT NULL DEFAULT '{}',
    "checkInCount" INTEGER NOT NULL DEFAULT 0,
    "lastCheckInDate" TEXT,
    "houseId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CaptainLegacy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaptainMerit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "meritId" TEXT NOT NULL,
    "earnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaptainMerit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConvoyVenture" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "voyageEpoch" INTEGER NOT NULL,
    "posterId" TEXT NOT NULL,
    "posterName" TEXT NOT NULL,
    "targetGold" INTEGER NOT NULL,
    "deadlineRound" INTEGER NOT NULL,
    "payoutMultiplier" REAL NOT NULL DEFAULT 1.5,
    "contributions" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "ConvoyVenture_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "voyageEpoch" INTEGER NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "borrowerName" TEXT NOT NULL,
    "lenderId" TEXT NOT NULL,
    "lenderName" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "backerId" TEXT,
    "backerName" TEXT,
    "backedAmount" INTEGER,
    "redirectToUserId" TEXT,
    "redirectToName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Loan_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VoyageChronicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "voyageEpoch" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL,
    "rounds" INTEGER NOT NULL,
    "peakReputation" INTEGER NOT NULL,
    "finalReputation" INTEGER NOT NULL,
    "finalGold" INTEGER NOT NULL,
    "largestTrade" INTEGER NOT NULL,
    "lendCount" INTEGER NOT NULL,
    "borrowCount" INTEGER NOT NULL,
    "crowned" BOOLEAN NOT NULL DEFAULT false,
    "bankrupt" BOOLEAN NOT NULL DEFAULT false,
    "marooned" BOOLEAN NOT NULL DEFAULT false,
    "merchantRating" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'classic',
    "objectiveId" TEXT NOT NULL DEFAULT '',
    "objectiveMet" BOOLEAN NOT NULL DEFAULT false,
    "objectiveTrace" TEXT NOT NULL DEFAULT '',
    "heldCards" TEXT NOT NULL DEFAULT '',
    "alignment" TEXT NOT NULL DEFAULT '',
    "won" BOOLEAN NOT NULL DEFAULT false,
    "seats" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VoyageChronicle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaptainRival" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "voyageEpoch" INTEGER NOT NULL,
    "aScore" INTEGER NOT NULL,
    "bScore" INTEGER NOT NULL,
    "aWon" BOOLEAN NOT NULL DEFAULT false,
    "bWon" BOOLEAN NOT NULL DEFAULT false,
    "tie" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaptainRival_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaptainRival_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaptainRival_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VoyageTelemetry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "voyageEpoch" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "sampleRate" REAL NOT NULL,
    "outcome" TEXT NOT NULL,
    "leg" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME NOT NULL,
    "record" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "voyageEpoch" INTEGER NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_code_key" ON "Room"("code");

-- CreateIndex
CREATE INDEX "Room_hostId_idx" ON "Room"("hostId");

-- CreateIndex
CREATE INDEX "RoomMember_roomId_idx" ON "RoomMember"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMember_userId_roomId_key" ON "RoomMember"("userId", "roomId");

-- CreateIndex
CREATE INDEX "GameState_roomId_idx" ON "GameState"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "GameState_userId_roomId_key" ON "GameState"("userId", "roomId");

-- CreateIndex
CREATE INDEX "VoyageRole_roomId_idx" ON "VoyageRole"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "VoyageRole_roomId_userId_key" ON "VoyageRole"("roomId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CaptainLegacy_userId_key" ON "CaptainLegacy"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CaptainMerit_userId_meritId_key" ON "CaptainMerit"("userId", "meritId");

-- CreateIndex
CREATE INDEX "ConvoyVenture_roomId_voyageEpoch_idx" ON "ConvoyVenture"("roomId", "voyageEpoch");

-- CreateIndex
CREATE INDEX "Message_roomId_createdAt_idx" ON "Message"("roomId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_recipientId_createdAt_idx" ON "Message"("senderId", "recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "Loan_roomId_idx" ON "Loan"("roomId");

-- CreateIndex
CREATE INDEX "VoyageChronicle_userId_createdAt_idx" ON "VoyageChronicle"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "VoyageChronicle_roomId_idx" ON "VoyageChronicle"("roomId");

-- CreateIndex
CREATE INDEX "CaptainRival_userAId_userBId_idx" ON "CaptainRival"("userAId", "userBId");

-- CreateIndex
CREATE INDEX "CaptainRival_roomId_idx" ON "CaptainRival"("roomId");

-- CreateIndex
CREATE INDEX "VoyageTelemetry_roomId_idx" ON "VoyageTelemetry"("roomId");

-- CreateIndex
CREATE INDEX "VoyageTelemetry_endedAt_idx" ON "VoyageTelemetry"("endedAt");

-- CreateIndex
CREATE INDEX "Report_roomId_idx" ON "Report"("roomId");

-- CreateIndex
CREATE INDEX "Report_targetUserId_idx" ON "Report"("targetUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_reporterId_targetUserId_roomId_voyageEpoch_key" ON "Report"("reporterId", "targetUserId", "roomId", "voyageEpoch");

