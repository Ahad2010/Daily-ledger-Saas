# Daily Ledger: setup keys and Claude prompts

Verified against repository configuration on 8 October 2026. All values below are placeholders. Enter actual secrets yourself in dashboards or ignored env files; do not paste them into prompts, screenshots or Git.

## Hosting and where to enter values

| Service | Host / directory | Where values go |
|---|---|---|
| Customer app | Vercel, root `apps/web`, `app.YOUR-DOMAIN` | Project → Settings → Environment Variables |
| Admin frontend | Separate Vercel project, root `apps/admin`, `admin.YOUR-DOMAIN` | Its own Environment Variables |
| Backend API | Railway persistent service, repository root | Service → Variables |
| PostgreSQL | Railway private database | Reference its DATABASE_URL from the API and worker |
| Reminder worker | Railway cron service, repository root | Service → Variables; same database and email/push configuration |

Enable files outside the root directory in both Vercel projects. Each frontend proxies `/backend` to the API, preserving its own session cookie. API permissions still protect admin actions. PostgreSQL and the worker need no public website/subdomain.

Local files: backend `apps/api/.env`, customer app `apps/web/.env.local`, separate admin `apps/admin/.env.local`. Keep them ignored. Redeploy frontends and restart/redeploy the API after changing their variables.

## Required backend variables

```dotenv
NODE_ENV=production
DATABASE_URL=RAILWAY-POSTGRES-REFERENCE
SESSION_SECRET=GENERATED-RANDOM-SECRET
FRONTEND_ORIGIN=https://app.YOUR-DOMAIN
ADMIN_ORIGIN=https://admin.YOUR-DOMAIN
BILLING_STUB_ENABLED=false
```

Use Railway's reference-variable picker for DATABASE_URL and its assigned PORT. Origins must be exact, with no trailing slash. Generate SESSION_SECRET once locally:

```text
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Keep that secret stable across deployments. Changing it signs users out. Keep one API replica until the in-memory password-attempt limiter is replaced by a shared limiter.

API commands, from repository root:

```text
Build: npm ci && npm run db:generate && npm run build -w @ledger/api
Pre-deploy: npm run db:migrate
Start: npm run start -w @ledger/api
Health check: /ready
```

Worker: same build, start `npm run worker`, cron `*/5 * * * *`. Railway cron runs at a minimum five-minute interval and can be delayed a few minutes. Use the same database and relevant provider variables. Never run test suites against production data. [Railway variables](https://docs.railway.com/variables), [cron documentation](https://docs.railway.com/cron-jobs).

## Vercel: set in BOTH app and admin projects

```dotenv
NEXT_PUBLIC_DATA_MODE=api
NEXT_PUBLIC_API_URL=/backend
API_INTERNAL_URL=https://YOUR-RAILWAY-API-DOMAIN
```

API_INTERNAL_URL is the backend domain, not the app domain. No database, Google secret, Resend key, AI key or VAPID private key belongs in NEXT_PUBLIC variables. Builds reject localhost API and demo mode. Vercel Hobby is for personal/non-commercial use; check [commercial-use rules](https://vercel.com/docs/limits/fair-use-guidelines) before launching a paid SaaS.

## First administrator on a new database

No ADMIN_API_KEY exists or is needed. Create/verify your own active user first, then select its database user ID with the existing server CLI:

```text
npm run admin -- select YOUR_USER_ID "Initial production administrator"
```

Run this only in a trusted backend shell pointed at the intended database. The selected account can use its existing password or configured Google sign-in at `/admin/login`. If it needs a new password, `npm run admin -- password YOUR_USER_ID "Initial administrator password"` requires an interactive terminal and hides password entry. These commands revoke affected sessions. Do not put passwords in command arguments or invent an admin secret variable.

## Google OAuth: API only

In [Google Cloud Console](https://console.cloud.google.com/) → Google Auth Platform, configure Branding/Audience and create a **Web application** client. Add test users during Testing.

```dotenv
GOOGLE_CLIENT_ID=YOUR-ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR-GOOGLE-SECRET
GOOGLE_CALLBACK_URL=https://app.YOUR-DOMAIN/backend/auth/google/callback
```

Register that exact callback as an authorized redirect URI. Also register `http://localhost:3000/backend/auth/google/callback` for local testing. If asked for a JavaScript origin, use the app origin without a path. Existing code uses direct server-side OAuth: no Clerk keys are needed. New/incomplete users enter onboarding; verified Google email can reuse an existing account without replacing its plan, records or ban. Live consent/redirect checks require your client. [Google OAuth documentation](https://developers.google.com/identity/protocols/oauth2/web-server).

