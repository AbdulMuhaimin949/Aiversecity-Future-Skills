// Enables the PostgreSQL extensions the schema depends on (pgvector), before
// drizzle-kit pushes the schema. Safe to run repeatedly. Used by the `push`
// scripts against the development database only.
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set; ensure the database is provisioned.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query("CREATE EXTENSION IF NOT EXISTS vector");
  const { rows } = await client.query(
    "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
  );
  console.log(`pgvector enabled (version ${rows[0]?.extversion ?? "unknown"})`);
} catch (err) {
  console.error(`Could not enable pgvector: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
