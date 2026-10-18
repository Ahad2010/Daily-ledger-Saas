// Request counters now live in PostgreSQL and survive API restarts (by design). Each test file starts its own API, so it must also start with empty counters.
import pg from 'pg';
if (process.env.TEST_DATABASE_URL) {
  const pool = new pg.Pool({connectionString: process.env.TEST_DATABASE_URL, max: 1});
  try { await pool.query('DELETE FROM "RateLimitHit"'); } catch { /* table absent before migrations */ }
  await pool.end();
}
