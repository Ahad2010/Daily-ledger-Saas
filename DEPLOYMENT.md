# Daily Ledger deployment

The frontend is configured for Vercel. The Express API, PostgreSQL and scheduled notification worker run on an external host such as Railway. No deployment or payment connection has been made.

## Go live: Railway (API + PostgreSQL + worker) and Vercel (app + admin)

One backend serves both frontends:

```text
app.YOUR-DOMAIN   (Vercel, apps/web)   --\
                                          >-- /backend rewrite --> api.YOUR-DOMAIN (Railway API) --> Railway PostgreSQL
admin.YOUR-DOMAIN (Vercel, apps/admin) --/                              ^
                                              Railway cron worker (every 5 min) ----+
```

Order matters: Railway first (you need the API URL), then Vercel, then go back to Railway to set the two origins.

**1. Railway project**
1. New project, then **Add PostgreSQL**. Keep it on Railway's private network (no public access needed).
2. **New service from this GitHub repo** (root directory = repository root). Settings, Config as Code path: `/railway.api.json` (build, pre-deploy migration, `/ready` health check, one replica are already defined). Name it `api`.
3. **Second service from the same repo**, config path `/railway.worker.json` (cron `*/5 * * * *`). Name it `worker`.
4. Variables on **api** and **worker** (use Railway reference variables so both share them):

| Variable | Value | api | worker |
| --- | --- | --- | --- |
| `NODE_ENV` | `production` | yes | yes |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (private URL) | yes | yes |
| `SESSION_SECRET` | 48+ random chars, generate once, identical on both | yes | yes |
| `FRONTEND_ORIGIN` | `https://app.YOUR-DOMAIN` | yes | yes |
| `ADMIN_ORIGIN` | `https://admin.YOUR-DOMAIN` | yes | no |
| `TRUST_PROXY_HOPS` | `2` (see below) | yes | no |
| `BILLING_STUB_ENABLED` | `false` | yes | no |
| `RESEND_API_KEY`, `EMAIL_FROM` | from Resend (verified domain) | yes | yes |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `npx web-push generate-vapid-keys` | yes | yes |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | `GOOGLE_CALLBACK_URL=https://app.YOUR-DOMAIN/backend/auth/google/callback` | yes | no |
| `AI_PROVIDER`, `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY` | optional | yes | no |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | optional, enables profile photos | yes | no |
| `TRIAL_MODE` | `internal` (default, no-card 7-day Pro trial) or `off` | yes | no |

Railway injects `PORT`. Only the **api** service needs a public domain (Networking, generate a Railway domain or attach `api.YOUR-DOMAIN`). The worker has no public URL.

**2. Vercel: two projects from the same repo** (enable "Include source files outside of the Root Directory"):

| Project | Root Directory | Domain |
| --- | --- | --- |
| app | `apps/web` | `app.YOUR-DOMAIN` |
| admin | `apps/admin` | `admin.YOUR-DOMAIN` |

Variables on **both**: `NEXT_PUBLIC_DATA_MODE=api`, `NEXT_PUBLIC_API_URL=/backend`, `API_INTERNAL_URL=https://YOUR-RAILWAY-API-DOMAIN`. Both projects talk to the same API; the build fails fast if these are wrong.

**3. Finish**
1. Set `FRONTEND_ORIGIN` / `ADMIN_ORIGIN` on Railway to the final exact HTTPS origins and redeploy the api service.
2. Register the Google redirect URI exactly as `GOOGLE_CALLBACK_URL`.
3. Sign up once on the app, then make that account the administrator (see KEY_SETUP.md): from your machine run `DATABASE_URL=<Railway PostgreSQL public URL> npm run admin -- select USER_ID "Initial administrator"`. This writes to the production database on purpose; enable the database's public network only for this step.
4. Open `https://admin.YOUR-DOMAIN/admin/login`.

