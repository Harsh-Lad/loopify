import "server-only";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "@/server/db";
import { verifyPassword } from "@/server/auth/password";
import { rateLimit } from "@/server/rate-limit";

class EmailNotVerified extends CredentialsSignin {
  code = "email_not_verified";
}

class TooManyAttempts extends CredentialsSignin {
  code = "too_many_attempts";
}

class AccountSuspended extends CredentialsSignin {
  code = "account_suspended";
}

const credentialsSchema = z.object({
  email: z.email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/sign-in", error: "/sign-in" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        if (!(await rateLimit(`sign-in:${email}`, 10, 15 * 60))) throw new TooManyAttempts();

        const user = await db.user.findUnique({ where: { email } });
        if (!user || !(await verifyPassword(user.passwordHash, password))) return null;
        if (!user.emailVerified) throw new EmailNotVerified();
        if (user.suspendedAt) throw new AccountSuspended();

        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});
