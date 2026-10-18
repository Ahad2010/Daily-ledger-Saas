# Daily Ledger: Security, Database, API & Payment Audit

Audit date: 2026-10-18. Branch: `claude/happy-dirac-8ypg6s`. Scope: the code in this repository only. No application code was changed during the audit.

**How to read statuses.** *Verified* means I read the code and/or ran it locally. *Assumed* means it depends on production configuration I cannot see (Railway, Vercel, Resend, Postgres hosting). *Manual* means a human must check it in a dashboard. No secret values appear in this report.

---

## A. Executive Summary

Daily Ledger's authentication, tenant isolation and quota enforcement are in good shape. Payments are **not built**. The code is sound for a pre-launch product, but it is not ready to take money.

**What is strong (verified):**
- No cross-tenant access found. Every data query is scoped by the session user. No mass-assignment paths.
- Admin is a single locked-down account. Every `/api/admin` route runs `requireAdmin` with row-locked rechecks, and actions are written to `AdminAudit`.
- CSRF (Origin allow-list plus a timing-safe token), CORS (exact origins), helmet headers, body size cap (200 KB gives 413), login throttling (5 failures then 429).
- Password reset: hashed single-use tokens, 5-minute expiry, sessions revoked on reset. Identical response and timing for known and unknown emails.
- Plan and quota limits are enforced on the server under row locks. A Free user cannot reach AI or Pro-only record kinds (403 `UPGRADE_REQUIRED`).
- Git history scanned for secrets: 0 hits. Only `.env.example` placeholders are tracked.

**What blocks launch:**
1. **Payments are not implemented.** There is no Whop checkout, no webhook, no signature verification, no idempotency, no `BillingRecord` writes. `POST /api/billing/checkout` returns 503 in production and grants nothing. Today nobody can buy a plan.
2. **Operations baseline is missing.** No database backups or restore test, no error monitoring or uptime alerts, no CI, no dependency scanning (all listed as pending in `STATUS.md`).
3. **Production settings are unenforced.** Secure cookies and the HTTPS origin check depend on `NODE_ENV=production`. The proxy hop count defaults to 1 while the docs say 2. Nothing fails fast if either is wrong.
4. **Admin has no second factor.** The owner chose to skip 2FA. This is accepted risk and is recorded as such.

**Counts:** 0 Critical, 0 High exploitable in application code, 8 Medium, 10 Low, 7 Informational. One launch-blocking gap (payments). Four `npm audit` highs sit in the Prisma CLI chain and are deploy-time only (see D-14).

**Launch decision: NO-GO for taking payments today. CONDITIONAL GO for a free/demo launch** once the P0 items in Section F are done.

---

## B. Architecture Summary

| Layer | What it is | Notes |
|---|---|---|
| `apps/web` | Next 16 App Router. `NEXT_PUBLIC_DATA_MODE=demo` (localStorage) or `api` | Only `NEXT_PUBLIC_DATA_MODE` and `NEXT_PUBLIC_API_URL` are public. Vercel build throws unless api/https/`/backend`. |
| `apps/admin` | Thin wrapper over the web app on its own Vercel project | Shares the same API and database. |
| `apps/api` | Express 5, Prisma 7, Postgres via `@prisma/adapter-pg` | One pool, `max=15`. Polymorphic JSONB `Record` table with a kind check constraint. |
| `packages/shared` | Zod schemas, plans, quotas | Single source of truth for limits. Used by both client and server. |
| Worker | Railway cron every 5 minutes (`railway.worker.json`) | Reminder emails, notifications. |
| Email | Resend | OTP, reset link, welcome, reminders. Branded template in `email-template.ts`. |
| AI | Groq-compatible chat endpoint | Pro/Lifetime only, quota counted per month. |
| Payments | **Whop planned, not built** | `@whop/sdk` is listed in `apps/api/package.json` but imported nowhere. |

**Auth.** scrypt passwords, session cookie `ledger.sid` (connect-pg-simple, httpOnly, SameSite=Lax, 7 days, host-only, Secure only when `NODE_ENV=production`). Google OAuth via passport with `state:true` and verified-email linking. Signup by emailed OTP (5 minutes, 5 attempts, 45 s resend cooldown, tied to the session).

**Plans.** Free (3 tasks, 2 habits, 1 goal, 30 transactions, no AI, no finance-Pro pages), Pro $20, Lifetime $100. A 7-day no-card Pro trial exists once per account (`TRIAL_MODE`, default on).

