-- Captures that turn their action items straight into personal to-dos.
ALTER TABLE "Capture" ADD COLUMN "toMyBoard" BOOLEAN NOT NULL DEFAULT false;
