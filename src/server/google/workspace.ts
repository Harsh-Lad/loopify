import "server-only";
import { drive } from "@googleapis/drive";
import { sheets } from "@googleapis/sheets";
import { getGoogleClient } from "@/server/google/oauth";

/**
 * Direct spreadsheet operations used by the in-app editor. Unlike chat tools,
 * these run immediately because the user is making the change by hand.
 */

export type CellValue = string | number | boolean | null;
export type Values = CellValue[][];

const MAX_EDITOR_ROWS = 1000;

async function apis(orgId: string, userId: string) {
  const auth = (await getGoogleClient(orgId, userId)) as never;
  return { sheetsApi: sheets({ version: "v4", auth }), driveApi: drive({ version: "v3", auth }) };
}

/** Quotes a tab name for A1 notation: My Tab → 'My Tab'. */
export function tabRef(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

/** 0 → A, 25 → Z, 26 → AA. */
export function columnLetter(index: number) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export async function listSpreadsheets(orgId: string, userId: string, query?: string, pageToken?: string) {
  const { driveApi } = await apis(orgId, userId);
  const safe = query?.trim().replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const res = await driveApi.files.list({
    q: `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false${safe ? ` and name contains '${safe}'` : ""}`,
    orderBy: safe ? undefined : "modifiedTime desc",
    pageSize: 48,
    pageToken,
    fields:
      "nextPageToken, files(id, name, modifiedTime, webViewLink, iconLink, owners(displayName, emailAddress), shared)",
  });
  return {
    files: (res.data.files ?? []).map((f) => ({
      id: f.id!,
      name: f.name ?? "Untitled spreadsheet",
      modifiedTime: f.modifiedTime ?? null,
      url: f.webViewLink ?? `https://docs.google.com/spreadsheets/d/${f.id}/edit`,
      owner: f.owners?.[0]?.displayName ?? f.owners?.[0]?.emailAddress ?? null,
      shared: Boolean(f.shared),
    })),
    nextPageToken: res.data.nextPageToken ?? null,
  };
}

export async function getSpreadsheetMeta(orgId: string, userId: string, spreadsheetId: string) {
  const { sheetsApi, driveApi } = await apis(orgId, userId);
  const [res, file] = await Promise.all([
    sheetsApi.spreadsheets.get({
      spreadsheetId,
      fields:
        "spreadsheetId,spreadsheetUrl,properties(title,locale,timeZone),namedRanges(name),sheets(properties(sheetId,title,index,hidden,tabColorStyle,gridProperties),charts(chartId,spec(title)),protectedRanges(protectedRangeId))",
    }),
    driveApi.files
      .get({ fileId: spreadsheetId, fields: "modifiedTime,lastModifyingUser(displayName),owners(displayName),shared" })
      .then((r) => r.data)
      .catch(() => null),
  ]);
  return {
    id: res.data.spreadsheetId!,
    title: res.data.properties?.title ?? "Untitled spreadsheet",
    url: res.data.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    locale: res.data.properties?.locale ?? null,
    timeZone: res.data.properties?.timeZone ?? null,
    namedRanges: (res.data.namedRanges ?? []).map((n) => n.name ?? "").filter(Boolean),
    modifiedTime: file?.modifiedTime ?? null,
    lastEditedBy: file?.lastModifyingUser?.displayName ?? null,
    owner: file?.owners?.[0]?.displayName ?? null,
    shared: Boolean(file?.shared),
    tabs: (res.data.sheets ?? [])
      .map((s) => ({
        sheetId: s.properties?.sheetId ?? 0,
        title: s.properties?.title ?? "Sheet1",
        index: s.properties?.index ?? 0,
        hidden: Boolean(s.properties?.hidden),
        color: toHex(s.properties?.tabColorStyle?.rgbColor),
        rows: s.properties?.gridProperties?.rowCount ?? 0,
        columns: s.properties?.gridProperties?.columnCount ?? 0,
        frozenRows: s.properties?.gridProperties?.frozenRowCount ?? 0,
        frozenColumns: s.properties?.gridProperties?.frozenColumnCount ?? 0,
        charts: (s.charts ?? []).map((c) => c.spec?.title || "Untitled chart"),
        protectedRanges: s.protectedRanges?.length ?? 0,
      }))
      .sort((a, b) => a.index - b.index),
  };
}

type Rgb = { red?: number | null; green?: number | null; blue?: number | null } | null | undefined;

function toHex(rgb: Rgb) {
  if (!rgb) return null;
  const part = (v?: number | null) =>
    Math.round((v ?? 0) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${part(rgb.red)}${part(rgb.green)}${part(rgb.blue)}`;
}

function fromHex(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return { red: ((n >> 16) & 255) / 255, green: ((n >> 8) & 255) / 255, blue: (n & 255) / 255 };
}

/** What the grid needs to draw one cell beyond its text. Only set keys are sent. */
export type CellMeta = {
  formula?: string;
  bold?: true;
  italic?: true;
  strike?: true;
  underline?: true;
  color?: string;
  fill?: string;
  align?: "left" | "center" | "right";
  wrap?: true;
  note?: string;
  link?: string;
  checkbox?: true;
  options?: string[];
};

export type TabGrid = {
  values: Values;
  cells: Record<string, CellMeta>;
  columnWidths: number[];
  rowHeights: number[];
  hiddenColumns: number[];
  hiddenRows: number[];
  merges: { row: number; col: number; rows: number; cols: number }[];
  frozenRows: number;
  frozenColumns: number;
  truncated: boolean;
};

const MAX_EDITOR_COLS = 60;

/**
 * Reads a tab with its look: formatting, formulas, notes, links, dropdowns,
 * checkboxes, column widths, frozen panes and merged cells.
 */
export async function readTab(orgId: string, userId: string, spreadsheetId: string, tab: string): Promise<TabGrid> {
  const { sheetsApi } = await apis(orgId, userId);
  const res = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    ranges: [`${tabRef(tab)}!A1:${columnLetter(MAX_EDITOR_COLS - 1)}${MAX_EDITOR_ROWS}`],
    includeGridData: true,
    fields:
      "sheets(properties(gridProperties(frozenRowCount,frozenColumnCount,rowCount)),merges,data(columnMetadata(pixelSize,hiddenByUser),rowMetadata(pixelSize,hiddenByUser),rowData(values(formattedValue,userEnteredValue(formulaValue),effectiveFormat(backgroundColorStyle,horizontalAlignment,wrapStrategy,textFormat(bold,italic,strikethrough,underline,foregroundColorStyle)),note,hyperlink,dataValidation(condition(type,values(userEnteredValue)))))))",
  });
  const sheet = res.data.sheets?.[0];
  const data = sheet?.data?.[0];
  const rowData = data?.rowData ?? [];
  const values: Values = [];
  const cells: Record<string, CellMeta> = {};

  rowData.forEach((row, r) => {
    const out: CellValue[] = [];
    (row.values ?? []).forEach((cell, c) => {
      out[c] = cell.formattedValue ?? null;
      const meta: CellMeta = {};
      const fmt = cell.effectiveFormat;
      const text = fmt?.textFormat;
      if (cell.userEnteredValue?.formulaValue) meta.formula = cell.userEnteredValue.formulaValue;
      if (text?.bold) meta.bold = true;
      if (text?.italic) meta.italic = true;
      if (text?.strikethrough) meta.strike = true;
      if (text?.underline) meta.underline = true;
      const color = toHex(text?.foregroundColorStyle?.rgbColor);
      if (color && color !== "#000000") meta.color = color;
      const fill = toHex(fmt?.backgroundColorStyle?.rgbColor);
      if (fill && fill !== "#ffffff") meta.fill = fill;
      const align = fmt?.horizontalAlignment?.toLowerCase();
      if (align === "center" || align === "right") meta.align = align;
      if (fmt?.wrapStrategy === "WRAP") meta.wrap = true;
      if (cell.note) meta.note = cell.note;
      if (cell.hyperlink) meta.link = cell.hyperlink;
      const rule = cell.dataValidation?.condition;
      if (rule?.type === "BOOLEAN") meta.checkbox = true;
      if (rule?.type === "ONE_OF_LIST") {
        meta.options = (rule.values ?? []).map((v) => v.userEnteredValue ?? "").filter(Boolean);
      }
      if (Object.keys(meta).length) cells[`${r}:${c}`] = meta;
    });
    // Trim trailing empty cells so the grid knows the real width.
    while (out.length && (out[out.length - 1] == null || out[out.length - 1] === "")) out.pop();
    values.push(out);
  });
  while (values.length && values[values.length - 1]!.length === 0) values.pop();

  const columnWidths = (data?.columnMetadata ?? []).map((m) => m.pixelSize ?? 100);
  const rowHeights = (data?.rowMetadata ?? []).map((m) => m.pixelSize ?? 21);
  const hiddenColumns: number[] = [];
  const hiddenRows: number[] = [];
  data?.columnMetadata?.forEach((m, i) => m.hiddenByUser && hiddenColumns.push(i));
  data?.rowMetadata?.forEach((m, i) => m.hiddenByUser && hiddenRows.push(i));

  return {
    values,
    cells,
    columnWidths,
    rowHeights,
    hiddenColumns,
    hiddenRows,
    merges: (sheet?.merges ?? []).map((m) => ({
      row: m.startRowIndex ?? 0,
      col: m.startColumnIndex ?? 0,
      rows: (m.endRowIndex ?? 1) - (m.startRowIndex ?? 0),
      cols: (m.endColumnIndex ?? 1) - (m.startColumnIndex ?? 0),
    })),
    frozenRows: sheet?.properties?.gridProperties?.frozenRowCount ?? 0,
    frozenColumns: sheet?.properties?.gridProperties?.frozenColumnCount ?? 0,
    truncated: rowData.length >= MAX_EDITOR_ROWS,
  };
}

export type CellRange = { row: number; col: number; rows: number; cols: number };

export type FormatPatch = {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  underline?: boolean;
  color?: string | null;
  fill?: string | null;
  align?: "LEFT" | "CENTER" | "RIGHT";
  wrap?: boolean;
  clear?: boolean;
};

/** Applies formatting to a block of cells, like the Google Sheets toolbar. */
export async function formatCells(
  orgId: string,
  userId: string,
  spreadsheetId: string,
  sheetId: number,
  range: CellRange,
  patch: FormatPatch,
) {
  const { sheetsApi } = await apis(orgId, userId);
  const gridRange = {
    sheetId,
    startRowIndex: range.row,
    endRowIndex: range.row + range.rows,
    startColumnIndex: range.col,
    endColumnIndex: range.col + range.cols,
  };
  if (patch.clear) {
    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ repeatCell: { range: gridRange, cell: {}, fields: "userEnteredFormat" } }] },
    });
    return { ok: true };
  }
  const fields: string[] = [];
  const textFormat: Record<string, unknown> = {};
  const format: Record<string, unknown> = {};
  if (patch.bold !== undefined) {
    textFormat.bold = patch.bold;
    fields.push("userEnteredFormat.textFormat.bold");
  }
  if (patch.italic !== undefined) {
    textFormat.italic = patch.italic;
    fields.push("userEnteredFormat.textFormat.italic");
  }
  if (patch.strike !== undefined) {
    textFormat.strikethrough = patch.strike;
    fields.push("userEnteredFormat.textFormat.strikethrough");
  }
  if (patch.underline !== undefined) {
    textFormat.underline = patch.underline;
    fields.push("userEnteredFormat.textFormat.underline");
  }
  if (patch.color !== undefined) {
    textFormat.foregroundColorStyle = patch.color ? { rgbColor: fromHex(patch.color) } : null;
    fields.push("userEnteredFormat.textFormat.foregroundColorStyle");
  }
  if (Object.keys(textFormat).length) format.textFormat = textFormat;
  if (patch.fill !== undefined) {
    format.backgroundColorStyle = patch.fill ? { rgbColor: fromHex(patch.fill) } : null;
    fields.push("userEnteredFormat.backgroundColorStyle");
  }
  if (patch.align) {
    format.horizontalAlignment = patch.align;
    fields.push("userEnteredFormat.horizontalAlignment");
  }
  if (patch.wrap !== undefined) {
    format.wrapStrategy = patch.wrap ? "WRAP" : "OVERFLOW_CELL";
    fields.push("userEnteredFormat.wrapStrategy");
  }
  if (!fields.length) return { ok: true };
  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ repeatCell: { range: gridRange, cell: { userEnteredFormat: format }, fields: fields.join(",") } }],
    },
  });
  return { ok: true };
}

/** Freezes the first N rows and columns of a tab (0 unfreezes). */
export async function freezePanes(
  orgId: string,
  userId: string,
  spreadsheetId: string,
  sheetId: number,
  rows: number,
  columns: number,
) {
  const { sheetsApi } = await apis(orgId, userId);
  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: rows, frozenColumnCount: columns } },
            fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
          },
        },
      ],
    },
  });
  return { ok: true };
}

/** Sorts a tab's rows by one column, keeping the first `headerRows` rows in place. */
export async function sortByColumn(
  orgId: string,
  userId: string,
  spreadsheetId: string,
  sheetId: number,
  column: number,
  ascending: boolean,
  headerRows: number,
) {
  const { sheetsApi } = await apis(orgId, userId);
  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          sortRange: {
            range: { sheetId, startRowIndex: headerRows },
            sortSpecs: [{ dimensionIndex: column, sortOrder: ascending ? "ASCENDING" : "DESCENDING" }],
          },
        },
      ],
    },
  });
  return { ok: true };
}

export async function writeCells(
  orgId: string,
  userId: string,
  spreadsheetId: string,
  tab: string,
  edits: { row: number; col: number; value: string }[],
) {
  if (!edits.length) return { updatedCells: 0 };
  const { sheetsApi } = await apis(orgId, userId);
  const res = await sheetsApi.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: edits.map((e) => ({
        range: `${tabRef(tab)}!${columnLetter(e.col)}${e.row + 1}`,
        values: [[e.value]],
      })),
    },
  });
  return { updatedCells: res.data.totalUpdatedCells ?? edits.length };
}

export async function appendRows(orgId: string, userId: string, spreadsheetId: string, tab: string, rows: Values) {
  const { sheetsApi } = await apis(orgId, userId);
  const res = await sheetsApi.spreadsheets.values.append({
    spreadsheetId,
    range: `${tabRef(tab)}!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
  return { updatedRange: res.data.updates?.updatedRange ?? null, rows: res.data.updates?.updatedRows ?? rows.length };
}

/** Deletes whole rows (0-based indexes) from a tab. */
export async function deleteRows(
  orgId: string,
  userId: string,
  spreadsheetId: string,
  sheetId: number,
  rows: number[],
) {
  if (!rows.length) return { deleted: 0 };
  const { sheetsApi } = await apis(orgId, userId);
  // Delete bottom-up so earlier deletions don't shift later indexes.
  const sorted = [...new Set(rows)].sort((a, b) => b - a);
  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: sorted.map((row) => ({
        deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: row, endIndex: row + 1 } },
      })),
    },
  });
  return { deleted: sorted.length };
}

export async function addTab(orgId: string, userId: string, spreadsheetId: string, title: string) {
  const { sheetsApi } = await apis(orgId, userId);
  const res = await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });
  return { sheetId: res.data.replies?.[0]?.addSheet?.properties?.sheetId ?? null, title };
}

export async function createSpreadsheet(orgId: string, userId: string, title: string, rows: Values = []) {
  const { sheetsApi } = await apis(orgId, userId);
  const res = await sheetsApi.spreadsheets.create({
    requestBody: { properties: { title }, sheets: [{ properties: { title: "Sheet1" } }] },
    fields: "spreadsheetId,spreadsheetUrl",
  });
  const id = res.data.spreadsheetId!;
  if (rows.length) {
    await sheetsApi.spreadsheets.values.update({
      spreadsheetId: id,
      range: "Sheet1!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows },
    });
  }
  return { id, url: res.data.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${id}/edit` };
}
