# Gofer Outreach — Internal Sales Tool

A Saleshandy-style internal outreach MVP for Gofer sales users. Send cold email sequences through Gmail API, detect replies, and manage follow-ups automatically.

## Stack

- **Next.js 15+** App Router, TypeScript, Tailwind CSS (MD3 design tokens)
- **Supabase Auth** — user login
- **Supabase Postgres** + **Prisma** — data layer
- **Gmail API** — outbound email from connected Google Workspace mailboxes

## Prerequisites

- Node.js 20+
- Supabase project (Auth + Postgres)
- Google Cloud OAuth credentials (Internal app for Workspace)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase Postgres connection string (pooler) |
| `DIRECT_URL` | Supabase direct connection (for migrations) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service role key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3000/api/auth/google/callback` |
| `APP_URL` | `http://localhost:3000` |
| `CRON_SECRET` | Random secret for job endpoints |
| `TOKEN_ENCRYPTION_KEY` | 32-byte hex (64 chars) for encrypting Gmail tokens |

Generate encryption key:

```bash
openssl rand -hex 32
```

### 3. Database migration

```bash
npx prisma migrate dev --name init
```

### 4. Supabase Auth

1. **Authentication → Providers → Email** — enable email sign-in and sign-up
2. **Authentication → Providers → Google** — enable and paste your Google OAuth Client ID + Secret (same Google Cloud project as Gmail is fine)
3. **Authentication → URL Configuration** — add redirect URL:
   - `http://localhost:3000/auth/callback` (local)
   - `https://your-domain.com/auth/callback` (production)

Users can **sign up / sign in** with email+password or **Sign in with Google** on `/login`.

### 5. Google OAuth (Gmail sending — separate from login)

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable **Gmail API**
3. Configure OAuth consent screen (Internal for Workspace)
4. Create OAuth 2.0 credentials (Web application)
5. Add the exact local callback URL shown on the Mailboxes page (for example, `http://localhost:3000/api/auth/google/callback`). It must match the port used by the running app. (Gmail mailbox connection only)
6. Scopes: `gmail.send`, `gmail.readonly`, `email`, `profile`, `openid`

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## First-use flow

1. **Login** at `/login` with Supabase credentials
2. **Connect Gmail** at `/dashboard/mailboxes`
3. **Add leads** at `/dashboard/prospects`
4. **Create campaign** at `/dashboard/campaigns/new` with sequence steps
5. **Activate campaign** on the campaign detail page
6. **Trigger jobs** (or wait for cron):

```bash
curl -X POST http://localhost:3000/api/jobs/process-send-queue \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

curl -X POST http://localhost:3000/api/jobs/check-replies \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Cron schedule (production)

| Endpoint | Frequency | Purpose |
|----------|-----------|---------|
| `/api/jobs/process-send-queue` | Every 5 min | Send due emails |
| `/api/jobs/check-replies` | Every 10 min | Detect replies |

`vercel.json` includes Vercel Cron config. Set `CRON_SECRET` in Vercel env vars.

## Features

- Supabase Auth login
- Gmail OAuth per sales user (encrypted token storage)
- Prospect management (manual add; CSV schema ready)
- Campaign + multi-step sequences with merge tags
- Gmail API sending (threaded follow-ups)
- Send queue with daily mailbox limits (default 20/day)
- Reply detection via Gmail polling
- Suppression list (manual + unsubscribe replies)
- Dashboard analytics and in-app notifications

## Project structure

```
app/
  login/                  # Auth page
  dashboard/              # Main app (sidebar layout)
  api/
    auth/google/          # Gmail OAuth
    campaigns/            # Campaign CRUD
    prospects/            # Prospect CRUD
    mailboxes/            # Mailbox settings
    suppression/          # Suppression list
    jobs/                 # Cron: send queue + reply checker
lib/
  gmail/                  # OAuth, send, thread detection
  email/render-template.ts
  jobs/                   # Queue processor, reply checker
  campaigns/activate.ts   # Campaign activation logic
prisma/schema.prisma      # 11-table schema
```

## Security notes

- Gmail tokens encrypted at rest with AES-256-GCM
- Job endpoints require `Authorization: Bearer CRON_SECRET`
- All data scoped to authenticated user
- Google OAuth CSRF state cookie
- Never send to suppressed emails

## Out of scope (MVP)

- CSV upload UI
- Resend notifications (use in-app `AppNotification` table)
- Gmail push webhooks (polling only)
- Open/click tracking
