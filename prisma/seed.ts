import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Priority } from "../src/generated/prisma/client";
import { WORKFLOW_PRESETS, type PresetColumn, type PresetField } from "../src/lib/workflow-presets";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DEMO_PASSWORD = "loop1234";
const DEMO_ORG_SLUG = "loopify-demo";
const DEMO_USERS = [
  { name: "Arjun Singh", email: "demo@loopify.dev", role: "OWNER" as const },
  { name: "Jamil Khan", email: "jamil@loopify.dev", role: "MANAGER" as const },
  { name: "Riya Mehta", email: "riya@loopify.dev", role: "MEMBER" as const },
];

async function seedTemplates() {
  for (const preset of WORKFLOW_PRESETS) {
    const data = {
      name: preset.name,
      description: preset.description,
      category: preset.category,
      icon: preset.icon,
      columns: preset.columns,
      fields: preset.fields,
    };
    await db.workflowTemplate.upsert({
      where: { id: preset.id },
      create: { id: preset.id, orgId: null, ...data },
      update: data,
    });
  }
  console.log(`Seeded ${WORKFLOW_PRESETS.length} workflow templates.`);
}

function dayKey(offset: number) {
  const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
}

async function createBoard(orgId: string, teamId: string, templateId: string, name: string, key: string) {
  const template = await db.workflowTemplate.findUniqueOrThrow({ where: { id: templateId } });
  const columns = template.columns as unknown as PresetColumn[];
  const fields = template.fields as unknown as PresetField[];
  return db.board.create({
    data: {
      orgId,
      teamId,
      templateId,
      name,
      key,
      icon: template.icon,
      columns: {
        create: columns.map((c, i) => ({
          name: c.name,
          color: c.color,
          category: c.category,
          wipLimit: c.wipLimit ?? null,
          position: (i + 1) * 1000,
        })),
      },
      fields: {
        create: fields.map((f, i) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          options: f.options ?? [],
          required: f.required ?? false,
          position: (i + 1) * 1000,
        })),
      },
    },
    include: { columns: { orderBy: { position: "asc" } } },
  });
}

type CardSeed = {
  title: string;
  column: number;
  assignee: number;
  priority?: Priority;
  dueIn?: number;
  rolled?: number;
};

