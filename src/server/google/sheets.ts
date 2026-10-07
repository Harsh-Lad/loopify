import "server-only";
import { drive } from "@googleapis/drive";
import { sheets } from "@googleapis/sheets";
import type { OAuth2Client } from "google-auth-library";
import type { Prisma, SheetOperation } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { getGoogleClient } from "@/server/google/oauth";
import type { ToolDefinition } from "@/server/ai";

type Values = (string | number | boolean | null)[][];

const MAX_READ_ROWS = 200;

function clients(auth: OAuth2Client) {
  // googleapis bundles its own copy of google-auth-library types; the runtime object is compatible.
  const a = auth as never;
  return { sheetsApi: sheets({ version: "v4", auth: a }), driveApi: drive({ version: "v3", auth: a }) };
}

export const SHEET_TOOLS: ToolDefinition[] = [
  {
    name: "list_spreadsheets",
    description: "Find the user's Google Sheets by name. Returns id, name and last modified time.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "Part of the spreadsheet name. Omit to list recent ones." } },
    },
  },
  {
    name: "get_spreadsheet",
    description: "Get a spreadsheet's title and its tabs with their sizes.",
    parameters: {
      type: "object",
      properties: { spreadsheetId: { type: "string" } },
      required: ["spreadsheetId"],
    },
  },
  {
    name: "get_share_link",
    description: "Get the shareable Google Sheets link for a spreadsheet.",
    parameters: {
      type: "object",
      properties: { spreadsheetId: { type: "string" } },
      required: ["spreadsheetId"],
    },
  },
  {
    name: "read_range",
    description: `Read cell values in A1 notation, e.g. "Sheet1!A1:F50". Returns at most ${MAX_READ_ROWS} rows.`,
    parameters: {
      type: "object",
      properties: { spreadsheetId: { type: "string" }, range: { type: "string" } },
      required: ["spreadsheetId", "range"],
    },
  },
  {
    name: "propose_update",
    description: "Propose overwriting cells in a range. Nothing changes until the user approves it.",
    parameters: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string" },
        range: { type: "string", description: "A1 range matching the size of values" },
        values: { type: "array", items: { type: "array", items: {} } },
        summary: { type: "string", description: "One plain sentence describing the change" },
      },
      required: ["spreadsheetId", "range", "values", "summary"],
    },
  },
  {
    name: "propose_append",
    description: "Propose adding rows after the last row of a table. Nothing changes until the user approves it.",
    parameters: {
      type: "object",
      properties: {
        spreadsheetId: { type: "string" },
        range: { type: "string", description: 'The table, e.g. "Leads!A:F"' },
        values: { type: "array", items: { type: "array", items: {} } },
        summary: { type: "string" },
      },
      required: ["spreadsheetId", "range", "values", "summary"],
    },
  },
  {
    name: "propose_clear",
    description: "Propose clearing the values in a range. Nothing changes until the user approves it.",
    parameters: {
      type: "object",
      properties: { spreadsheetId: { type: "string" }, range: { type: "string" }, summary: { type: "string" } },
      required: ["spreadsheetId", "range", "summary"],
    },
  },
  {
    name: "create_spreadsheet",
    description:
      "Create a new spreadsheet right away (no approval needed). Optionally give tabs with a header row and data rows. Returns its id and link.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        tabs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              header: { type: "array", items: { type: "string" } },
              rows: { type: "array", items: { type: "array", items: {} }, description: "Data rows under the header" },
            },
            required: ["title"],
          },
        },
        summary: { type: "string", description: "One plain sentence describing what was created" },
      },
      required: ["title", "summary"],
    },
  },
  {
    name: "propose_add_sheet",
    description: "Propose adding a new tab to an existing spreadsheet.",
    parameters: {
      type: "object",
      properties: { spreadsheetId: { type: "string" }, title: { type: "string" }, summary: { type: "string" } },
      required: ["spreadsheetId", "title", "summary"],
    },
  },
];

type ToolContext = { orgId: string; userId: string; sessionId: string };

