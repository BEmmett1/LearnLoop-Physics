# BOOTSTRAP_DB.md

This guide bootstraps the LearnLoop Physics database in Supabase for local/dev use.

## Purpose

Set up schema, security policies, and starter content so the app can run end-to-end:

- Auth + user progress initialization
- Topics, micro-skills, questions
- Dashboard and learning flow data dependencies

---

## Prerequisites

1. A Supabase project (cloud or local).
2. Environment variables set in `.env.local` (or `.env`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

3. Node dependencies installed:

```bash
npm install
```

---

## Migration Files (Apply In Order)

Run these SQL files in Supabase SQL Editor, top to bottom:

1. `supabase/migrations/001_init.sql`
2. `supabase/migrations/002_user_progress.sql`
3. `supabase/migrations/003_init_user_progress_fn.sql`
4. `supabase/migrations/004_tutor_features.sql`
5. `supabase/migrations/005_init_user_progress_guard.sql`
6. `supabase/migrations/006_harden_init_user_progress.sql`

Important:

- Apply each migration once.
- Never edit already-applied migrations.
- Add new changes in a new numbered migration file.

---

## Seed Content Data

Seed topics, micro-skills, and questions from `content/physics/*.json`:

```bash
npm run seed
```

This script upserts into:

- `topics`
- `micro_skills`
- `questions`

---

## Verify DB Health

Run verification checks:

```bash
npm run verify:db
```

Expected checks:

- Content tables exist and contain rows:
  - `topics`
  - `micro_skills`
  - `questions`
- Progress tables exist and are readable:
  - `learner_profile`
  - `mastery`
  - `attempts`
  - `sessions`

Note: `verify:db` intentionally skips direct `init_user_progress` execution because it requires authenticated user context (`auth.uid()`).

---

## App-Level Smoke Check

1. Start app:
```bash
npm run dev
```

2. Sign up / log in at `/login`.
3. Visit `/dev/smoke`.

Expected result: `init_user_progress` executes successfully for the authenticated user.

---

## Troubleshooting

### Missing env var errors
Ensure all required Supabase env vars are present and non-empty.

### RLS permission errors
Confirm migrations `002`, `005`, and `006` are applied and you are authenticated when hitting protected routes.

### No questions shown in a topic
Re-run `npm run seed` and verify `questions.topic_id` values match `topics.id`.

### PowerShell script policy blocks npm
If PowerShell blocks `npm`, use:

```bash
npm.cmd run seed
npm.cmd run verify:db
npm.cmd run dev
```

---

## Quick Bootstrap Checklist

- [ ] Apply migrations `001` through `006` in order
- [ ] Set `.env.local` with Supabase URL/keys
- [ ] Run `npm run seed`
- [ ] Run `npm run verify:db`
- [ ] Sign in and validate `/dev/smoke`
