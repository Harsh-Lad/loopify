"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthHeader } from "@/components/auth/auth-header";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage, useTRPC } from "@/lib/trpc/client";

export function ForgotPasswordForm() {
  const router = useRouter();
  const trpc = useTRPC();
  const [email, setEmail] = useState(useSearchParams().get("email") ?? "");
  const request = useMutation(
    trpc.auth.requestPasswordReset.mutationOptions({
      onSuccess: () => router.push(`/reset-password?email=${encodeURIComponent(email)}`),
    }),
  );

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    request.mutate({ email });
  }

  return (
    <>
      <AuthHeader title="Forgot your password?">Tell us your email and we&apos;ll send a code to reset it.</AuthHeader>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Field data-invalid={request.isError || undefined}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <FieldError>{request.error ? errorMessage(request.error) : null}</FieldError>
          </Field>
          <Button type="submit" size="lg" disabled={request.isPending || !email}>
            {request.isPending && <Spinner />}
            Send reset code
          </Button>
        </FieldGroup>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-medium text-brand hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