**`TRUST_PROXY_HOPS`:** the browser reaches the API through Vercel's `/backend` rewrite, so there are two proxies (Vercel, then Railway). With `1` every visitor can appear to come from Vercel's IP and share one rate-limit bucket (the 180 requests/min global limit and the 5-failed-login lockout). Use `2`. To verify on staging: fail a login five times from one network, then log in from another network or phone; if the second one is also blocked, the value is wrong. Keep `1` if you instead point the app straight at the Railway domain.

## Vercel frontend

Import the repository with **Root Directory `apps/web`** and enable files outside that directory. `apps/web/vercel.json` installs from the workspace root and builds Next.js. Use Node 24.

Set these Vercel variables before building:

```text
NEXT_PUBLIC_DATA_MODE=api
NEXT_PUBLIC_API_URL=/backend
API_INTERNAL_URL=https://YOUR-API-HOST
```

The same-origin `/backend` proxy preserves session cookies and CSRF checks. The Vercel build rejects a localhost API or demo mode. Never put database credentials, session secrets, VAPID private keys or provider keys in public frontend variables.

## Separate admin deployment

Create a second Vercel project from the same repository with **Root Directory `apps/admin`**. Enable files outside the root directory. Use the same three frontend variables shown above, pointing to the same API. Attach `admin.YOUR-DOMAIN` to this project and `app.YOUR-DOMAIN` to `apps/web`. Admin `/` redirects to `/admin`; its login remains `/admin/login`. Both projects reuse the same admin components, so fixes stay consistent.

On the backend set `FRONTEND_ORIGIN=https://app.YOUR-DOMAIN` and `ADMIN_ORIGIN=https://admin.YOUR-DOMAIN` (exact origins, no trailing slash). Each frontend proxies `/backend`, preserving its own host-only session cookie. Administrator access is still checked by the API; separating the frontend is not an authorization boundary. The app retains its existing `/admin` routes for compatibility.

Local admin: `npm run dev:admin` on port 3003. Set `ADMIN_ORIGIN=http://localhost:3003` on the local API before starting it. `npm run build` builds app, admin and API. PostgreSQL is a private database service, not a Vercel frontend project. Run the notification worker against that same database on the backend host.

## API and database

Use the repository root for the API host. Install/build with `npm ci && npm run db:generate && npm run build -w @ledger/api`. Apply committed migrations with `npm run db:migrate` before starting `npm run start -w @ledger/api`. Set the host health check to `/ready`, which verifies PostgreSQL.

Copy variable names from `apps/api/.env.example`. Configure `NODE_ENV=production`, the database URL, a new strong session secret and the exact Vercel browser origin in `FRONTEND_ORIGIN`. Configure the Google callback as `https://YOUR-FRONTEND/backend/auth/google/callback` if Google login is enabled. Email/password login does not require Google.

Use one API replica while the current in-memory login limiter is in use. Shared PostgreSQL sessions are persistent; multiple API replicas require a shared rate-limit store before scaling.

## Browser push, email and scheduled jobs

