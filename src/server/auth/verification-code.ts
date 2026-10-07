import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { VerificationPurpose } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(email: string, purpose: VerificationPurpose, code: string) {
  return createHmac("sha256", env.AUTH_SECRET).update(`${purpose}:${email}:${code}`).digest("hex");
}

/** Issues a fresh 6-digit code and invalidates any earlier unused code for the same purpose. */
export async function issueVerificationCode(email: string, purpose: VerificationPurpose) {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");

  await db.$transaction([
    db.verificationCode.updateMany({
      where: { email, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    db.verificationCode.create({
      data: {
        email,
        purpose,
        codeHash: hashCode(email, purpose, code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    }),
  ]);

  return code;
}

export type CodeCheck = { ok: true } | { ok: false; reason: "invalid" | "expired" | "too_many_attempts" };

/** Checks and consumes a code. Each wrong guess counts toward the attempt limit. */
export async function consumeVerificationCode(
  email: string,
  purpose: VerificationPurpose,
  code: string,
): Promise<CodeCheck> {
  const record = await db.verificationCode.findFirst({
    where: { email, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return { ok: false, reason: "invalid" };
  if (record.expiresAt < new Date()) return { ok: false, reason: "expired" };
  if (record.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };

  const expected = Buffer.from(record.codeHash, "hex");
  const actual = Buffer.from(hashCode(email, purpose, code), "hex");
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!matches) {
    await db.verificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: record.attempts + 1 >= MAX_ATTEMPTS ? "too_many_attempts" : "invalid" };
  }

  await db.verificationCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
  return { ok: true };
}
