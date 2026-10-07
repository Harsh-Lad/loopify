"use client";

import { IconArrowRight, IconMail } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AuthShowcase } from "@/components/auth/auth-showcase";
import { CodeInput } from "@/components/auth/code-input";
import { PasswordInput } from "@/components/auth/password-input";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useCooldown } from "@/hooks/use-cooldown";
import { celebrateBig } from "@/lib/celebrate";
import { errorMessage, useTRPC, type RouterOutputs } from "@/lib/trpc/client";

type Invite = RouterOutputs["org"]["inviteInfo"];

/**
 * The page an invite email links to. New people set a name and password,
 * confirm a code, and land on their dashboard already signed in. People with
 * an account just enter their password.
 */
export function AcceptInvite({ token }: { token: string }) {
  const trpc = useTRPC();
  const info = useQuery({ ...trpc.org.inviteInfo.queryOptions({ token }), retry: false });

  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            {info.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-9 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="mt-6 h-40 w-full rounded-2xl" />
              </div>
            ) : info.isError || !info.data ? (
              <>
                <h1 className="text-3xl font-bold">This invite can&apos;t be used</h1>
                <p className="mt-2 text-muted-foreground">
                  {errorMessage(info.error)} Ask whoever invited you to send a new one.
                </p>
                <Button className="mt-6" variant="outline" asChild>
                  <a href="/sign-in">Go to sign in</a>
                </Button>
              </>
            ) : (
              <InviteFlow token={token} invite={info.data} />
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Plan it. Do it. Loop the rest into tomorrow.</p>
      </div>
      <AuthShowcase />
    </div>
  );
}

function InviteHeader({ invite, children }: { invite: Invite; children?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <Badge variant="highlight" className="mb-3">
        Invited by {invite.invitedBy}
      </Badge>
      <h1 className="text-3xl font-bold text-balance">Join {invite.orgName}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {children ?? `You'll join as ${invite.role === "MEMBER" ? "a member" : `a ${invite.role.toLowerCase()}`}.`}
      </p>
    </div>
  );
}

function InviteFlow({ token, invite }: { token: string; invite: Invite }) {
  if (invite.signedInEmail && invite.signedInEmail === invite.email) {
    return <JoinSignedIn token={token} invite={invite} />;
  }
  if (invite.signedInEmail) {
    return (
      <>
        <InviteHeader invite={invite}>
          This invite is for <strong className="text-foreground">{invite.email}</strong>, but you&apos;re signed in as{" "}
          {invite.signedInEmail}.
        </InviteHeader>
        <Button size="lg" className="w-full" onClick={() => signOut({ redirectTo: `/invite/${token}` })}>
          Sign out and continue as {invite.email}
        </Button>
      </>
    );
  }
  return invite.hasAccount ? (
    <JoinWithPassword token={token} invite={invite} />
  ) : (
    <CreateAccount token={token} invite={invite} />
  );
}

