import type {Store,Options,ClientRateLimitInfo,IncrementResponse} from 'express-rate-limit';
import {createHash} from 'node:crypto';
import {pool} from './db.js';

// Counters shared through PostgreSQL, so a limit holds across every API replica and survives restarts.
// Keys are hashed before storage (they contain IP addresses and email hashes). If the database cannot be reached the limiter falls back
// to a per-process counter instead of failing open or taking the route down.
const withTimeout = <T>(work: Promise<T>, ms: number) => Promise.race([work, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('rate-limit query timed out')), ms).unref())]);

export class PgStore implements Store {
  localKeys = false;
  private windowMs = 60000;
  private fallback = new Map<string, {hits: number; resetAt: number}>();
  constructor(private ns: string) {}
  init(options: Options) { this.windowMs = options.windowMs; }
  private id(key: string) { return createHash('sha256').update(`${this.ns}:${key}`).digest('hex'); }
  // After a failure the database is skipped for a few seconds, and every query is capped at 1.5 s, so an unhealthy store never slows unrelated requests.
  private downUntil = 0;
  async increment(key: string): Promise<IncrementResponse> {
    try {
      if (Date.now() < this.downUntil) throw new Error('rate-limit store paused after a failure');
      const {rows} = await withTimeout(pool.query<{hits: number; resetAt: Date}>(
        `INSERT INTO "RateLimitHit" (key,hits,"resetAt") VALUES ($1,1,NOW()+($2::int * INTERVAL '1 millisecond'))
         ON CONFLICT (key) DO UPDATE SET
           hits=CASE WHEN "RateLimitHit"."resetAt"<=NOW() THEN 1 ELSE "RateLimitHit".hits+1 END,
           "resetAt"=CASE WHEN "RateLimitHit"."resetAt"<=NOW() THEN EXCLUDED."resetAt" ELSE "RateLimitHit"."resetAt" END
         RETURNING hits,"resetAt"`, [this.id(key), this.windowMs]), 1500);
      return {totalHits: rows[0].hits, resetTime: rows[0].resetAt};
    } catch (error) {
      if (Date.now() >= this.downUntil) console.error('Rate-limit store unavailable, using a local counter:', error instanceof Error ? error.message : error);
      this.downUntil = Math.max(this.downUntil, Date.now() + 5000);
      const now = Date.now(), entry = this.fallback.get(key);
      const next = !entry || entry.resetAt <= now ? {hits: 1, resetAt: now + this.windowMs} : {hits: entry.hits + 1, resetAt: entry.resetAt};
      this.fallback.set(key, next);
      if (this.fallback.size > 10000) for (const [k, v] of this.fallback) if (v.resetAt <= now) this.fallback.delete(k);
      return {totalHits: next.hits, resetTime: new Date(next.resetAt)};
    }
  }
  async decrement(key: string) {
    await pool.query('UPDATE "RateLimitHit" SET hits=GREATEST(hits-1,0) WHERE key=$1', [this.id(key)]).catch(() => undefined);
  }
  async resetKey(key: string) {
    await pool.query('DELETE FROM "RateLimitHit" WHERE key=$1', [this.id(key)]).catch(() => undefined);
  }
  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const {rows} = await pool.query<{hits: number; resetAt: Date}>('SELECT hits,"resetAt" FROM "RateLimitHit" WHERE key=$1 AND "resetAt">NOW()', [this.id(key)]).catch(() => ({rows: []}));
    return rows[0] ? {totalHits: rows[0].hits, resetTime: rows[0].resetAt} : undefined;
  }
}

// Expired counters are removed every ten minutes by whichever process is running.
setInterval(() => { void pool.query('DELETE FROM "RateLimitHit" WHERE "resetAt"<NOW()').catch(() => undefined); }, 10 * 60000).unref();
