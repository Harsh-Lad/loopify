"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AuthHeader } from "@/components/auth/auth-header";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc/client";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const trpc = useTRPC();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const resend = useMutation(trpc.auth.resendCode.mutationOptions());

  const next = params.get("next");
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/today";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const result = await signIn("credentials", { email, password, redirect: false });
    setPending(false);

    if (result?.code === "email_not_verified") {
      await resend.mutateAsync({ email, purpose: "SIGN_UP" }).catch(() => undefined);
      toast.info("Verify your email first. We just sent you a fresh code.");
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      return;
    }
    if (result?.code === "account_suspended") {
      setError("This account is suspended. Contact your Loopify administrator.");
      return;
    }
    if (result?.code === "too_many_attempts") {
      setError("Too many tries. Take a short break and try again in a few minutes.");
      return;
    }
    if (result?.error) {
      setError("Email or password is incorrect.");
      return;
    }
    router.replace(safeNext);
    router.refresh();
  }

  return (
    <>
      <AuthHeader title="Welcome back">Pick up right where you left off.</AuthHeader>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Field data-invalid={Boolean(error) || undefined}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(error) || undefined}
            />
          </Field>
          <Field data-invalid={Boolean(error) || undefined}>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Link
                href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`}
                className="text-xs text-muted-foreground hover:text-brand"
              >
                Forgot it?
              </Link>
            </div>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(error) || undefined}
            />
            <FieldError>{error}</FieldError>
          </Field>
          <Button type="submit" size="lg" disabled={pending || !email || !password}>
            {pending && <Spinner />}
            Sign in
          </Button>
        </FieldGroup>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/sign-up" className="font-medium text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
