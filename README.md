# Loopify

Your team's daily loop. Plan the day, capture what was said, finish things on a Kanban board, and roll whatever's left into tomorrow.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack, Cache Components), TypeScript |
| UI | shadcn/ui (every component installed, `radix-maia` style), Tailwind CSS v4, Tabler icons, Sonner toasts, motion, dnd-kit, Tiptap |
| API | tRPC v11 at `/api/trpc` for the web app, the same procedures as REST at `/api/v1` for mobile (spec at `/api/v1/openapi.json`) |
| Database | PostgreSQL on Neon, Prisma 7 with the `pg` driver adapter |
| Auth | NextAuth v5 (credentials), email OTP verification and password reset via Nodemailer |
| Jobs | Inngest (capture processing, end-of-day summaries, nightly sweep) |
| AI | Own adapter layer (`src/server/ai`), Grok through the OpenAI-compatible adapter |
| Google | Sheets + Drive APIs with encrypted OAuth tokens |

No server actions anywhere. All backend logic lives in API routes.

## Run it locally (Windows, macOS or Linux)

Requires Node.js 20.9 or newer.

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
```

Fill in `.env`:

1. **Database.** Create a free project on [neon.tech](https://neon.tech). From **Connect**, copy the pooled string into `DATABASE_URL` and the direct string into `DATABASE_URL`.
2. **AUTH_SECRET** and **TOKEN_ENCRYPTION_KEY.** Generate each with
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
3. **Email.** Optional in development: leave `EMAIL_USER`/`EMAIL_PASS` empty and OTP codes print in the terminal.

Then:

```bash
npm run db:migrate          # creates the tables
npm run db:seed             # adds the 6 built-in workflow templates
npm run dev                 # http://localhost:3000
npm run dev:clean           # same, after wiping .next/dev (use if the browser ever reload-loops)
```

Optional, in a second terminal: `npm run inngest:dev` starts the Inngest dev server (dashboard at http://localhost:8288). Without it, background jobs run inline so nothing breaks.

## Google Sheets chat setup

1. [console.cloud.google.com](https://console.cloud.google.com) → create a project called **Loopify**.
2. **APIs & Services → Library**: enable **Google Sheets API** and **Google Drive API**.
3. **OAuth consent screen**:
   - Team on Google Workspace (your own domain): choose **Internal**. No Google review needed.
   - Personal Gmail accounts: choose **External**, keep it in **Testing**, and add each person under **Test users** (up to 100). In testing mode, connections expire every 7 days.
4. Scopes: `.../auth/spreadsheets` and `.../auth/drive.readonly`, plus `openid` and `email`.
5. **Credentials → Create credentials → OAuth client ID → Web application.** Authorised redirect URIs:
   - `http://localhost:3000/api/integrations/google/callback`
   - `https://<your-staging-domain>/api/integrations/google/callback`
6. Put the client ID and secret into `.env`, then connect from **Settings → Connectors** in the app.

## Email (Gmail SMTP)

`EMAIL_USER` is the Gmail address. `EMAIL_PASS` must be an **App Password**: Google Account → Security → turn on 2-Step Verification → App passwords → create one for "Loopify".

## Deploying the free staging environment