**Deployment.** Railway runs the API (`preDeploy: npm run db:migrate`, healthcheck `/ready`, `numReplicas: 1`) and the worker. Two Vercel projects proxy `/backend` to the API (`API_INTERNAL_URL`, `TRUST_PROXY_HOPS=2`).

---

## C. Security Scorecard

| Area | Status | Basis |
|---|---|---|
| Authentication (password, OTP, reset, Google) | **PASS WITH FIXES** | Strong flow. Weak scrypt parameters, signup enumeration, OTP window reset (D-06, D-07, D-08). |
| Session management | **PASS WITH FIXES** | httpOnly, SameSite, 7 days, revoked on reset. Secure flag depends on `NODE_ENV` (D-03). |
| Authorization / tenant isolation | **PASS** | No cross-tenant path found. Minor items only (D-17, D-18, D-19). |
| Admin access control | **PASS WITH FIXES** | Correct server checks. No MFA (accepted). Origin not pinned (D-12). |
| CSRF / CORS | **PASS** | Verified live: evil origin gets 403 on POST and no ACAO header. |
| Input validation | **PASS WITH FIXES** | Zod everywhere. Validation errors leak regex and paths (D-13). |
| Security headers: API | **PASS** | helmet, CSP, HSTS 31536000, nosniff, COOP/CORP, referrer-policy. |
| Security headers: web/admin frontends | **FAIL** | No CSP or HSTS in `next.config.ts` (D-04). |
| Rate limiting / abuse | **PASS WITH FIXES** | Good on auth. Expensive reads rely on 180/min only (D-05). In-memory stores (D-02). |
| Database security | **PASS WITH FIXES** | Parameterised via Prisma, constraints in place. No RLS, no statement timeout (D-09, D-10). |
| Secrets management | **PASS** | History clean, env-only, startup throws without a 32+ char session secret. |
| Dependency security | **PASS WITH FIXES** | 4 highs in the Prisma CLI chain, deploy-time only (D-14). No scanning in CI. |
| Payment integration | **NOT IMPLEMENTED** | See D-01. |
| Entitlements / quotas | **PASS** | Atomic under row lock, server-enforced. Trial farming possible (D-11). |
| Webhook security | **NOT IMPLEMENTED** | No webhook route exists. |
| Logging / monitoring | **FAIL** | Console only, no error tracker, no alerts (D-15). |
| Backup / recovery | **FAIL** | Not in repo, listed as pending (D-16). |
| CI/CD | **FAIL** | No `.github` workflows, no Dependabot. |
| Privacy / data lifecycle | **PASS WITH FIXES** | No self-service account deletion (privacy page says contact the operator). |
| 2FA / MFA | **NOT IMPLEMENTED (owner decision)** | Skipped by owner. |

---

## D. Detailed Findings

Severity is my judgement of realistic impact on a public launch. "Verified" means seen in code and/or reproduced locally.

### D-01 Payments, webhooks and idempotency are not implemented
- **Severity:** High for launch (blocker, not an exploit)
- **Component:** Billing
- **Evidence (verified):** `POST /api/billing/checkout` returns 503 in production and grants nothing. No webhook route exists. `@whop/sdk` is in `apps/api/package.json` and imported nowhere. No `BillingRecord` writes.
- **Risk:** No revenue. When built, the highest-risk mistakes are an unsigned webhook, a missing replay window, granting a plan from the redirect page, and double-processing events.
- **Remediation:** Build per the Whop plan: checkout configuration with `metadata=userId`, webhook route using the raw body, Standard Webhooks signature check (`webhook-signature`, 5-minute tolerance), event-id idempotency table, plan granted only from verified webhooks, handle `membership.activated/deactivated`, `payment.failed`, `refund.created`, `dispute.created`. Mount the route before `express.json()` and make sure `maintenanceOpen` and CSRF treat it deliberately (see D-20).
- **Safe verification:** Whop sandbox (separate base URL), tampered-signature and replayed-event tests, a delivered-twice test asserting a single grant.

### D-02 Rate-limit stores are in memory
- **Severity:** Medium
- **Component:** `apps/api` limiters
- **Evidence (verified):** global 180/min, `loginLimit`, `loginAccountLimit` and `limiterFor()` all use the default memory store. `railway.api.json` pins `numReplicas: 1`.
- **Risk:** Safe only while there is one replica. Limits reset on every deploy or restart. Scaling out silently multiplies every limit.
- **Remediation:** Keep one replica for now and document it. Move to a Postgres- or Redis-backed store before scaling.
- **Safe verification:** Restart the API locally and confirm counters reset. Run two instances and confirm limits double.

