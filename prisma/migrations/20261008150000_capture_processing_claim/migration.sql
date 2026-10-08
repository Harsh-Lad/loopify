-- Lets a capture be claimed atomically, and stuck ones be picked up again.
ALTER TABLE "Capture" ADD COLUMN "processingAt" TIMESTAMP(3);
