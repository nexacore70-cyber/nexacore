# P3006 migration-history diagnosis (NO database changes in this ZIP)

Your `20261115140451_google` migration tries to ALTER `hiring_requests` before `20261115180000_hiring_requests` creates that table. Shadow-database replay fails with 42P01. `prisma migrate status` saying up to date does not establish that replay succeeds.

1. Back up PostgreSQL and the entire `prisma/migrations` folder.
2. Inspect the two migration.sql files, any other migrations that depend on these tables, and the recorded checksums in `_prisma_migrations`.
3. Reconcile migration history with an environment-specific plan. Do not edit already-applied SQL blindly or use `migrate reset`, `db push`, or `migrate resolve` to conceal the problem.
4. Only after the shadow replay is repaired, run `npx prisma migrate dev --name add_tutor_subject_selection` if the table is absent and schema includes the model.
5. Run `npx prisma generate` after migrations and restart the backend.

This ZIP intentionally does NOT include an automatic migration repair or overwrite schema.prisma.
