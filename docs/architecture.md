# System Architecture

## High-Level Overview
The application follows a client-server architecture with AI-assisted feedback.

---

## Components

### Frontend
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui

Responsibilities:
- Render lessons and questions
- Collect user responses
- Display progress and feedback

---

### Backend
- Next.js API routes

Responsibilities:
- Serve questions
- Process attempts
- Update mastery
- Enforce business logic

---

### Database
- Supabase (PostgreSQL)
- Row Level Security (RLS)

Responsibilities:
- Store users, questions, attempts, mastery
- Enforce per-user data isolation

---

### AI Layer
- OpenAI API

Responsibilities:
- Explain-it-back feedback
- Hint generation
- Explanation rewriting

Constraints:
- AI responses must reference canonical solutions
- AI cannot generate authoritative new physics content in MVP

---

## Data Flow
1. User submits answer
2. Backend evaluates correctness
3. Mastery is updated
4. Feedback is generated (AI if applicable)
5. Next question is selected adaptively