### D-03 Production cookie and proxy settings are not enforced
- **Severity:** Medium
- **Component:** `server.ts`, deployment config
- **Evidence (verified in code, assumed in production):** the session cookie is `Secure` only when `NODE_ENV=production`. In local dev the cookie had no Secure flag. `TRUST_PROXY_HOPS` defaults to 1, the docs say 2 behind Vercel then Railway. No startup check for either.
- **Risk:** A wrong value means cookies without Secure, or login throttling keyed on the wrong IP (everyone shares one bucket, or an attacker spoofs `X-Forwarded-For`).
- **Remediation:** Fail startup in production unless `NODE_ENV=production` and `TRUST_PROXY_HOPS` is set. Add the planned Vercel-to-Railway shared-secret header so the API only trusts proxied requests.
- **Safe verification:** Manual: inspect the `Set-Cookie` header on the live site; confirm the throttle key uses the client IP from the access logs.

### D-04 No CSP or HSTS on the Next.js frontends
- **Severity:** Medium
- **Component:** `apps/web/next.config.ts`, `apps/admin`
- **Evidence (verified):** headers set are only nosniff, X-Frame-Options, referrer-policy and permissions-policy.
- **Risk:** No second line of defence against XSS on the pages that hold the session context. HSTS is probably added by Vercel for custom domains, but that is not in code.
- **Remediation:** Add a CSP (start in report-only), HSTS, and frame-ancestors. The admin app should be stricter than the web app.
- **Safe verification:** `curl -I` both frontends after deploy. Check the browser console for CSP violations.

### D-05 Expensive endpoints depend only on the global limiter
- **Severity:** Medium
- **Component:** `/api/snapshot`, `/api/export`, `/api/reports`, `/api/records`
- **Evidence (verified):** `server.ts:78` loads every record for the user and filters `q` in memory. Only the 180/min global limit applies. No request timeout.
- **Risk:** One heavy account can tie up the single API process. Cost grows with total rows (D-21).
- **Remediation:** Tighter per-user limits on these routes, move `q` search into SQL, add a server request timeout.
- **Safe verification:** Load test against a seeded account with large row counts on a staging copy.

### D-06 scrypt uses Node defaults
- **Severity:** Medium
- **Component:** `passwords.ts`
- **Evidence (verified):** N=16384, r=8, p=1, no stored parameters or version. Below the current OWASP recommendation.
- **Risk:** Faster offline cracking if the database leaks.
- **Remediation:** Raise cost (for example N=2^17), store parameters with each hash, and rehash on next login.
- **Safe verification:** Unit test that old hashes still verify and are upgraded.

### D-07 Signup discloses whether an email exists
- **Severity:** Low
- **Component:** `auth-otp.ts`, `password-auth.ts`
- **Evidence (verified):** signup returns 409 for an existing email.
- **Risk:** Account enumeration. Rate limits slow it but do not stop it.
- **Remediation:** Return the same response and send a "you already have an account" email instead.
- **Safe verification:** Compare responses and timing for known and unknown addresses.

### D-08 OTP attempt counter resets when the challenge expires
- **Severity:** Low
- **Component:** `auth-otp.ts`
- **Evidence (verified):** attempts carry over only while the challenge is unexpired. A new 5-minute window gives about 5 fresh guesses.
- **Risk:** Roughly 1% per week worst case against one email, with the 45 s cooldown and per-route limiter helping. The owner chose to skip a 24-hour cap.
- **Remediation (optional):** Add a 24-hour cap per email.
- **Safe verification:** Test that the 6th request across windows is refused.

### D-09 No row-level security; isolation is application-level only
- **Severity:** Low (design note)
- **Component:** Postgres
- **Evidence (verified):** every query filters by `userId`; no RLS policies exist.
- **Risk:** One missed filter in future code becomes a data leak. Current code is clean.
- **Remediation:** Keep a test that each route returns 404 for another user's id. RLS is optional hardening.

### D-10 No database statement or request timeouts
- **Severity:** Low
- **Component:** `db.ts`
- **Evidence (verified):** pool `max=15`, connection timeout 10 s, idle 30 s, no `statement_timeout`.
- **Risk:** A slow query can hold a connection indefinitely.
- **Remediation:** Set `statement_timeout` and `idle_in_transaction_session_timeout`.

