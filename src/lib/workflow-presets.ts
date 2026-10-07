/**
 * Built-in workflow templates. Seeded as system templates (orgId = null).
 * A board created from a template copies these columns and fields, then the
 * team can change its own copy without touching the template.
 *
 * Kept free of server-only imports so the seed script can use it.
 */

export type PresetColumn = {
  name: string;
  color: string;
  category: "TODO" | "IN_PROGRESS" | "DONE";
  wipLimit?: number;
};

export type PresetField = {
  key: string;
  label: string;
  type: "TEXT" | "NUMBER" | "DATE" | "SELECT" | "MULTI_SELECT" | "URL" | "CHECKBOX" | "PERSON";
  options?: string[];
  required?: boolean;
};

export type WorkflowPreset = {
  id: string;
  name: string;
  description: string;
  category: "GENERAL" | "TECH" | "CREATIVE" | "SALES" | "INFLUENCER" | "OUTREACH";
  icon: string;
  columns: PresetColumn[];
  fields: PresetField[];
};

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: "tpl_general",
    name: "Simple flow",
    description: "To do, doing, done. Works for anything.",
    category: "GENERAL",
    icon: "layout-kanban",
    columns: [
      { name: "To do", color: "slate", category: "TODO" },
      { name: "Doing", color: "blue", category: "IN_PROGRESS" },
      { name: "Done", color: "green", category: "DONE" },
    ],
    fields: [],
  },
  {
    id: "tpl_tech",
    name: "Product and engineering",
    description: "Backlog to shipped, with review built in.",
    category: "TECH",
    icon: "code",
    columns: [
      { name: "Backlog", color: "slate", category: "TODO" },
      { name: "To do", color: "sky", category: "TODO" },
      { name: "In progress", color: "blue", category: "IN_PROGRESS", wipLimit: 5 },
      { name: "In review", color: "violet", category: "IN_PROGRESS" },
      { name: "Done", color: "green", category: "DONE" },
    ],
    fields: [
      { key: "type", label: "Type", type: "SELECT", options: ["Feature", "Bug", "Chore", "Spike"] },
      { key: "estimate", label: "Estimate (pts)", type: "NUMBER" },
      { key: "pr_link", label: "PR link", type: "URL" },
    ],
  },
  {
    id: "tpl_creative",
    name: "Creative production",
    description: "From brief to delivered, with client rounds.",
    category: "CREATIVE",
    icon: "palette",
    columns: [
      { name: "Brief", color: "slate", category: "TODO" },
      { name: "Ideation", color: "amber", category: "IN_PROGRESS" },
      { name: "In production", color: "blue", category: "IN_PROGRESS" },
      { name: "Client review", color: "violet", category: "IN_PROGRESS" },
      { name: "Revisions", color: "orange", category: "IN_PROGRESS" },
      { name: "Delivered", color: "green", category: "DONE" },
    ],
    fields: [
      { key: "client", label: "Client", type: "TEXT" },
      {
        key: "format",
        label: "Format",
        type: "MULTI_SELECT",
        options: ["Reel", "Carousel", "Static", "Video", "Copy"],
      },
      { key: "revision_round", label: "Revision round", type: "NUMBER" },
      { key: "asset_link", label: "Asset link", type: "URL" },
    ],
  },
  {
    id: "tpl_sales",
    name: "Sales pipeline",
    description: "Track every deal from first hello to signed.",
    category: "SALES",
    icon: "chart-arrows-vertical",
    columns: [
      { name: "Lead", color: "slate", category: "TODO" },
      { name: "Contacted", color: "sky", category: "IN_PROGRESS" },
      { name: "Qualified", color: "blue", category: "IN_PROGRESS" },
      { name: "Proposal sent", color: "violet", category: "IN_PROGRESS" },
      { name: "Negotiation", color: "amber", category: "IN_PROGRESS" },
      { name: "Won", color: "green", category: "DONE" },
      { name: "Lost", color: "rose", category: "DONE" },
    ],
    fields: [
      { key: "company", label: "Company", type: "TEXT", required: true },
      { key: "deal_value", label: "Deal value (INR)", type: "NUMBER" },
      { key: "contact_email", label: "Contact email", type: "TEXT" },
      { key: "next_follow_up", label: "Next follow-up", type: "DATE" },
    ],
  },
  {
    id: "tpl_influencer",
    name: "Influencer campaigns",
    description: "Shortlist, sign, go live, report back.",
    category: "INFLUENCER",
    icon: "speakerphone",
    columns: [
      { name: "Shortlist", color: "slate", category: "TODO" },
      { name: "Outreach", color: "sky", category: "IN_PROGRESS" },
      { name: "Negotiating", color: "amber", category: "IN_PROGRESS" },
      { name: "Contracted", color: "blue", category: "IN_PROGRESS" },
      { name: "Content in progress", color: "violet", category: "IN_PROGRESS" },
      { name: "Live", color: "pink", category: "IN_PROGRESS" },
      { name: "Reported", color: "green", category: "DONE" },
    ],
    fields: [
      { key: "handle", label: "Handle", type: "TEXT", required: true },
      {
        key: "platform",
        label: "Platform",
        type: "SELECT",
        options: ["Instagram", "YouTube", "LinkedIn", "X", "Other"],
      },
      { key: "followers", label: "Followers", type: "NUMBER" },
      { key: "fee", label: "Fee (INR)", type: "NUMBER" },
      { key: "go_live", label: "Go-live date", type: "DATE" },
    ],
  },
  {
    id: "tpl_outreach",
    name: "Outreach",
    description: "Cold to warm, with follow-ups that never slip.",
    category: "OUTREACH",
    icon: "send",
    columns: [
      { name: "To contact", color: "slate", category: "TODO" },
      { name: "Contacted", color: "sky", category: "IN_PROGRESS" },
      { name: "Follow-up", color: "amber", category: "IN_PROGRESS" },
      { name: "Replied", color: "violet", category: "IN_PROGRESS" },
      { name: "Meeting booked", color: "green", category: "DONE" },
      { name: "Not interested", color: "rose", category: "DONE" },
    ],
    fields: [
      { key: "channel", label: "Channel", type: "SELECT", options: ["Email", "LinkedIn", "WhatsApp", "Call"] },
      { key: "contact", label: "Contact", type: "TEXT" },
      { key: "follow_up_on", label: "Follow up on", type: "DATE" },
    ],
  },
];

export const COLUMN_COLORS = [
  "slate",
  "sky",
  "blue",
  "violet",
  "pink",
  "rose",
  "orange",
  "amber",
  "green",
  "teal",
] as const;

export type ColumnColor = (typeof COLUMN_COLORS)[number];
