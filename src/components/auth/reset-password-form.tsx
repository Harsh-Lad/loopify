"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AuthHeader } from "@/components/auth/auth-header";
import { CodeInput } from "@/components/auth/code-input";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useCooldown } from "@/hooks/use-cooldown";
import { errorMessage, useTRPC } from "@/lib/trpc/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const email = useSearchParams().get("email") ?? "";
  const trpc = useTRPC();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const cooldown = useCooldown(30, true);

  const reset = useMutation(
    trpc.auth.resetPassword.mutationOptions({
      onSuccess: () => {
        toast.success("Password changed. Sign in with your new one.");
        router.push(`/sign-in?email=${encodeURIComponent(email)}`);
      },
    }),
  );
  const resend = useMutation(
    trpc.auth.resendCode.mutationOptions({
      onSuccess: () => {
        toast.success("New code sent.");
        cooldown.start();
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    reset.mutate({ email, code, password });
  }

  return (
    <>
      <AuthHeader title="Set a new password">
        Enter the code we sent to <span className="font-medium text-foreground">{email}</span> and pick a new password.
      </AuthHeader>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Field>
            <FieldLabel>Reset code</FieldLabel>
            <CodeInput value={code} onChange={setCode} disabled={reset.isPending} />
          </Field>
          <Field data-invalid={reset.isError || undefined}>
            <FieldLabel htmlFor="password">New password</FieldLabel>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <FieldDescription>8 or more characters, with a letter and a number.</FieldDescription>
            <FieldError>{reset.error ? errorMessage(reset.error) : null}</FieldError>
          </Field>
          <Button type="submit" size="lg" disabled={reset.isPending || code.length !== 6 || !password}>
            {reset.isPending && <Spinner />}
            Change password
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => resend.mutate({ email, purpose: "PASSWORD_RESET" })}
            disabled={!cooldown.ready || resend.isPending || !email}
          >
            {cooldown.ready ? "Send a new code" : `Send a new code in ${cooldown.left}s`}
          </Button>
        </FieldGroup>
      </form>
    </>
  );
}