### D-11 Trial farming through email aliases
- **Severity:** Medium
- **Component:** `User`, `billing.ts`
- **Evidence (verified):** `User.email` is not unique in `schema.prisma:10`; only trim and lowercase are applied. `name+1@gmail.com` and dotted Gmail variants count as new people.
- **Risk:** Unlimited free 7-day Pro trials and AI usage.
- **Remediation:** Normalise addresses for trial purposes, cap trials per IP or device, and apply a global AI spend cap (D-22).
- **Safe verification:** Create two aliases of one mailbox in a test environment.

### D-12 Customer origin is accepted on admin routes
- **Severity:** Low
- **Component:** CSRF and CORS (`server.ts`)
- **Evidence (verified):** `csrf` uses the combined allow-list, so the customer origin can call `/api/admin` and `/auth/admin`.
- **Risk:** Narrow. A session and token are still required.
- **Remediation:** Pin admin routes to the admin origin.

### D-13 Validation errors leak internals
- **Severity:** Low
- **Component:** Error handler
- **Evidence (verified live):** Zod `details` return the regex pattern and field path.
- **Remediation:** Return field names and messages only.

### D-14 Dependency vulnerabilities (`npm audit --omit=dev`)
- **Severity:** Low in practice (reported High)
- **Evidence (verified):** 4 highs, all through the `prisma` CLI chain: `deepmerge-ts` stack exhaustion (GHSA-ggr8-5vv4-36mx) and `mysql2` <=3.23 (GHSA-3f6p-5ww8-9rcr, GHSA-rgwj-5xj2-c3m3). A fix is available and has not been applied.
- **Risk:** CLI and deploy-time code; the app is Postgres-only and does not use mysql2 at runtime.
- **Remediation:** Update Prisma, rerun `npm audit`, rerun tests. Add this to CI.

### D-15 No logging, monitoring or alerting
- **Severity:** Medium
- **Evidence (verified):** 18 `console` calls, `ActivityEvent` (180 days) and `AdminAudit`. No Sentry, no structured logs, no uptime check.
- **Risk:** Production failures and attacks go unnoticed.
- **Remediation:** Add an error tracker, uptime monitor on `/ready`, and alerts on 5xx and login-failure spikes.

### D-16 No backup or restore process
- **Severity:** Medium
- **Evidence:** not in repo; `STATUS.md` lists it as pending. **Manual:** check the Postgres host's backup settings.
- **Remediation:** Enable automated backups, perform one real restore test, write the steps in `DEPLOYMENT.md`.

### D-17 Avatar URL pattern allows `..` segments
- **Severity:** Low
- **Component:** `avatar.ts:21`
- **Evidence (verified):** the segment charset includes `.`.
- **Remediation:** Reject `.` and `..` segments.

### D-18 Referral ranking exposes other paid users' names
- **Severity:** Low (privacy)
- **Component:** `referrals.ts:32-43`
- **Evidence (verified):** `name: row.name` returned.
- **Remediation:** Show initials or an opt-in display name.

### D-19 Trial can overwrite a still-valid admin "Free" override
- **Severity:** Low
- **Component:** `billing.ts:19-23`
- **Evidence (verified).** **Remediation:** Respect an active manual override.

### D-20 `maintenanceOpen` whitelists `/webhooks`
- **Severity:** Informational (becomes relevant with D-01)
- **Evidence (verified):** the regex exempts `/webhooks` from maintenance and CSRF. A future route there would bypass both. Make it deliberate and signature-only.

### D-21 No per-account total record cap
- **Severity:** Low. A Pro account can store unbounded rows, which worsens D-05.

### D-22 No global AI spend cap; provider failure burns user quota
- **Severity:** Medium
- **Evidence (verified):** quota is per user. A failed provider call still consumes quota and pending rows are never swept.
- **Remediation:** Global daily budget with a kill switch, refund on provider error, sweep stale pending rows.

### D-23 Minor items (Low / Informational)
- No `Cache-Control` on `/api/*`.
- `/health` exposes config booleans.
- `GET /auth/google` writes a session.
- AI usage lookups by request id do not include `userId`.
- `markNotification` version check is optional.
- Push endpoint upsert can reassign an endpoint between users.
- Admin reads are not audited.
- A user can cancel a manual-grant plan.
- Admin grants have no maximum expiry.
- No change-password-while-logged-in feature.
- Password policy is length 12 plus composition; no breached-password check.
- Docs (`README`, `IMPLEMENTATION.md`) still say reset links last one hour; the code uses 5 minutes.
- `.gitignore` lacks `.env.production` and `.env.*.local`.
- `compose.yaml` publishes Postgres 5432 on all interfaces with dev credentials (dev only).

