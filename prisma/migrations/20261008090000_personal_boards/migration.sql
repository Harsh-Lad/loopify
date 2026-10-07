-- Personal boards: a board belongs to a team or to one person.
ALTER TABLE "Board" ALTER COLUMN "teamId" DROP NOT NULL;
ALTER TABLE "Board" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Board" ADD CONSTRAINT "Board_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Board_orgId_ownerId_key" ON "Board"("orgId", "ownerId");

-- Auto-mirror preference per membership.
ALTER TABLE "OrgMember" ADD COLUMN "autoMirror" BOOLEAN NOT NULL DEFAULT false;

-- Team cards mirrored onto personal boards.
CREATE TABLE "CardMirror" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CardMirror_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CardMirror_userId_cardId_key" ON "CardMirror"("userId", "cardId");
CREATE INDEX "CardMirror_columnId_position_idx" ON "CardMirror"("columnId", "position");
ALTER TABLE "CardMirror" ADD CONSTRAINT "CardMirror_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardMirror" ADD CONSTRAINT "CardMirror_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardMirror" ADD CONSTRAINT "CardMirror_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardMirror" ADD CONSTRAINT "CardMirror_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "BoardColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