/** Already signed in as the invited email: one click. */
function JoinSignedIn({ token, invite }: { token: string; invite: Invite }) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const accept = useMutation(
    trpc.org.acceptInvite.mutationOptions({
      onSuccess: async () => {
        celebrateBig();
        await queryClient.invalidateQueries();
        router.replace("/today");
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );
  return (
    <>
      <InviteHeader invite={invite} />
      <Button size="lg" className="w-full" onClick={() => accept.mutate({ token })} disabled={accept.isPending}>
        {accept.isPending && <Spinner />}
        Join {invite.orgName}
        <IconArrowRight data-icon="inline-end" />
      </Button>
    </>
  );
}

/** Has an account but isn't signed in: password, then join. */
function JoinWithPassword({ token, invite }: { token: string; invite: Invite }) {
  const trpc = useTRPC();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const accept = useMutation(trpc.org.acceptInvite.mutationOptions());

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const result = await signIn("credentials", { email: invite.email, password, redirect: false });
    if (result?.error) {
      setPending(false);
      setError(
        result.code === "too_many_attempts" ? "Too many tries. Wait a few minutes." : "That password isn't right.",
      );
      return;
    }
    try {
      await accept.mutateAsync({ token });
      celebrateBig();
      router.replace("/today");
      router.refresh();
    } catch (e) {
      setPending(false);
      setError(errorMessage(e));
    }
  }

  return (
    <>
      <InviteHeader invite={invite}>You already have a Loopify account. Enter your password to join.</InviteHeader>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" value={invite.email} readOnly disabled />
          </Field>
          <Field data-invalid={Boolean(error) || undefined}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <PasswordInput
              id="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <FieldError>{error}</FieldError>
          </Field>
          <Button type="submit" size="lg" disabled={!password || pending}>
            {pending && <Spinner />}
            Join {invite.orgName}
          </Button>
          <a
            href={`/forgot-password?email=${encodeURIComponent(invite.email)}`}
            className="text-center text-sm text-muted-foreground hover:text-brand"
          >
            Forgot your password?
          </a>
        </FieldGroup>
      </form>
    </>
  );
}

/** New to Loopify: name + password, then a code, then straight in. */
function CreateAccount({ token, invite }: { token: string; invite: Invite }) {
  const trpc = useTRPC();
  const router = useRouter();
  const [step, setStep] = useState<"details" | "code">("details");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const cooldown = useCooldown(30);

  const signUp = useMutation(
    trpc.auth.inviteSignUp.mutationOptions({
      onSuccess: () => {
        setStep("code");
        cooldown.start();
      },
    }),
  );
  const resend = useMutation(
    trpc.auth.resendCode.mutationOptions({
      onSuccess: () => {
        toast.success("New code sent");
        cooldown.start();
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );
  const verify = useMutation(
    trpc.auth.inviteVerify.mutationOptions({
      onSuccess: async () => {
        // The account is verified and already in the org: sign in with the password they just chose.
        setSigningIn(true);
        const result = await signIn("credentials", { email: invite.email, password, redirect: false });
        if (result?.error) {
          setSigningIn(false);
          toast.error("You're in, but signing in failed. Please sign in once.");
          router.replace(`/sign-in?email=${encodeURIComponent(invite.email)}`);
          return;
        }
        celebrateBig();
        toast.success(`Welcome to ${invite.orgName}`);
        router.replace("/today");
        router.refresh();
      },
      onError: () => setCode(""),
    }),
  );

  if (step === "code") {
    const submit = (value: string) => verify.mutate({ token, code: value });
    return (
      <>
        <InviteHeader invite={invite}>
          We sent a 6-digit code to <strong className="text-foreground">{invite.email}</strong>. Enter it to finish.
        </InviteHeader>
        <FieldGroup>
          <Field data-invalid={verify.isError || undefined}>
            <CodeInput
              value={code}
              onChange={setCode}
              onComplete={submit}
              disabled={verify.isPending || signingIn}
              invalid={verify.isError}
            />
            <FieldError>{verify.error ? errorMessage(verify.error) : null}</FieldError>
          </Field>
          <Button size="lg" onClick={() => submit(code)} disabled={code.length !== 6 || verify.isPending || signingIn}>
            {(verify.isPending || signingIn) && <Spinner />}
            {signingIn ? "Taking you in..." : "Confirm and join"}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <Button variant="ghost" size="sm" onClick={() => setStep("details")}>
              Back
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => resend.mutate({ email: invite.email, purpose: "SIGN_UP" })}
              disabled={!cooldown.ready || resend.isPending}
            >
              <IconMail />
              {cooldown.ready ? "Send a new code" : `New code in ${cooldown.left}s`}
            </Button>
          </div>
        </FieldGroup>
      </>
    );
  }

  return (
    <>
      <InviteHeader invite={invite} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          signUp.mutate({ token, name, password });
        }}
        noValidate
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="name">Your name</FieldLabel>
            <Input id="name" autoFocus autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" value={invite.email} readOnly disabled />
            <FieldDescription>This is the address you were invited with.</FieldDescription>
          </Field>
          <Field data-invalid={signUp.isError || undefined}>
            <FieldLabel htmlFor="password">Choose a password</FieldLabel>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <FieldDescription>8 or more characters, with a letter and a number.</FieldDescription>
            <FieldError>{signUp.error ? errorMessage(signUp.error) : null}</FieldError>
          </Field>
          <Button type="submit" size="lg" disabled={!name.trim() || !password || signUp.isPending}>
            {signUp.isPending && <Spinner />}
            Continue
            <IconArrowRight data-icon="inline-end" />
          </Button>
        </FieldGroup>
      </form>
    </>
  );
}
