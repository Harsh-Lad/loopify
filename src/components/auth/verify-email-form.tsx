"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AuthHeader } from "@/components/auth/auth-header";
import { CodeInput } from "@/components/auth/code-input";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useCooldown } from "@/hooks/use-cooldown";
import { errorMessage, useTRPC } from "@/lib/trpc/client";

export function VerifyEmailForm() {
  const router = useRouter();
  const email = useSearchParams().get("email") ?? "";
  const trpc = useTRPC();
  const [code, setCode] = useState("");
  const cooldown = useCooldown(30, true);

  const verify = useMutation(
    trpc.auth.verifyEmail.mutationOptions({
      onSuccess: () => {
        toast.success("Email verified. Sign in to get going.");
        router.push(`/sign-in?email=${encodeURIComponent(email)}`);
      },
      onError: () => setCode(""),
    }),
  );
  const resend = useMutation(
    trpc.auth.resendCode.mutationOptions({
      onSuccess: () => {
        toast.success("New code sent. Check your inbox.");
        cooldown.start();
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );

  const submit = (value: string) => verify.mutate({ email, code: value });

  return (
    <>
      <AuthHeader title="Check your inbox">
        We sent a 6-digit code to <span className="font-medium text-foreground">{email || "your email"}</span>.
      </AuthHeader>
      <FieldGroup>
        <Field data-invalid={verify.isError || undefined}>
          <CodeInput
            value={code}
            onChange={setCode}
            onComplete={submit}
            disabled={verify.isPending}
            invalid={verify.isError}
          />
          <FieldError>{verify.error ? errorMessage(verify.error) : null}</FieldError>
        </Field>
        <Button size="lg" onClick={() => submit(code)} disabled={code.length !== 6 || verify.isPending}>
          {verify.isPending && <Spinner />}
          Verify email
        </Button>
        <Button
          variant="ghost"
          onClick={() => resend.mutate({ email, purpose: "SIGN_UP" })}
          disabled={!cooldown.ready || resend.isPending || !email}
        >
          {cooldown.ready ? "Send a new code" : `Send a new code in ${cooldown.left}s`}
        </Button>
      </FieldGroup>
    </>
  );
}
