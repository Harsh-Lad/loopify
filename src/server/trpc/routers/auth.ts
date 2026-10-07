import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { issueMobileToken } from "@/server/auth/mobile-token";
import { consumeVerificationCode, issueVerificationCode } from "@/server/auth/verification-code";
import { sendMail } from "@/server/mail/mailer";
import { passwordResetMessage, verifyEmailMessage } from "@/server/mail/templates";
import { rateLimit } from "@/server/rate-limit";
import { findOpenInvite, acceptInviteFor } from "@/server/services/invites";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/init";

const email = z.email("Enter a valid email").transform((v) => v.trim().toLowerCase());
const password = z
  .string()
  .min(8, "At least 8 characters")
  .max(128, "That's a very long password")
  .regex(/[a-zA-Z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");
const code = z.string().regex(/^\d{6}$/, "The code is 6 digits");

async function limitOrThrow(key: string, limit: number, windowSeconds: number) {
  if (!(await rateLimit(key, limit, windowSeconds))) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Slow down a little and try again in a few minutes." });
  }
}

const codeErrors = {
  invalid: "That code doesn't match. Check your inbox and try again.",
  expired: "That code has expired. Ask for a new one.",
  too_many_attempts: "Too many tries. Ask for a new code.",
} as const;

export const authRouter = createTRPCRouter({
  signUp: publicProcedure
    .input(z.object({ name: z.string().trim().min(1, "What should we call you?").max(80), email, password }))
    .mutation(async ({ ctx, input }) => {
      await limitOrThrow(`sign-up:${input.email}`, 5, 60 * 60);

      const existing = await ctx.db.user.findUnique({ where: { email: input.email } });
      if (existing?.emailVerified) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists. Try signing in.",
        });
      }

      const passwordHash = await hashPassword(input.password);
      const user = existing
        ? await ctx.db.user.update({ where: { id: existing.id }, data: { name: input.name, passwordHash } })
        : await ctx.db.user.create({ data: { name: input.name, email: input.email, passwordHash } });

      const otp = await issueVerificationCode(user.email, "SIGN_UP");
      await sendMail(verifyEmailMessage(user.email, user.name, otp));

      return { email: user.email };
    }),

  verifyEmail: publicProcedure.input(z.object({ email, code })).mutation(async ({ ctx, input }) => {
    await limitOrThrow(`verify:${input.email}`, 10, 15 * 60);
    const result = await consumeVerificationCode(input.email, "SIGN_UP", input.code);
    if (!result.ok) throw new TRPCError({ code: "BAD_REQUEST", message: codeErrors[result.reason] });

    await ctx.db.user.update({ where: { email: input.email }, data: { emailVerified: new Date() } });
    return { verified: true };
  }),

  resendCode: publicProcedure
    .input(z.object({ email, purpose: z.enum(["SIGN_UP", "PASSWORD_RESET"]) }))
    .mutation(async ({ ctx, input }) => {
      await limitOrThrow(`resend:${input.purpose}:${input.email}`, 3, 10 * 60);
      const user = await ctx.db.user.findUnique({ where: { email: input.email } });

      // Same response whether or not the account exists, so emails can't be probed.
      if (!user) return { sent: true };
      if (input.purpose === "SIGN_UP" && user.emailVerified) return { sent: true };

      const otp = await issueVerificationCode(user.email, input.purpose);
      await sendMail(
        input.purpose === "SIGN_UP"
          ? verifyEmailMessage(user.email, user.name, otp)
          : passwordResetMessage(user.email, user.name, otp),
      );
      return { sent: true };
    }),

  requestPasswordReset: publicProcedure.input(z.object({ email })).mutation(async ({ ctx, input }) => {
    await limitOrThrow(`reset-request:${input.email}`, 3, 15 * 60);
    const user = await ctx.db.user.findUnique({ where: { email: input.email } });
    if (user) {
      const otp = await issueVerificationCode(user.email, "PASSWORD_RESET");
      await sendMail(passwordResetMessage(user.email, user.name, otp));
    }
    return { sent: true };
  }),

  resetPassword: publicProcedure.input(z.object({ email, code, password })).mutation(async ({ ctx, input }) => {
    await limitOrThrow(`reset:${input.email}`, 10, 15 * 60);
    const result = await consumeVerificationCode(input.email, "PASSWORD_RESET", input.code);
    if (!result.ok) throw new TRPCError({ code: "BAD_REQUEST", message: codeErrors[result.reason] });

    await ctx.db.user.update({
      where: { email: input.email },
      // Resetting through email also proves ownership of the address.
      data: { passwordHash: await hashPassword(input.password), emailVerified: new Date() },
    });
    return { reset: true };
  }),

  /** Mobile sign-in. Returns a bearer token for the REST API. */
  mobileToken: publicProcedure
    .meta({
      openapi: { method: "POST", path: "/auth/token", tags: ["auth"], summary: "Sign in and get a bearer token" },
    })
    .input(z.object({ email, password: z.string().min(1) }))
    .output(z.object({ token: z.string(), user: z.object({ id: z.string(), name: z.string(), email: z.string() }) }))
    .mutation(async ({ ctx, input }) => {
      await limitOrThrow(`sign-in:${input.email}`, 10, 15 * 60);
      const user = await ctx.db.user.findUnique({ where: { email: input.email } });
      if (!user || !(await verifyPassword(user.passwordHash, input.password))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });
      }
      if (!user.emailVerified) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Verify your email before signing in." });
      }
      return {
        token: await issueMobileToken(user.id),
        user: { id: user.id, name: user.name, email: user.email },
      };
    }),

  /**
   * Invite onboarding, step 1. The email comes from the invite, so the person
   * only picks a name and password. A code is sent to confirm the address.
   */
  inviteSignUp: publicProcedure
    .input(
      z.object({
        token: z.string().min(10),
        name: z.string().trim().min(1, "What should we call you?").max(80),
        password,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const invite = await findOpenInvite(input.token);
      await limitOrThrow(`invite-sign-up:${invite.email}`, 5, 60 * 60);

      const existing = await ctx.db.user.findUnique({ where: { email: invite.email } });
      if (existing?.emailVerified) {
        throw new TRPCError({ code: "CONFLICT", message: "You already have an account. Sign in below to join." });
      }

      const passwordHash = await hashPassword(input.password);
      const user = existing
        ? await ctx.db.user.update({ where: { id: existing.id }, data: { name: input.name, passwordHash } })
        : await ctx.db.user.create({ data: { name: input.name, email: invite.email, passwordHash } });

      const otp = await issueVerificationCode(user.email, "SIGN_UP");
      await sendMail(verifyEmailMessage(user.email, user.name, otp));
      return { email: user.email };
    }),

  /** Invite onboarding, step 2: confirms the code and joins the org in one go. */
  inviteVerify: publicProcedure
    .input(z.object({ token: z.string().min(10), code }))
    .mutation(async ({ ctx, input }) => {
      const invite = await findOpenInvite(input.token);
      await limitOrThrow(`verify:${invite.email}`, 10, 15 * 60);
      const result = await consumeVerificationCode(invite.email, "SIGN_UP", input.code);
      if (!result.ok) throw new TRPCError({ code: "BAD_REQUEST", message: codeErrors[result.reason] });

      const user = await ctx.db.user.update({ where: { email: invite.email }, data: { emailVerified: new Date() } });
      await acceptInviteFor(invite.id, invite.orgId, invite.role, user.id);
      return { email: user.email, orgName: invite.org.name };
    }),
});