- **Vercel (Hobby)**: import the repo, add every variable from `.env`, set `APP_URL` and `GOOGLE_REDIRECT_URI` to the Vercel domain. The build runs `prisma generate` through `postinstall`. Run `npm run db:deploy` against Neon from your machine before the first deploy.
- **Inngest**: create a free app at [inngest.com](https://www.inngest.com), add `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` to Vercel, then sync `https://<domain>/api/inngest` in the Inngest dashboard.
- Vercel Hobby is for non-commercial use. Fine for staging; move to Pro or another host before the company relies on it daily.

## Mobile API

```http
POST /api/v1/auth/token        { "email", "password" } → { token, user }
GET  /api/v1/me                Authorization: Bearer <token>
GET  /api/v1/day/today
POST /api/v1/day/plan          { "cardId" }
POST /api/v1/day/rollover      { "itemIds"?: [] }
POST /api/v1/day/close         { "planId" }
POST /api/v1/captures          { "text", "source": "MOBILE" }
GET  /api/v1/cards/mine
POST /api/v1/cards/{cardId}/move   { "columnId", "beforeId"?, "afterId"? }
POST /api/v1/cards/{cardId}/done   { "done": true }
```

Full spec: `GET /api/v1/openapi.json`. Generate a typed client in the Expo app with `npx openapi-typescript http://localhost:3000/api/v1/openapi.json -o src/api/schema.d.ts`. To expose another procedure over REST, add `.meta({ openapi: { method, path, protect: true } })` and an `.output()` schema to it.

## Project structure

```
prisma/
  schema.prisma            data model (every tenant table has orgId)
  seed.ts                  built-in workflow templates
src/
  app/
    (auth)/                sign-in, sign-up, verify-email, forgot/reset password
    (app)/                 signed-in app: today, capture, sheets, reports, boards, teams, templates, settings
    onboarding/, invite/   org creation and invite acceptance
    api/
      auth/[...nextauth]/  NextAuth
      trpc/[trpc]/         tRPC for the web app
      v1/[...path]/        REST for mobile (generated from tRPC)
      inngest/             background job endpoint
      integrations/google/ OAuth connect + callback
  components/
    ui/                    shadcn components (the foundation, extend with variants, never fork)
    app/ board/ today/ capture/ sheets/ reports/ teams/ templates/ settings/ auth/ common/ brand/
  lib/                     client-safe helpers (dates, slug, trpc client, workflow presets, confetti)
  server/
    trpc/                  init (context, procedures, roles), root router, routers/*
    services/              business logic: events log, cards, day plans, capture, boards
    ai/                    provider interface + OpenAI-compatible adapter (Grok)
    google/                OAuth and Sheets tools
    inngest/               client, functions, dispatch (inline fallback in dev)
    auth/ mail/            NextAuth config, passwords, OTP codes, email templates
  proxy.ts                 optimistic auth redirects (Next 16's renamed middleware)
```

## How the daily loop works

- Every card change appends a row to `CardEvent`. Yesterday's recap, reports, card history and streaks are all read from that log.
- A `DayPlan` is one person's day in their own time zone: the cards they planned, a diary note, a mood, and the end-of-day summary.
- On the next visit, planned cards that aren't done show up in the rollover tray. Rolling them over links the new item to the old one and bumps the card's `rolloverCount`. Three or more roll-overs mark a card as stuck.
- Closing the day queues an Inngest job that writes a standup-style summary. An hourly sweep writes one at 11 pm for anyone who forgot.

## Insights, calendar and platform admin

- **Dashboard** (`/dashboard`): KPIs, a GitHub-style consistency heatmap (every card event is a contribution), 30-day trend, workload, focus by board, work rhythm, deadlines and recent activity. Managers also get "Top finishers" and "Might need a hand".
- **Calendar** (`/calendar`): due, finished and overdue cards per day, with each day's plan progress.
- **People reports** (`/reports/people/:userId`): the same insights plus calendar for any member. Managers and above only; diaries stay private.
- **My board** (`/my-board`): everyone's private Kanban board, visible only to its owner (managers and admins included, in boards, search and reports). Team cards can be **mirrored** onto it (a live link: drop it in Done and the team card is done; finish the team card anywhere and the mirror moves to Done) or **duplicated** (an independent personal copy). "Mirror my team tasks" pulls in everything assigned to you, and "Auto-mirror new assignments" keeps doing it.
- **Platform admin** (`/admin`): cross-tenant console for orgs and users (suspend/restore, grant admin). Bootstrap the first admin with `PLATFORM_ADMIN_EMAILS="you@company.com"` in `.env`, then grant others from the Users tab.

## Conventions

- File names are kebab-case.
- UI is built only from `src/components/ui` (shadcn). New looks are added as variants on those components (see `highlight` on Button and Badge).
- Small UI icons come from `@tabler/icons-react`. Icons that carry emphasis (stat tiles, empty states, error pages, landing) use the animated set in `src/components/brand/animated-icons.tsx`.
- Brand colour is Bumble yellow (`bg-primary`, ink `text-primary-foreground`). For yellow *text or icons* use `text-brand`, never `text-primary` (unreadable on white). Chart series use `--chart-1..5` in order.
- Every user action gets a Sonner toast; errors use the server's message via `errorMessage()`.
- Motion respects `prefers-reduced-motion`.
- Every query inside an org-scoped procedure filters by `ctx.org.id`.