## Resend: API AND email worker

In [Resend](https://resend.com/), add a sending domain, publish the supplied DNS records, wait for verification, then create an API key permitted to send from that domain.

```dotenv
RESEND_API_KEY=re_YOUR-KEY
EMAIL_FROM=Daily Ledger <notifications@YOUR-VERIFIED-DOMAIN>
```

EMAIL_FROM must use a verified domain. No SMTP password is needed. Signup OTP and password recovery are implemented; real inbox delivery still needs your key/domain. Authentication emails remain available on Free; routine and announcement emails require paid access and consent. Resend's free transactional allowance is listed as 3,000/month and 100/day; OTP, resets and reminders share it. [Current pricing](https://resend.com/pricing).

## Browser notifications: API AND worker

Generate once with `npx web-push generate-vapid-keys`, then set:

```dotenv
VAPID_PUBLIC_KEY=GENERATED-PUBLIC-KEY
VAPID_PRIVATE_KEY=GENERATED-PRIVATE-KEY
VAPID_SUBJECT=mailto:support@YOUR-DOMAIN
```

The frontend gets the public key from the API; no frontend VAPID variable is needed. Keep the pair stable and the private key on the backend. Browser Allow permission is required even when onboarding offers Enable; HTTPS is required outside localhost. Test a specific-user admin notification with a subscribed staging browser and inspect both the worker delivery record and actual desktop notification. Queued does not mean delivered.

## AI: API only, then enable in /admin/ai

Choose one OpenAI-compatible provider:

```dotenv
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=EXACT-PROVIDER-MODEL-ID
AI_API_KEY=YOUR-PROVIDER-KEY
AI_INPUT_COST_PER_MILLION=
AI_OUTPUT_COST_PER_MILLION=
```

The last two are optional verified pricing values, not secrets; blank means no cost estimate. OpenRouter offers free models with limits; check [current pricing](https://openrouter.ai/pricing). Alternatives: [Google AI Studio](https://aistudio.google.com/) using `https://generativelanguage.googleapis.com/v1beta/openai`, or OpenAI using `https://api.openai.com/v1`. Use the provider's exact current model ID. Gemini free-tier data may be used to improve Google products; review [pricing/data-use terms](https://ai.google.dev/gemini-api/docs/pricing) before sending personal records.

## Whop: prepare credentials; implementation still pending

The SDK is installed, but checkout is still an unavailable/development stub. **Keys alone currently do not collect payments or activate Pro.** Paid requests create support tickets; admin grants plans manually.

Prepare a Whop business/account ID (`biz_...`), business API credential with checkout creation and payment/membership read permissions, Pro recurring plan ID, Lifetime one-time plan ID, and webhook signing secret. Use separate sandbox credentials/plans first.

These are proposed names for the implementation phase, NOT variables currently consumed by the app:

```dotenv
WHOP_API_KEY=YOUR-WHOP-KEY
WHOP_ACCOUNT_ID=biz_YOUR-ACCOUNT
WHOP_PRO_PLAN_ID=plan_YOUR-PRO-PLAN
WHOP_LIFETIME_PLAN_ID=plan_YOUR-LIFETIME-PLAN
WHOP_WEBHOOK_SECRET=YOUR-SIGNING-SECRET
WHOP_SANDBOX=true
```

Keep these on the API. Implement/test the handler before registering a webhook URL. Planned endpoint: `https://YOUR-API-DOMAIN/webhooks/whop`. Returning to the app must never activate a plan by itself; activation needs verified server-side payment evidence. Duplicate events, refunds, subscription expiry, owner binding, delayed webhooks and Pro-to-Lifetime recurring-charge cancellation need tests. [Whop webhook guide](https://docs.whop.com/developer/guides/webhooks).

## Cloudinary: optional profile upload implementation pending

Prepare cloud name, API key and API secret. Proposed variables are CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET. They do nothing until the upload endpoint is implemented. Keep the secret backend-only and use authenticated signed uploads. Do not enable unrestricted unsigned uploads as a shortcut.

## Copy-paste Claude prompts: ONE phase at a time

Give Claude the repository and this guide. Replace MY-DOMAIN placeholders. Enter secrets yourself; Claude should verify presence without printing values.

**1 — Hosting**

> Read KEY_SETUP.md and DEPLOYMENT.md and inspect the monorepo. Guide me one step at a time through Railway API, private PostgreSQL, five-minute cron worker, and separate Vercel apps/web and apps/admin projects. Preserve the /backend proxy, migrations, session/CSRF protections and customer data. Use one API replica. Verify staging /ready, app login and admin login before another phase. Do not print secrets or run tests against production data.

**2 — Resend**

> Configure the existing RESEND_API_KEY and EMAIL_FROM integration. Help verify sending-domain DNS. Test controlled signup → OTP → onboarding, resend cooldown, expired/wrong codes, existing-account login, reset and session revocation. Keep Free authentication emails and paid/consented reminder emails. Do not replace auth or print secrets. Report actual inbox delivery separately from mocked tests.

**3 — Google**

> Configure existing server-side Google OAuth with GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL. Help create a Web application client with exact redirect https://app.MY-DOMAIN/backend/auth/google/callback. Test new user → onboarding and existing user → same account, preserving records, plan and bans. Check consent/test-user/publication settings. Do not migrate to Clerk or print secrets.

**4 — Browser push**

> Configure existing VAPID variables on API and worker. Test onboarding permission, specific-user admin notification, opt-out, Free browser-only policy, paid email consent, morning timezone and completion cancelling stale reminders. Verify actual desktop delivery as well as job status. Do not bypass browser permission, rotate working keys unnecessarily or print the private key.

**5 — AI**

> Configure one compatible AI provider with AI_PROVIDER, AI_BASE_URL, AI_MODEL and AI_API_KEY; enable /admin/ai. Test response, provider failure, quotas and read-only behavior with synthetic records. Use a currently available model and verified pricing. Do not expose keys or send real personal financial records during setup.

**6 — Whop implementation + sandbox**

> Inspect the billing stub and current official Whop API/SDK documentation. Implement hosted Pro/Lifetime checkout, server-owned checkout-to-user binding, raw-body webhook signature verification, idempotent paid activation and return-to-app confirmation. Use proposed WHOP_* names from KEY_SETUP.md consistently; add config, env examples, migrations and tests. Browser redirects cannot activate plans. Handle delayed/duplicate events, wrong business/plan, failed payments, full refunds, subscription expiry and Pro-to-Lifetime upgrades without continuing duplicate recurring charges. Preserve admin overrides and bans. Pass mocked security tests and actual sandbox checkout/webhook tests before live credentials. Never print secrets or describe the installed SDK as a working payment integration.

**7 — Cloudinary**

> Implement approved optional profile-image uploads in onboarding and Settings using signed Cloudinary uploads. Keep CLOUDINARY_API_SECRET backend-only. Validate file type/size, enforce account ownership, show errors and preserve the existing image on failure. Update env examples and test ownership/invalid uploads. Complete this phase before adding other features. Never print secrets.

## Verification limits

Local tests and mocked flows do not prove live Google OAuth, Resend inbox delivery, desktop push or Whop payment activation. Each needs configured staging credentials and a controlled real-provider test. This guide does not confirm a public deployment.

The 8 October npm audit reports four high-severity advisories in the Prisma tooling dependency chain (`prisma`, `@prisma/config`, `deepmerge-ts`, `mysql2`). They remain unresolved. The app uses PostgreSQL, but that does not make the dependency audit clean. Do not blindly use `npm audit fix --force`: the suggested major-version downgrade needs compatibility and migration checks first.
