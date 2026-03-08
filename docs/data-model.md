# Data Model

## Tables

### users
Managed by Supabase Auth.

---

### learner_profile
- user_id (FK)
- selected_goal
- preferred_pace
- created_at

---

### topics
- id
- name
- prerequisite_topic_ids

---

### questions
- id
- topic_id
- prompt
- type (MCQ, NUMERIC, SETUP, EXPLAIN)
- correct_answer
- canonical_solution
- difficulty (1–3)
- micro_skill_ids (array)

---

### attempts
- id
- user_id
- question_id
- correct
- response
- seconds_spent
- hints_used
- misconception_tag
- created_at

---

### mastery
- user_id
- micro_skill_id
- mastery_score (0.0–1.0)
- updated_at

---

### sessions
- id
- user_id
- started_at
- ended_at

---

## Security
- Row Level Security enabled on all user tables
- Users can only access their own data
