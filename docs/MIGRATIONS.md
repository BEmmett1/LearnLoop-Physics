# Database Migrations

This project uses manual SQL migrations.

## Process
1. Create a new migration file in `supabase/migrations/`
2. Name it with a numeric prefix (e.g. `004_tutor_features.sql`)
3. Commit the file
4. Apply it via Supabase SQL editor
5. Never modify applied migrations

## Environments
- Local: Supabase local
- Shared: Supabase cloud (via SQL editor)