async function seedDemo() {
  if (await db.organization.findUnique({ where: { slug: DEMO_ORG_SLUG } })) {
    console.log("Demo org already exists, skipping.");
    return;
  }

  const passwordHash = await hash(DEMO_PASSWORD, { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 });
  const users: { id: string }[] = [];
  for (const u of DEMO_USERS) {
    users.push(
      await db.user.upsert({
        where: { email: u.email },
        create: { name: u.name, email: u.email, passwordHash, emailVerified: new Date() },
        update: {},
      }),
    );
  }

  const org = await db.organization.create({
    data: {
      name: "Loopify Demo",
      slug: DEMO_ORG_SLUG,
      members: { create: users.map((u, i) => ({ userId: u.id, role: DEMO_USERS[i]!.role })) },
    },
  });
  await db.user.updateMany({ where: { id: { in: users.map((u) => u.id) } }, data: { activeOrgId: org.id } });

  const teams = [
    {
      name: "General",
      slug: "general",
      icon: "sparkles",
      color: "violet",
      template: "tpl_general",
      key: "GEN",
      members: [0, 1, 2],
    },
    { name: "Tech", slug: "tech", icon: "code", color: "blue", template: "tpl_tech", key: "TEC", members: [0, 1] },
    {
      name: "Creative",
      slug: "creative",
      icon: "palette",
      color: "pink",
      template: "tpl_creative",
      key: "CRE",
      members: [0, 2],
    },
  ];

  const cards: Record<string, CardSeed[]> = {
    GEN: [
      {
        title: "Send revised deck to Infinity Logistics",
        column: 0,
        assignee: 0,
        priority: "HIGH",
        dueIn: 1,
        rolled: 1,
      },
      { title: "Book shoot location for Diwali reel", column: 1, assignee: 2, dueIn: 3 },
      { title: "Collect pending invoices from September", column: 0, assignee: 1, priority: "MEDIUM" },
      { title: "Set up Loopify for the whole team", column: 2, assignee: 0 },
    ],
    TEC: [
      { title: "Fix login redirect loop on mobile", column: 2, assignee: 0, priority: "URGENT", rolled: 3 },
      { title: "Review Secura question-ranking PR", column: 3, assignee: 1, priority: "MEDIUM" },
      { title: "Write onboarding email sequence", column: 1, assignee: 0, dueIn: 2 },
      { title: "Upgrade staging to Next 16", column: 0, assignee: 1 },
      { title: "Ship sign-up OTP flow", column: 4, assignee: 0 },
    ],
    CRE: [
      {
        title: "Draft Q4 content calendar for Sunday Pure Holiday",
        column: 1,
        assignee: 2,
        priority: "HIGH",
        dueIn: 0,
      },
      { title: "Client review: Hakki Pikki carousel", column: 3, assignee: 0 },
      { title: "Storyboard XX Refrigerators city reel", column: 2, assignee: 2, dueIn: 5 },
      { title: "Deliver Vijay Shanthi blog banners", column: 5, assignee: 2 },
    ],
  };

  const created: { id: string; assignee: number; done: boolean; rolled: number }[] = [];

  for (const t of teams) {
    const team = await db.team.create({
      data: {
        orgId: org.id,
        name: t.name,
        slug: t.slug,
        icon: t.icon,
        color: t.color,
        members: { create: t.members.map((i) => ({ userId: users[i]!.id, role: i === 0 ? "LEAD" : "MEMBER" })) },
      },
    });
    const board = await createBoard(org.id, team.id, t.template, t.name, t.key);
    let number = 0;
    for (const c of cards[t.key] ?? []) {
      const column = board.columns[Math.min(c.column, board.columns.length - 1)]!;
      const done = column.category === "DONE";
      const due = c.dueIn === undefined ? null : dayKey(c.dueIn);
      const card = await db.card.create({
        data: {
          orgId: org.id,
          boardId: board.id,
          columnId: column.id,
          number: ++number,
          title: c.title,
          priority: c.priority ?? "NONE",
          assigneeId: users[c.assignee]!.id,
          reporterId: users[0]!.id,
          dueDate: due,
          position: number * 1000,
          rolloverCount: c.rolled ?? 0,
          completedAt: done ? new Date() : null,
        },
      });
      await db.cardEvent.create({
        data: {
          orgId: org.id,
          boardId: board.id,
          cardId: card.id,
          actorId: users[0]!.id,
          type: "CREATED",
          toColumnId: column.id,
        },
      });
      if (done) {
        await db.cardEvent.create({
          data: {
            orgId: org.id,
            boardId: board.id,
            cardId: card.id,
            actorId: users[c.assignee]!.id,
            type: "COMPLETED",
          },
        });
      }
      created.push({ id: card.id, assignee: c.assignee, done, rolled: c.rolled ?? 0 });
    }
    await db.board.update({ where: { id: board.id }, data: { cardSeq: number } });
  }

  // Yesterday's plan for the demo owner: open cards left unfinished, so the rollover tray shows up.
  const mine = created.filter((c) => c.assignee === 0);
  const yesterday = await db.dayPlan.create({
    data: { orgId: org.id, userId: users[0]!.id, date: dayKey(-1), mood: "good", closedAt: new Date() },
  });
  let pos = 0;
  for (const c of mine) {
    await db.dayPlanItem.create({
      data: { dayPlanId: yesterday.id, cardId: c.id, position: (pos += 1000), status: c.done ? "DONE" : "PLANNED" },
    });
  }

  console.log(`Seeded demo org with ${users.length} people, ${teams.length} teams and ${created.length} cards.`);
  console.log(`Sign in with ${DEMO_USERS.map((u) => u.email).join(", ")} / password: ${DEMO_PASSWORD}`);
}

async function main() {
  await seedTemplates();
  if (process.env.NODE_ENV !== "production" && process.env.SEED_DEMO !== "false") await seedDemo();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
