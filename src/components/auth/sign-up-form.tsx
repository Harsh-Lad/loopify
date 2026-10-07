"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthHeader } from "@/components/auth/auth-header";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage, useTRPC } from "@/lib/trpc/client";

export function SignUpForm() {
  const router = useRouter();
  const trpc = useTRPC();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const signUp = useMutation(
    trpc.auth.signUp.mutationOptions({
      onSuccess: ({ email }) => router.push(`/verify-email?email=${encodeURIComponent(email)}`),
    }),
  );

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    signUp.mutate(form);
  }

  const error = signUp.error ? errorMessage(signUp.error) : null;

  return (
    <>
      <AuthHeader title="Start your loop">One account for your plans, notes and team boards.</AuthHeader>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="name">Your name</FieldLabel>
            <Input id="name" autoComplete="name" required value={form.name} onChange={set("name")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">Work email</FieldLabel>
            <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={set("email")} />
          </Field>
          <Field data-invalid={Boolean(error) || undefined}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              required
              value={form.password}
              onChange={set("password")}
            />
            <FieldDescription>8 or more characters, with a letter and a number.</FieldDescription>
            <FieldError>{error}</FieldError>
          </Field>
          <Button type="submit" size="lg" disabled={signUp.isPending || !form.name || !form.email || !form.password}>
            {signUp.isPending && <Spinner />}
            Create account
          </Button>
        </FieldGroup>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
