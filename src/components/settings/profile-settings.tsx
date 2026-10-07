"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { errorMessage, useTRPC, type RouterOutputs } from "@/lib/trpc/client";

type Me = RouterOutputs["me"]["get"];
type Org = RouterOutputs["org"]["current"];

export function ProfileSettings() {
  const trpc = useTRPC();
  const me = useQuery(trpc.me.get.queryOptions());
  const org = useQuery(trpc.org.current.queryOptions());
  if (!me.data) return <Skeleton className="h-64 rounded-2xl" />;
  // Keyed so the form starts from fresh values whenever the saved data changes.
  return <ProfileForm key={`${me.data.name}|${me.data.timezone}|${org.data?.name}`} me={me.data} org={org.data} />;
}

function ProfileForm({ me, org }: { me: Me; org: Org | undefined }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(me.name);
  const [timezone, setTimezone] = useState(me.timezone);
  const [orgName, setOrgName] = useState(org?.name ?? "");
  const zones = useMemo(
    () => (typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["Asia/Kolkata", "UTC"]),
    [],
  );

  const update = useMutation(
    trpc.me.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries();
        toast.success("Profile saved");
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );
  const updateOrg = useMutation(
    trpc.org.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries();
        toast.success("Organization renamed");
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );

  const isAdmin = org && ["OWNER", "ADMIN"].includes(org.role);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">You</CardTitle>
          <CardDescription>Your days roll over at midnight in your time zone.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>Email</FieldLabel>
              <Input value={me.email} disabled />
            </Field>
            <Field>
              <FieldLabel>Time zone</FieldLabel>
              <Combobox items={zones} value={timezone} onValueChange={(v) => v && setTimezone(v)}>
                <ComboboxInput placeholder="Search time zones" />
                <ComboboxContent>
                  <ComboboxEmpty>No time zone found.</ComboboxEmpty>
                  <ComboboxList>
                    {(zone: string) => (
                      <ComboboxItem key={zone} value={zone}>
                        {zone.replace(/_/g, " ")}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              <FieldDescription>
                Detected on this device: {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </FieldDescription>
            </Field>
            <Button
              className="justify-self-start"
              disabled={update.isPending || (name === me.name && timezone === me.timezone)}
              onClick={() => update.mutate({ name, timezone })}
            >
              Save profile
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <ToggleGroup type="single" variant="outline" value={theme} onValueChange={(v) => v && setTheme(v)}>
            <ToggleGroupItem value="light">Light</ToggleGroupItem>
            <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
            <ToggleGroupItem value="system">Match my device</ToggleGroupItem>
          </ToggleGroup>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Organization</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} aria-label="Organization name" />
            <Button
              variant="outline"
              disabled={orgName === org?.name || orgName.trim().length < 2}
              onClick={() => updateOrg.mutate({ name: orgName })}
            >
              Rename
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
