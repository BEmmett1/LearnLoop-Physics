# System Architecture

## High-Level Overview
The application uses a Next.js App Router architecture with server-rendered pages,
server actions for submissions, Supabase for storage/auth, and an AI feedback layer
for explain-it-back flows.

---

## Components

### Frontend
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui

Responsibilities:
- Render diagnostic, dashboard, and learn experiences.
- Collect learner responses.
- Display progress, correctness feedback, and error messaging.

---

### Backend
- Next.js server actions and server components.

Responsibilities:
- Validate submission payloads.
- Grade objective response types.
- Persist attempts and session state.
- Update mastery and enforce route gating rules.

---

### Database
- Supabase (PostgreSQL)
- Row Level Security (RLS)

Responsibilities:
- Store users, sessions, attempts, questions, and mastery.
- Enforce per-user data isolation.
- Initialize per-user progress (`init_user_progress`).

---

### AI Layer
- OpenAI API (pending wiring in current code).

Intended responsibilities:
- Explain-it-back feedback generation (`EXPLAIN` type).

Constraints:
- Feedback must be grounded in each question's `canonical_solution`.
- AI cannot invent authoritative new physics content in MVP.
- Service failures must degrade gracefully to deterministic fallback feedback.

---

## Data Flow

### Learn / Diagnostic (Objective Types Implemented)
1. User submits answer (`MCQ` or `NUMERIC`).
2. Server validates session/topic/question consistency.
3. Server grades correctness.
4. Attempt row is persisted.
5. Mastery updates are applied per linked micro-skill.
6. User is redirected with correctness/error state.

### Upcoming Flow (`SETUP` and `EXPLAIN`)
1. User submits free-text response.
2. Server validates payload and question type.
3. Server evaluates response (rule-based and/or AI-assisted per contract).
4. Attempt row stores structured evaluation payload.
5. Mastery updates and user feedback are returned.

---

## Source Of Truth
- Behavior and formulas: `docs/algorithms.md`.
- Runtime status and ordering of upcoming work: `docs/roadmap/ROADMAP.md`.
- Submission and AI contracts for pending types: `docs/IMPLEMENTATION_CONTRACTS.md`.