### D-24 Test results: two intermittent failures, cause not determined
- **Evidence (verified):** In a combined run of the 39-test security subset, 37 passed and 2 failed: `integration.test.ts:41` (`400 !== 200` on reset-password with a valid token) and the OTP lockout assertion (`400 !== 429`). Both pass when run alone (integration 2/2, OTP 1/1).
- **Status:** **Unresolved.** I have not found the cause. Likely shared database state or timing between test files, but that is a guess. Needs a follow-up before this suite is used as a CI gate.

---

## E. Missing Protections Checklist

| Protection | In code? |
|---|---|
| Whop checkout, webhook, signature check, idempotency | **No** |
| Refund / dispute / failed-payment handling | **No** |
| CSP and HSTS on Next frontends | **No** |
| Admin MFA | **No (owner skipped)** |
| Shared (Redis/Postgres) rate-limit store | **No** |
| Production fail-fast on `NODE_ENV` / proxy hops | **No** |
| Vercel-to-Railway proxy secret header | **No (planned)** |
| Database backups and tested restore | **No** |
| Error monitoring, uptime checks, alerts | **No** |
| CI (tests, lint, `npm audit`), Dependabot | **No** |
| Row-level security | **No** |
| Statement timeouts, request timeouts | **No** |
| Account deletion / data export self-service | **No (export exists, deletion does not)** |
| Breached-password check | **No** |
| Global AI spend cap | **No** |
| Trial abuse controls beyond one per account | **No** |
| Change password while logged in | **No** |
| CSRF, CORS, helmet, body cap, login throttling | **Yes** |
| Hashed single-use reset tokens, session revocation | **Yes** |
| Tenant scoping, server-side plan and quota gates | **Yes** |
| Admin audit trail | **Yes** |

---

## F. Prioritized Remediation Roadmap

**P0: before any public launch**
1. Enforce production config at startup (`NODE_ENV`, `TRUST_PROXY_HOPS`) and add the proxy secret header (D-03).
2. Turn on database backups and do one restore test (D-16).
3. Add error monitoring and an uptime check on `/ready` (D-15).
4. Rotate every key that was ever pasted in chat or used locally: Groq, Resend, `SESSION_SECRET`, VAPID.

**P0: before taking payments**
5. Build the Whop integration with signature verification, replay window, idempotency and server-side grants (D-01, D-20).

**P1: first weeks**
6. CSP and HSTS on both frontends (D-04).
7. Tighter limits and timeouts on snapshot, export, reports, records; move `q` into SQL (D-05, D-10).
8. Trial and AI abuse controls: alias normalisation, global spend cap, refund quota on provider error (D-11, D-22).
9. CI with tests and `npm audit`; update Prisma (D-14). Fix the intermittent test failures first (D-24).
10. Raise scrypt cost with versioned hashes (D-06).

**P2: soon after**
11. Signup enumeration (D-07), pin admin to admin origin (D-12), trim Zod details (D-13), avatar `..` (D-17), referral names (D-18), trial vs admin override (D-19).
12. Self-service account deletion; change-password screen; fix reset-link docs.

**P3: when scaling**
13. Shared rate-limit store before more than one replica (D-02).
14. Optional OTP 24-hour cap (D-08), RLS (D-09), per-account record cap (D-21), breached-password check.

---

## G. Production Launch Decision

**NO-GO to charge customers now.** Payments do not exist.

**CONDITIONAL GO for a free or demo launch** once the P0 items (config enforcement, backups with a restore test, monitoring, key rotation) are done. The application layer is solid enough for that. The gaps are operational, not exploitable holes in the code.

**Unverified in this audit (manual checks):** live Railway and Vercel settings, DNS and Resend domain records, Postgres host backup and network rules, Google OAuth console settings, and actual production response headers. Nothing here was tested against a production deployment.

## Five most important next actions
1. Build the Whop checkout and webhook (signed, idempotent, server-granted). Test in the sandbox first.
2. Make production config fail-fast (`NODE_ENV=production`, `TRUST_PROXY_HOPS=2`) and add the Vercel-to-Railway secret header.
3. Turn on database backups, do a restore test, and add error monitoring plus an uptime alert.
4. Add CSP/HSTS to the frontends and tighten limits, timeouts and SQL search on the heavy endpoints.
5. Close abuse gaps: trial alias farming, a global AI spend cap, stronger scrypt, signup enumeration. Then add CI and investigate the two intermittent test failures.

No code was changed. Tell me which items to remediate and I will do them in that order.
