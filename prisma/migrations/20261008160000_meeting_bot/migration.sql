-- CreateEnum
CREATE TYPE "MeetingJobStatus" AS ENUM ('QUEUED', 'CLAIMED', 'JOINING', 'WAITING_ADMIT', 'RECORDING', 'TRANSCRIBING', 'EXTRACTING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "meetingJobId" TEXT;

-- CreateTable
CREATE TABLE "MeetingJob" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "teamId" TEXT,
    "createdById" TEXT NOT NULL,
    "meetUrl" TEXT NOT NULL,
    "title" TEXT,
    "attendees" TEXT[],
    "keyterms" TEXT[],
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "MeetingJobStatus" NOT NULL DEFAULT 'QUEUED',
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "runnerId" TEXT,
    "error" TEXT,
    "durationSec" INTEGER,
    "language" TEXT,
    "transcript" JSONB,
    "result" JSONB,
    "cardsCreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingJob_status_startAt_idx" ON "MeetingJob"("status", "startAt");

-- CreateIndex
CREATE INDEX "MeetingJob_orgId_createdAt_idx" ON "MeetingJob"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "Card_meetingJobId_idx" ON "Card"("meetingJobId");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_meetingJobId_fkey" FOREIGN KEY ("meetingJobId") REFERENCES "MeetingJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingJob" ADD CONSTRAINT "MeetingJob_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingJob" ADD CONSTRAINT "MeetingJob_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingJob" ADD CONSTRAINT "MeetingJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
