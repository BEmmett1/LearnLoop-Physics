# Requirements Specification

## Project Overview
This project is an AI-powered adaptive learning platform for **High School Physics (algebra-based)**.
The MVP focuses on **1D Kinematics**, helping students develop conceptual understanding and problem-solving skills through personalized practice.

---

## Target Users
- High school students (grades 9-12)
- First-time physics learners
- Students preparing for exams or remediation

---

## Functional Requirements
The system shall:
1. Allow users to sign up, log in, and log out.
2. Allow users to select a learning goal (High School Physics -> Motion).
3. Administer an adaptive diagnostic assessment.
4. Track mastery per micro-skill.
5. Serve adaptive lessons based on mastery.
6. Accept multiple question types:
   - Multiple choice
   - Numeric answers (with tolerance)
   - Short setup responses
   - Explain-it-back responses
7. Provide immediate feedback on answers.
8. Display progress and milestones.
9. Store user progress securely.

---

## Non-Functional Requirements
- Page load and question response time < 1 second.
- Mobile and desktop compatibility.
- User data isolation and privacy.
- AI feedback must be grounded in canonical solutions.
- System must support at least 100 concurrent users.

---

## MVP Non-Goals
- Calculus-based physics.
- Full symbolic algebra parsing.
- Multiplayer or competitive modes.
- Teacher dashboards (future feature).

---

## MVP Completion Criteria
- A student can complete onboarding and a diagnostic.
- The system adapts questions based on performance.
- Progress updates correctly after each session.
- A student can reach a defined learning milestone.

---

## Implementation Status Notes (As Of 2026-03-11)

### Shipped
- Onboarding diagnostic flow with `MCQ` + `NUMERIC`.
- Diagnostic completion gating for learn routes.
- Learn-mode submissions for `MCQ` + `NUMERIC`.
- Attempt persistence + mastery updates for implemented types.
- Topic progress and unlock behavior in dashboard/learn flow.

### Pending
- `SETUP` submission handling in learn and diagnostic flows.
- `EXPLAIN` submission handling in learn and diagnostic flows.
- OpenAI-backed explain-it-back feedback wiring.
- Browser E2E coverage for auth -> diagnostic -> dashboard -> learn.
- Error-state UX polish for user-facing failures.

### Source Of Truth
- Planning and status: `docs/roadmap/ROADMAP.md`.
- Runtime mastery and question-selection behavior: `docs/algorithms.md`.
- Data and system boundaries: `docs/data-model.md` and `docs/architecture.md`.
