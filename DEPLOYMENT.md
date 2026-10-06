# Daily Ledger deployment

The frontend is configured for Vercel. The Express API, PostgreSQL and scheduled notification worker run on an external host such as Railway. No deployment or payment connection has been made.

## Vercel frontend

Import the repository with **Root Directory `apps/web`** and enable files outside that directory. `apps/web/vercel.json` installs from the workspace root and builds Next.js. Use Node 24.

Set these Vercel variables before building:

```text
NEXT_PUBLIC_DATA_MODE=api
NEXT_PUBLIC_API_URL=/backend
API_INTERNAL_URL=https://YOUR-API-HOST
```

The same-origin `/backend` proxy preserves session cookies and CSRF checks. The Vercel build rejects a localhost API or demo mode. Never put database credentials, session secrets, VAPID private keys or provider keys in public frontend variables.

## API and database

Use the repository root for the API host. Install/build with `npm ci && npm run db:generate && npm run build -w @ledger/api`. Apply committed migrations with `npm run db:migrate` before starting `npm run start -w @ledger/api`. Set the host health check to `/ready`, which verifies PostgreSQL.

Copy variable names from `apps/api/.env.example`. Configure `NODE_ENV=production`, the database URL, a new strong session secret and the exact Vercel browser origin in `FRONTEND_ORIGIN`. Configure the Google callback as `https://YOUR-FRONTEND/backend/auth/google/callback` if Google login is enabled. Email/password login does not require Google.

Use one API replica while the current in-memory login limiter is in use. Shared PostgreSQL sessions are persistent; multiple API replicas require a shared rate-limit store before scaling.

## Browser push, email and scheduled jobs

Generate one VAPID key pair with `npx web-push generate-vapid-keys`. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT=mailto:YOUR-SUPPORT-EMAIL` on API and worker. Keep the same keys across deployments. Browser permission is requested only after the customer clicks Enable during onboarding or Settings; it cannot be bypassed. HTTPS is required outside localhost.

For email, configure a verified Resend sending domain, `RESEND_API_KEY` and `EMAIL_FROM`. Admin broadcasts respect announcement-email opt-in and browser preferences. Browser reminders are separate from customer email quotas. Paid, opted-in habit/goal/workout/meal emails count toward the monthly email allowance; the good-morning reminder uses browser push.

Schedule `npm run worker` every minute (or every five minutes for lower frequency) on the backend host. The worker uses the same database, session secret, VAPID and email configuration. It leases batches of 25 jobs, retries failures and skips inactive accounts. Task browser reminders become due **23 hours after task due time**; task email reminders also use 23 hours. Morning reminders run once daily at 8am in the customer timezone and expire at noon. Scheduled habits, incomplete goals, workouts and meals send browser reminders at 11pm on their scheduled date. Completion, deletion and rescheduling invalidate old jobs. If a queue grows beyond a batch, increase worker frequency. Browser delivery depends on permission and the device/browser service; queued does not mean delivered.

The local `npm run dev` command starts/reuses PostgreSQL, API and frontend and runs a worker loop every minute. The worker uses a localhost lock on port 4013 to prevent duplicate local loops.

## Plans and payments

Free defaults to five unfinished tasks, three active habits, three active goals and 100 monthly transactions. Admin policies can override these amounts. Settings and `/plans` show actual allowances and remaining usage. Completing eligible items releases allowance; downgrades retain saved records. Premium guides, generators, repeating entries and historical/PDF reports require paid access.

Paid plan requests create support tickets; only the administrator activates Free/Pro/Lifetime during current testing. Manual grants never create revenue. Real payment checkout/webhook verification still needs a provider connection; leave `BILLING_STUB_ENABLED=false` in production.

Free users see a dismissible animated upgrade prompt once per local calendar day, per account/browser. Limit attempts show a separate prompt every time. Cross-browser daily impression synchronization is not implemented.

## Verify on the deployed staging environment

Check `/backend/ready`, `/login`, `/signup` and authenticated navigation. Verify session persistence, CSRF rejection, five failed passwords followed by a 15-minute cooldown, Free quotas and administrator plan changes. Verify banned accounts can only use support and read replies. Allow push on a staging browser, send a specific-user test from Admin → Announcements, run the worker and confirm the OS notification and delivery state. Check task completion cancels the pending reminder. Verify Resend delivery separately before enabling customer emails.

Local commands: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, and `npx playwright test`. Database integration tests require a migrated **disposable** `TEST_DATABASE_URL`; never use a production database.

Free accounts receive browser notifications only. Pro/Lifetime can also receive opted-in reminder and announcement emails. Manual admin broadcasts recheck the effective plan at delivery; password recovery emails remain available to every plan.