Generate one VAPID key pair with `npx web-push generate-vapid-keys`. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT=mailto:YOUR-SUPPORT-EMAIL` on API and worker. Keep the same keys across deployments. Browser permission is requested only after the customer clicks Enable during onboarding or Settings; it cannot be bypassed. HTTPS is required outside localhost.

For email, configure a verified Resend sending domain, `RESEND_API_KEY` and `EMAIL_FROM`. Admin broadcasts respect announcement-email opt-in and browser preferences. Browser reminders are separate from customer email quotas. Paid, opted-in habit/goal/workout/meal emails count toward the monthly email allowance; the good-morning reminder uses browser push.

Schedule `npm run worker` every five minutes on Railway (`*/5 * * * *`, its minimum cron interval). On hosts supporting one-minute schedules, a one-minute interval is also suitable. The worker uses the same database, session secret, VAPID and email configuration. It leases batches of 25 jobs, retries failures and skips inactive accounts. Task browser reminders become due **23 hours after task due time**; task email reminders also use 23 hours. Morning reminders run once daily at 8am in the customer timezone and expire at noon. Scheduled habits, incomplete goals, workouts and meals send browser reminders at 11pm on their scheduled date. Completion, deletion and rescheduling invalidate old jobs. If a queue grows beyond a batch, increase worker frequency. Browser delivery depends on permission and the device/browser service; queued does not mean delivered.

The local `npm run dev` command starts/reuses PostgreSQL, API and frontend and runs a worker loop every minute. The worker uses a localhost lock on port 4013 to prevent duplicate local loops.

## Plans and payments

Free defaults to five unfinished tasks, three active habits, three active goals and 100 monthly transactions. Admin policies can override these amounts. Settings and `/plans` show actual allowances and remaining usage. Completing eligible items releases allowance; downgrades retain saved records. Premium guides, generators, repeating entries and historical/PDF reports require paid access.

Paid plan requests create support tickets; only the administrator activates Free/Pro/Lifetime during current testing. Manual grants never create revenue. Real payment checkout/webhook verification still needs a provider connection; leave `BILLING_STUB_ENABLED=false` in production.

Free users see a dismissible animated upgrade prompt once per local calendar day, per account/browser. Limit attempts show a separate prompt every time. Cross-browser daily impression synchronization is not implemented.

## Verify on the deployed staging environment

Check `/backend/ready`, `/login`, `/signup` and authenticated navigation. Verify session persistence, CSRF rejection, five failed passwords followed by a 15-minute cooldown, Free quotas and administrator plan changes. Verify banned accounts can only use support and read replies. Allow push on a staging browser, send a specific-user test from Admin → Announcements, run the worker and confirm the OS notification and delivery state. Check task completion cancels the pending reminder. Verify Resend delivery separately before enabling customer emails.

Local commands: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, and `npx playwright test`. Database integration tests require a migrated **disposable** `TEST_DATABASE_URL`; never use a production database.

Free accounts receive browser notifications only. Pro/Lifetime can also receive opted-in reminder and announcement emails. Manual admin broadcasts recheck the effective plan at delivery; password recovery emails remain available to every plan.

## Email verification and password recovery

New email/password signup requires Resend configuration. Accounts and workspace sessions are created only after a correct six-digit OTP; the user then opens onboarding automatically. Codes expire after 10 minutes, allow at most 5 wrong attempts, and resend waits 45 seconds. Password recovery uses the same email OTP screen, followed by a new password; reset proof is session-bound and single-use, and all existing login sessions are revoked after reset. Existing accounts and already-issued legacy reset links are preserved. API email sending is synchronous and reports provider errors; no fake successful delivery or verification bypass exists. Apply the auth OTP migration before restarting the API. Verify inbox delivery using a controlled staging email before launch.

## Google signup, account reuse and onboarding

Create a Web Application OAuth client in Google Cloud Console. Set the authorized redirect URI to `https://app.YOUR-DOMAIN/backend/auth/google/callback`. Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and that exact `GOOGLE_CALLBACK_URL` only on the API. Complete the consent screen and publish it before public launch. Do not place the secret on Vercel as a NEXT_PUBLIC variable.

Verified Google email connects to an existing account with the same email; its records, plan, restriction status and onboarding completion stay intact. A new account starts onboarding after the callback. Existing incomplete accounts also continue onboarding. Ambiguous legacy duplicate emails require support instead of guessing which account to connect.

Email/password signup with the correct existing password also logs into the existing account. An incorrect password cannot open it and is rate limited. New email signups still require OTP verification.

Referral links and codes live in Settings. A new verified signup through the link counts once; existing-account login does not. Ranking is shown only for Pro/Lifetime accounts with an active verified referral. Configure FRONTEND_ORIGIN before sharing production links.

Official Vercel monorepo setup: https://vercel.com/docs/monorepos/monorepo-faq

Setup keys and one-phase-at-a-time Claude prompts: [KEY_SETUP.md](KEY_SETUP.md). Whop variable names in that guide are proposed implementation inputs, not an active integration. Cloudinary (profile photos) is implemented and activates when its three variables are set.
