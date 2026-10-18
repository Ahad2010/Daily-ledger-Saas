// Removes one account (and everything it owns) from the LOCAL development database, so the same email can sign up again from scratch.
//   npm run dev:delete-user -- someone@example.com          shows what would be deleted
//   npm run dev:delete-user -- someone@example.com --yes    deletes it
// It only ever runs against localhost, never in production, and never touches the administrator account.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const args = process.argv.slice(2);
const email = args.find(a => !a.startsWith('--'))?.trim().toLowerCase();
const apply = args.includes('--yes');
const fail = message => { console.error(message); process.exit(1); };
if (!email || !email.includes('@')) fail('Usage: npm run dev:delete-user -- someone@example.com [--yes]');
if (process.env.NODE_ENV === 'production') fail('Refusing to run with NODE_ENV=production.');

// DATABASE_URL from the environment, else from apps/api/.env, else the project's usual local database.
function fromEnvFile() {
  try {
    const text = fs.readFileSync(path.resolve('apps/api/.env'), 'utf8');
    return text.split(/\r?\n/).map(l => l.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/)).find(Boolean)?.[1]?.replace(/^["']|["']$/g, '');
  } catch { return undefined; }
}
const url = process.env.DATABASE_URL || fromEnvFile() || 'postgresql://ledger@127.0.0.1:5439/postgres';
let host;
try { host = new URL(url).hostname; } catch { fail('DATABASE_URL is not a valid URL.'); }
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) fail(`Refusing to touch a database that is not on this computer (host "${host}"). This command is for local development only.`);

const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  const { rows: users } = await pool.query('SELECT id,email,name,plan,"createdAt" FROM "User" WHERE lower(email)=$1', [email]);
  const ids = users.map(u => u.id);
  const challenges = (await pool.query('SELECT count(*)::int AS n FROM "AuthChallenge" WHERE lower(email)=$1', [email])).rows[0].n;
  if (!users.length && !challenges) { console.log(`No account or pending sign-up found for ${email}.`); process.exit(0); }
  for (const u of users) console.log(`Account: ${u.email} (${u.name}), plan ${u.plan}, created ${new Date(u.createdAt).toISOString().slice(0, 10)}, id ${u.id}`);
  if (challenges) console.log(`Pending sign-up / reset codes for this email: ${challenges}`);
  if (ids.length && (await pool.query('SELECT 1 FROM "AdminAccess" WHERE "userId"=ANY($1)', [ids])).rowCount) fail('This is the administrator account. Transfer admin access first; it is not deleted here.');
  if (!apply) { console.log('\nNothing deleted yet. Add --yes to delete it.'); process.exit(0); }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Sessions are keyed by user id inside JSON, and a few tables hold the id or the email without a foreign key.
    const sessions = ids.length ? (await client.query("DELETE FROM session WHERE sess->'passport'->>'user'=ANY($1)", [ids])).rowCount : 0;
    if (ids.length) {
      await client.query('DELETE FROM "BillingRecord" WHERE "userId"=ANY($1)', [ids]);
      await client.query('DELETE FROM "ActivityEvent" WHERE "userId"=ANY($1)', [ids]);
    }
    await client.query('DELETE FROM "AuthChallenge" WHERE lower(email)=$1', [email]);
    // Records, credentials, jobs, referrals, AI history, tickets, push devices and overrides go with the user (ON DELETE CASCADE).
    const removed = ids.length ? (await client.query('DELETE FROM "User" WHERE id=ANY($1)', [ids])).rowCount : 0;
    await client.query('COMMIT');
    console.log(`\nDeleted ${removed} account(s), ${sessions} session(s) and all of their data. ${email} can sign up again.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
} catch (error) {
  if (error?.code === 'ECONNREFUSED') fail('The local database is not running. Start it first (node scripts/local-postgres.mjs, or npm run dev).');
  fail(`Could not delete: ${error?.message || error}`);
} finally {
  await pool.end().catch(() => undefined);
}
