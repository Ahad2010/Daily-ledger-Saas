# Launch checklist: app.dailyledger.store (no payments, no Google sign-in yet)

Follow top to bottom. Detailed background is in DEPLOYMENT.md and KEY_SETUP.md. Replace `dailyledger.store` if the domain differs.

## 0. Who owns what
- **GitHub repo:** `Ahad2010/Daily-ledger-Saas` (developer account).
- **Railway and Vercel:** client accounts.
- Railway and Vercel deploy by reading the repo through a GitHub connection. Pick ONE:
  1. **Repo moves to the client's GitHub (simplest, recommended).** Client creates a GitHub account or organisation, you push this repo there (`git remote add client <url>; git push client claude/happy-dirac-8ypg6s:main`), and add yourself as a collaborator for future work. Railway and Vercel then connect with the client's GitHub login.
  2. **Repo stays yours.** The GitHub App for Railway/Vercel must be installed on the account that owns the repo, so the client cannot connect it alone. You would need to authorise it, or use `vercel deploy` / `railway up` with the client's tokens (no automatic deploys on push).
- Vercel's free Hobby plan is for non-commercial use only. A paying client needs a Vercel Pro team.

## 1. Accounts the client needs
GitHub, Railway, Vercel, Resend (transactional email, with `dailyledger.store` verified), and the domain registrar for `dailyledger.store`.

## 2. Railway (API + database + worker)
1. New project, **Add PostgreSQL**.
2. New service from the repo, root directory = repo root, config path `/railway.api.json`. Name it `api`. (Build, migration before start, `/ready` health check and one replica are already set.)
3. Second service, same repo, config path `/railway.worker.json`. Name it `worker`.
4. Variables (api AND worker unless noted). Use the reference variable for the database.

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `SESSION_SECRET` | 48+ random characters, identical on api and worker. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `FRONTEND_ORIGIN` | `https://app.dailyledger.store` |
| `ADMIN_ORIGIN` (api only) | `https://admin.dailyledger.store` |
| `TRUST_PROXY_HOPS` (api only) | `2` |
| `BILLING_STUB_ENABLED` (api only) | `false` |
| `RESEND_API_KEY`, `EMAIL_FROM` | from Resend, e.g. `Daily Ledger <no-reply@dailyledger.store>` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `npx web-push generate-vapid-keys`; subject `mailto:support@dailyledger.store` |
| `TRIAL_MODE` (api only) | `internal` = every new user gets a 7-day Pro trial with no card; `off` = no trials. **Ask the client which.** |

Leave **unset** for now: `WHOP_*` (payments off, checkout answers "unavailable"), `GOOGLE_*` (Google button shows a not-configured message), `AI_*` (assistant stays disabled until a provider key is added).
5. Only `api` needs a public domain. Generate the Railway domain (or attach `api.dailyledger.store`). Check `https://<api-domain>/ready` returns OK.

## 3. Vercel (two projects, same repo, enable "Include source files outside of the Root Directory")
| Project | Root Directory | Domain |
| --- | --- | --- |
| app | `apps/web` | `app.dailyledger.store` |
| admin | `apps/admin` | `admin.dailyledger.store` |

Environment variables on BOTH projects:
```
NEXT_PUBLIC_DATA_MODE=api
NEXT_PUBLIC_API_URL=/backend
API_INTERNAL_URL=https://<your Railway api domain>
```
This is what keeps the live site on real accounts and never on demo mode; the Vercel build fails on purpose if these are wrong. After the domains are attached, set the exact Railway origins above and **redeploy the api service**.

## 4. DNS
Add the records Vercel shows for `app` and `admin` (and the Resend DNS records for email: SPF, DKIM). Wait until Vercel and Resend both show "Verified".

## 5. First administrator
1. Open `https://app.dailyledger.store`, sign up with the owner email, confirm the OTP.
2. From a trusted machine, point at the Railway Postgres **public** URL and run:
   `DATABASE_URL=<public url> npm run admin -- select USER_ID "Initial administrator"` (see KEY_SETUP.md).
3. Open `https://admin.dailyledger.store/admin/login`.

## 6. Smoke test on the live site (phone and laptop)
Signup with OTP, login, logout, forgot password (link arrives by email), add a task/expense/workout, the Free plan limits and upgrade prompt, the product tour, admin login. Watch Railway logs while doing it.

## 7. Before announcing
- Turn on Postgres backups in Railway and do one test restore.
- Add an uptime monitor on `https://<api-domain>/ready` and an error tracker.
- Rotate any key that was ever pasted into a chat or screenshot.

## Known limits (from the pre-launch review)
- Repeating tasks and recurring entries are processed in batches of 100 by the worker; this only matters once there are many users.
- Keep Railway at one replica.
- Before turning payments on, re-read the Whop notes in KEY_SETUP.md and fix the billing items the review listed (cancel when Whop is misconfigured, out-of-order webhooks, double checkout).
