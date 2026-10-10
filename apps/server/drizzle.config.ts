import { defineConfig } from 'drizzle-kit';

// drizzle-kit reads this file when `pnpm --filter @bajaovrlay/server db:generate` turns a
// change in the table definitions into a new SQL migration. The generated migrations in
// ./drizzle are committed; the server applies them at boot (src/core/db/openDatabase.ts).
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/core/db/tables.ts',
  out: './drizzle',
});
