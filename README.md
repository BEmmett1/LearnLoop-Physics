# LearnLoop Physics (MVP)

An adaptive learning app for high school physics (algebra-based), starting with 1D kinematics.
It personalizes practice with micro-skill mastery tracking and immediate feedback.

## Current Status

Implemented today:

- Email/password signup, login, logout (Supabase Auth)
- Protected dashboard with topic unlock logic
- Topic progress based on micro-skill mastery averages
- Learn flow for `MCQ` and `NUMERIC` questions
- Attempt recording and mastery updates after submissions
- End-to-end onboarding diagnostic flow (`/diagnostic`) with 15 mixed `MCQ` + `NUMERIC` questions
- Diagnostic session persistence and completion gating before lesson access
- Difficulty-scaled mastery updates during diagnostic submissions
- Supabase migrations with RLS and `init_user_progress` RPC
- Seeded content for physics topics, micro-skills, and questions

Planned / not fully implemented yet:

- `SETUP` and `EXPLAIN` submission handling
- Browser E2E automation
- AI explain-it-back feedback wiring

## Tech Stack

- Next.js + TypeScript
- Supabase (Auth + Postgres + RLS)
- OpenAI API (planned for explain-it-back feedback)
- Vercel deployment target

## Repository Docs

See [`docs/`](docs) for architecture, requirements, data model, SDLC, and DB/bootstrap guidance.

## Local Setup

1. Install dependencies

```bash
npm install
```

2. Create `.env.local` and set required variables

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

3. Seed DB content (after applying migrations)

```bash
npm run seed
```

4. Verify DB structure and seed health

```bash
npm run verify:db
```

5. Run the app

```bash
npm run dev
```

## Scripts

- `npm run dev` starts the Next.js dev server
- `npm run build` creates a production build
- `npm run start` serves the production build
- `npm run seed` seeds topics/micro-skills/questions
- `npm run verify:db` verifies required DB tables and seeded data
- `npm run test` runs tests once
- `npm run test:watch` runs tests in watch mode
- `npm run test:coverage` runs tests with coverage output

## CI Environment Variables

Set these repository secrets in GitHub for CI builds:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

These are required because `npm run build` evaluates app code paths that depend on Supabase configuration.

## Testing

Current baseline coverage:

- Unit tests for pure grading/mastery logic
- Unit tests for diagnostic selection and difficulty-scaled mastery updates
- Server-action integration-style tests with mocked Supabase + redirect behavior (learn + diagnostic)
- No live Supabase credentials required for test execution

Deferred to next phase:

- Browser E2E tests (Playwright)
- End-to-end coverage for full auth-to-learning user journeys
- Tests for future `SETUP` and `EXPLAIN` submission flows


### E2E Environment Variables

For Playwright core-journey coverage, set:
- E2E_USER_EMAIL
- E2E_USER_PASSWORD
- E2E_BASE_URL (optional, defaults to http://127.0.0.1:3000)