/** Runs one tool call from the model. Reads run immediately; writes become proposals. */
export async function runSheetTool(ctx: ToolContext, name: string, args: Record<string, unknown>) {
  const auth = await getGoogleClient(ctx.orgId, ctx.userId);
  const { sheetsApi, driveApi } = clients(auth);
  const str = (key: string) => String(args[key] ?? "");

  switch (name) {
    case "list_spreadsheets": {
      const query = typeof args.query === "string" ? args.query.replace(/'/g, "\\'") : "";
      const res = await driveApi.files.list({
        q: `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false${query ? ` and name contains '${query}'` : ""}`,
        orderBy: "modifiedTime desc",
        pageSize: 15,
        fields: "files(id,name,modifiedTime,webViewLink)",
      });
      return { spreadsheets: res.data.files ?? [] };
    }
    case "get_spreadsheet": {
      const res = await sheetsApi.spreadsheets.get({
        spreadsheetId: str("spreadsheetId"),
        fields: "properties.title,spreadsheetUrl,sheets.properties(sheetId,title,gridProperties)",
      });
      await db.chatSession.update({ where: { id: ctx.sessionId }, data: { spreadsheetId: str("spreadsheetId") } });
      return {
        title: res.data.properties?.title,
        url: res.data.spreadsheetUrl,
        tabs: res.data.sheets?.map((s) => ({
          title: s.properties?.title,
          rows: s.properties?.gridProperties?.rowCount,
          columns: s.properties?.gridProperties?.columnCount,
        })),
      };
    }
    case "get_share_link": {
      const res = await driveApi.files.get({
        fileId: str("spreadsheetId"),
        fields: "name,webViewLink,shared",
      });
      return {
        name: res.data.name,
        url: res.data.webViewLink ?? `https://docs.google.com/spreadsheets/d/${str("spreadsheetId")}/edit`,
        sharedWithOthers: Boolean(res.data.shared),
      };
    }
    case "read_range": {
      const res = await sheetsApi.spreadsheets.values.get({ spreadsheetId: str("spreadsheetId"), range: str("range") });
      const values = (res.data.values ?? []) as Values;
      return {
        range: res.data.range,
        values: values.slice(0, MAX_READ_ROWS),
        truncated: values.length > MAX_READ_ROWS,
      };
    }
    case "propose_update":
    case "propose_clear": {
      const before = await sheetsApi.spreadsheets.values
        .get({ spreadsheetId: str("spreadsheetId"), range: str("range") })
        .then((r) => (r.data.values ?? []) as Values)
        .catch(() => [] as Values);
      const op = await db.sheetOperation.create({
        data: {
          sessionId: ctx.sessionId,
          userId: ctx.userId,
          spreadsheetId: str("spreadsheetId"),
          range: str("range"),
          kind: name === "propose_update" ? "UPDATE" : "CLEAR",
          summary: str("summary"),
          before: before as Prisma.InputJsonValue,
          after: (name === "propose_update" ? args.values : []) as Prisma.InputJsonValue,
        },
      });
      return { proposalId: op.id, status: "waiting_for_user_approval" };
    }
    case "propose_append": {
      const op = await db.sheetOperation.create({
        data: {
          sessionId: ctx.sessionId,
          userId: ctx.userId,
          spreadsheetId: str("spreadsheetId"),
          range: str("range"),
          kind: "APPEND",
          summary: str("summary"),
          after: args.values as Prisma.InputJsonValue,
        },
      });
      return { proposalId: op.id, status: "waiting_for_user_approval" };
    }
    case "create_spreadsheet":
    case "propose_create_spreadsheet": {
      // Creating a fresh file can't hurt existing data, so it happens without asking.
      const op = await db.sheetOperation.create({
        data: {
          sessionId: ctx.sessionId,
          userId: ctx.userId,
          kind: "CREATE_SPREADSHEET",
          summary: str("summary") || `Created "${str("title")}"`,
          after: { title: str("title"), tabs: (args.tabs as Prisma.InputJsonValue) ?? [] },
        },
      });
      try {
        const result = (await applyOperation(ctx.orgId, op)) as { spreadsheetId?: string; url?: string };
        await db.sheetOperation.update({
          where: { id: op.id },
          data: {
            status: "APPLIED",
            appliedAt: new Date(),
            spreadsheetId: result.spreadsheetId ?? null,
            result: result as Prisma.InputJsonValue,
          },
        });
        return { created: true, title: str("title"), spreadsheetId: result.spreadsheetId, url: result.url };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await db.sheetOperation.update({
          where: { id: op.id },
          data: { status: "FAILED", error: message.slice(0, 300) },
        });
        return { error: "Couldn't create the spreadsheet." };
      }
    }
    case "propose_add_sheet": {
      const op = await db.sheetOperation.create({
        data: {
          sessionId: ctx.sessionId,
          userId: ctx.userId,
          spreadsheetId: str("spreadsheetId"),
          kind: "ADD_SHEET",
          summary: str("summary"),
          after: { title: str("title") },
        },
      });
      return { proposalId: op.id, status: "waiting_for_user_approval" };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

/** Applies an approved proposal to the real spreadsheet. */
export async function applyOperation(orgId: string, op: SheetOperation) {
  const auth = await getGoogleClient(orgId, op.userId);
  const { sheetsApi } = clients(auth);
  const after = op.after as Record<string, unknown> | Values;

  switch (op.kind) {
    case "UPDATE": {
      await sheetsApi.spreadsheets.values.update({
        spreadsheetId: op.spreadsheetId!,
        range: op.range!,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: after as Values },
      });
      return {};
    }
    case "CLEAR": {
      await sheetsApi.spreadsheets.values.clear({ spreadsheetId: op.spreadsheetId!, range: op.range! });
      return {};
    }
    case "APPEND": {
      const res = await sheetsApi.spreadsheets.values.append({
        spreadsheetId: op.spreadsheetId!,
        range: op.range!,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: after as Values },
      });
      // Remember exactly which cells were written so undo can clear them.
      return { appliedRange: res.data.updates?.updatedRange ?? null };
    }
    case "CREATE_SPREADSHEET": {
      const spec = after as { title: string; tabs?: { title: string; header?: string[]; rows?: Values }[] };
      const res = await sheetsApi.spreadsheets.create({
        requestBody: {
          properties: { title: spec.title },
          sheets: (spec.tabs?.length ? spec.tabs : [{ title: "Sheet1" }]).map((tab) => ({
            properties: { title: tab.title },
            data:
              tab.header?.length || tab.rows?.length
                ? [
                    {
                      startRow: 0,
                      startColumn: 0,
                      rowData: [...(tab.header?.length ? [tab.header] : []), ...(tab.rows ?? [])].map((row, i) => ({
                        values: row.map((v) => ({
                          userEnteredValue:
                            typeof v === "number"
                              ? { numberValue: v }
                              : typeof v === "boolean"
                                ? { boolValue: v }
                                : String(v ?? "").startsWith("=")
                                  ? { formulaValue: String(v) }
                                  : { stringValue: String(v ?? "") },
                          ...(i === 0 && tab.header?.length
                            ? { userEnteredFormat: { textFormat: { bold: true } } }
                            : {}),
                        })),
                      })),
                    },
                  ]
                : undefined,
            ...(tab.header?.length ? { properties: { title: tab.title, gridProperties: { frozenRowCount: 1 } } } : {}),
          })),
        },
      });
      return { spreadsheetId: res.data.spreadsheetId, url: res.data.spreadsheetUrl };
    }
    case "ADD_SHEET": {
      const res = await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: op.spreadsheetId!,
        requestBody: { requests: [{ addSheet: { properties: { title: (after as { title: string }).title } } }] },
      });
      return { sheetId: res.data.replies?.[0]?.addSheet?.properties?.sheetId ?? null };
    }
  }
}

