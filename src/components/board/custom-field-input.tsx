"use client";

import { IconCalendarEvent } from "@tabler/icons-react";
import { format } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Field = { key: string; label: string; type: string; options: unknown };

/** One input per custom field type, saved on blur or on pick. */
export function CustomFieldInput({
  field,
  value,
  members,
  onChange,
}: {
  field: Field;
  value: unknown;
  members: { id: string; name: string }[];
  onChange: (value: unknown) => void;
}) {
  const options = (field.options as string[] | null) ?? [];
  const asText = value == null ? "" : String(value);
  const [draft, setDraft] = useState(asText);
  const [synced, setSynced] = useState(asText);
  if (synced !== asText) {
    setSynced(asText);
    setDraft(asText);
  }

  switch (field.type) {
    case "SELECT":
      return (
        <Select value={(value as string) ?? "__none"} onValueChange={(v) => onChange(v === "__none" ? null : v)}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Not set</SelectItem>
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "MULTI_SELECT":
      return (
        <ToggleGroup
          type="multiple"
          size="sm"
          variant="outline"
          value={(value as string[]) ?? []}
          onValueChange={(v) => onChange(v)}
          className="flex-wrap justify-start"
        >
          {options.map((o) => (
            <ToggleGroupItem key={o} value={o} className="text-xs">
              {o}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      );
    case "CHECKBOX":
      return (
        <Checkbox checked={Boolean(value)} onCheckedChange={(v) => onChange(Boolean(v))} aria-label={field.label} />
      );
    case "DATE":
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="w-full justify-start font-normal">
              <IconCalendarEvent />
              {value ? format(new Date(value as string), "d MMM yyyy") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={value ? new Date(value as string) : undefined}
              onSelect={(d) => onChange(d ? format(d, "yyyy-MM-dd") : null)}
            />
          </PopoverContent>
        </Popover>
      );
    case "PERSON":
      return (
        <Select value={(value as string) ?? "__none"} onValueChange={(v) => onChange(v === "__none" ? null : v)}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Nobody</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    default: {
      const commit = () => {
        const next = field.type === "NUMBER" ? (draft === "" ? null : Number(draft)) : draft || null;
        if (next !== (value ?? null)) onChange(next);
      };
      return (
        <Input
          type={field.type === "NUMBER" ? "number" : field.type === "URL" ? "url" : "text"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          placeholder="Empty"
          className="h-8"
        />
      );
    }
  }
}
