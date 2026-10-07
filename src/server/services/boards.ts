import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { PresetColumn, PresetField } from "@/lib/workflow-presets";
import { boardKeyFrom } from "@/lib/slug";

type Tx = Prisma.TransactionClient;

/** Picks a board key that is free inside the org: SAL, SAL2, SAL3... */
export async function uniqueBoardKey(tx: Tx, orgId: string, name: string, requested?: string) {
  const base =
    (requested ?? boardKeyFrom(name))
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6) || "BRD";
  const taken = new Set(
    (await tx.board.findMany({ where: { orgId, key: { startsWith: base } }, select: { key: true } })).map((b) => b.key),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    if (!taken.has(`${base}${i}`)) return `${base}${i}`;
  }
  return `${base}${Date.now().toString(36).toUpperCase()}`;
}

/** Creates a board with its own copy of a template's columns and fields. */
export async function createBoardFromTemplate(
  tx: Tx,
  input: { orgId: string; teamId: string; templateId: string; name: string; key?: string; icon?: string },
) {
  const template = await tx.workflowTemplate.findFirstOrThrow({
    where: { id: input.templateId, OR: [{ orgId: null }, { orgId: input.orgId }] },
  });

  const columns = template.columns as unknown as PresetColumn[];
  const fields = template.fields as unknown as PresetField[];

  return tx.board.create({
    data: {
      orgId: input.orgId,
      teamId: input.teamId,
      templateId: template.id,
      name: input.name,
      key: await uniqueBoardKey(tx, input.orgId, input.name, input.key),
      icon: input.icon ?? template.icon,
      columns: {
        create: columns.map((column, index) => ({
          name: column.name,
          color: column.color,
          category: column.category,
          wipLimit: column.wipLimit ?? null,
          position: (index + 1) * 1000,
        })),
      },
      fields: {
        create: fields.map((field, index) => ({
          key: field.key,
          label: field.label,
          type: field.type,
          options: field.options ?? [],
          required: field.required ?? false,
          position: (index + 1) * 1000,
        })),
      },
    },
    include: { columns: { orderBy: { position: "asc" } } },
  });
}

/** Position between two neighbours for fractional ordering. */
export function between(before?: number | null, after?: number | null) {
  if (before == null && after == null) return 1000;
  if (before == null) return after! - 1000;
  if (after == null) return before + 1000;
  return (before + after) / 2;
}