/** Reverses an applied operation where Google's API allows it. */
export async function undoOperation(orgId: string, op: SheetOperation) {
  const auth = await getGoogleClient(orgId, op.userId);
  const { sheetsApi } = clients(auth);
  const result = (op.result ?? {}) as Record<string, unknown>;
  const meta = (op.before ?? null) as Values | null;

  switch (op.kind) {
    case "UPDATE":
    case "CLEAR": {
      await sheetsApi.spreadsheets.values.clear({ spreadsheetId: op.spreadsheetId!, range: op.range! });
      if (meta?.length) {
        await sheetsApi.spreadsheets.values.update({
          spreadsheetId: op.spreadsheetId!,
          range: op.range!,
          valueInputOption: "RAW",
          requestBody: { values: meta },
        });
      }
      return;
    }
    case "APPEND": {
      const range = result.appliedRange as string | undefined;
      if (!range) throw new Error("Can't find which rows were added, so this can't be undone.");
      await sheetsApi.spreadsheets.values.clear({ spreadsheetId: op.spreadsheetId!, range });
      return;
    }
    case "ADD_SHEET": {
      const sheetId = result.sheetId as number | undefined;
      if (sheetId == null) throw new Error("Can't find the tab that was added.");
      await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: op.spreadsheetId!,
        requestBody: { requests: [{ deleteSheet: { sheetId } }] },
      });
      return;
    }
    case "CREATE_SPREADSHEET":
      throw new Error("New spreadsheets can't be undone from here. Delete it in Google Drive if you don't need it.");
  }
}
