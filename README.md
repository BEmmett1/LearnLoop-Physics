# LearnLoop Physics (MVP)

An adaptive learning app for High School Physics (algebra-based), starting with 1D Kinematics.
It personalizes practice using micro-skill mastery, provides immediate feedback, and tracks progress to milestones.

## MVP Scope
- Sign up / login
- Diagnostic (15 questions)
- Adaptive lesson sessions
- Micro-skill mastery tracking
- Progress dashboard
- AI-assisted feedback for explain-it-back responses (grounded to canonical solutions)

## Tech Stack
- Next.js + TypeScript
- Supabase (Auth + Postgres + RLS)
- OpenAI API (feedback only in MVP)
- Vercel deployment

## Repo Docs
See `/docs` for requirements, architecture, algorithms, testing, and SDLC.

## Local Setup
1. Install dependencies
   - `npm install`
2. Copy env file
   - `cp .env.example .env.local`
3. Add your Supabase and OpenAI keys
4. Run dev server
   - `npm run dev`

## Scripts
- `npm run test` runs unit tests
