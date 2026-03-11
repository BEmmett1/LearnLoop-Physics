# Data Model

## Tables

### users
Managed by Supabase Auth.

---

### learner_profile
- user_id (FK)
- selected_goal
- preferred_pace_minutes
- created_at
- updated_at

---

### topics
- id
- name
- order
- prerequisite_topic_ids

---

### questions
- id
- topic_id
- type (MCQ, NUMERIC, SETUP, EXPLAIN)
- difficulty
- prompt
- choices
- correct_choice_index
- correct_answer_text
- numeric_answer
- numeric_tolerance
- canonical_solution
- micro_skill_ids (array)
- misconceptions
- hints

---

### attempts
- id
- user_id
- session_id
- question_id
- correct
- response
- seconds_spent
- hints_used
- misconception_tag
- created_at
- started_at_ms
- ended_at_ms
- careless

---

### mastery
- user_id
- micro_skill_id
- mastery_score (0.0-1.0)
- updated_at

---

### sessions
- id
- user_id
- started_at
- ended_at
- mode
---

## Security
- Row Level Security enabled on all user tables
- Users can only access their own data
