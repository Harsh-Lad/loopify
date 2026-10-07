"use client";

import { IconArrowRight } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage, useTRPC } from "@/lib/trpc/client";

export function CreateOrgForm() {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const create = useMutation(
    trpc.org.create.mutationOptions({
      onSuccess: async (org) => {
        await queryClient.invalidateQueries();
        toast.success(`Welcome to ${org.name}`);
        router.push("/today");
      },
    }),
  );

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate({ name });
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-6 py-12">
      <Logo className="mb-10" />
      <h1 className="text-3xl font-bold">Set up your organization</h1>
      <p className="mt-2 text-muted-foreground">
        This is your company&apos;s space. You&apos;ll get a General team and board to start, and you can add teams like
        Tech, Creative or Sales next.
      </p>
      <form onSubmit={onSubmit} className="mt-8" noValidate>
        <FieldGroup>
          <Field data-invalid={create.isError || undefined}>
            <FieldLabel htmlFor="org-name">Organization name</FieldLabel>
            <Input
              id="org-name"
              autoFocus
              placeholder="AS IT Solutions"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <FieldDescription>Got an invite instead? Open the link from your email.</FieldDescription>
            <FieldError>{create.error ? errorMessage(create.error) : null}</FieldError>
          </Field>
          <Button type="submit" size="lg" disabled={create.isPending || name.trim().length < 2}>
            {create.isPending ? <Spinner /> : null}
            Create and continue
            <IconArrowRight data-icon="inline-end" />
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}
