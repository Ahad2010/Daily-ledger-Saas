# Admin and AI setup

Apply the five committed migrations with `npm run db:migrate` using Railway's `DATABASE_URL`. Sessions remain in PostgreSQL; no Supabase is used. Generate Prisma with `npm run db:generate`.

## Select the single administrator

First register the intended person through the existing user signup or Google flow. Obtain their user ID from the database using a server-side database console. There is no public admin signup or bootstrap endpoint.

From a trusted server terminal with `DATABASE_URL` configured:

```powershell
npm run admin -- select USER_ID "Initial authorized administrator"
npm run admin -- password USER_ID "Initialize administrator password"
```

Password input is interactive and hidden; enter it twice. Use 12–128 characters with letters, numbers and symbols. Do not pass passwords as command arguments or environment variables. The same password credential is used for that person's user and admin login; the admin login explicitly creates the separate admin-session grant.

To transfer access, run `select` with the new active account's user ID and an explanatory reason. Then initialize its password if needed. Selection increments the singleton grant version, revokes both accounts' sessions, and cancels the previous administrator's pending test-email jobs. Password reset also revokes sessions and existing reset links. Database constraints permit only singleton ID 1 and one selected account.

Log in at `/admin/login`. A normal user login, even for a selected account or an account carrying the legacy `admin` role, does not grant admin access. Every `/api/admin/*` request verifies the selected active account and current admin-session grant/version. Transfers invalidate old access immediately. Administration is audited without password hashes, keys or session values.

## Admin pages

Routes: `/admin`, `/admin/users`, `/admin/plans`, `/admin/announcements`, `/admin/automations`, `/admin/reports`, `/admin/ai`, `/admin/settings`, `/admin/audit`. User detail pages expose identity and aggregate allowances/usage, not personal entries or conversations.

Suspension revokes sessions, blocks protected requests and cancels relevant queued jobs; records are retained. Reactivation restores access without blindly resending cancelled reminders. Manual entitlement overrides have a mandatory reason and expiry and leave the underlying plan intact. Expired overrides cease applying automatically. Allowance changes require a preview of affected accounts and an effective date; provider contract accounts are excluded. The payment provider remains unconfigured. Verified recurring and Lifetime payments are reported separately by currency; manual grants and stubs produce no revenue.

Announcements start as drafts. Publication/scheduling is an explicit two-step action in the editor. Content is plain text, CTA URLs allow internal paths or HTTPS, and version-specific read/dismissal records support deduplication. Email follows existing preferences, quotas, durable attempts and provider idempotency. No announcement or real email is sent as part of installation or tests. Test email requires an explicit admin action, queues only to the selected administrator, and requires Resend configuration plus a worker.

Eligible failed reminder retries retain the same provider idempotency key, require current state/preferences/allowances, allow only a bounded extra attempt and reject expired idempotency windows or completed deliveries. Bounce reporting is unavailable until a provider webhook integration is configured.

## Configure the read-only AI Assistant

No provider is selected or purchased automatically. To use an explicitly chosen provider supporting the OpenAI-compatible chat-completions contract, set backend-only variables:

```dotenv
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://YOUR_CHOSEN_PROVIDER/v1
AI_API_KEY=YOUR_SERVER_ONLY_KEY
AI_MODEL=YOUR_CHOSEN_MODEL
```

The base URL must use HTTPS in production. The adapter calls `/chat/completions`, requests a maximum of 1,000 output tokens, and requires usage metadata. A provider that does not support that contract needs a corresponding adapter change. Enable AI and set per-plan monthly request/token limits in `/admin/ai`; defaults keep the feature disabled. Missing variables or a disabled feature produces an honest unconfigured state, not a fake response.

Optional `AI_INPUT_COST_PER_MILLION` and `AI_OUTPUT_COST_PER_MILLION` are USD rates. Set them only from reliable provider pricing. Estimates use reported token usage; they are neither payments nor verified revenue. Without both rates, no cost number is invented.

The server computes ledger totals deterministically and supplies only the selected user's requested context: monthly totals/category aggregates, up to 20 open tasks, 10 active habits or 15 goals. It never supplies credentials, profile email, another user's data or admin information. Stored text is untrusted data. No tools/actions are provided to the model. Requests reserve a conservative token budget atomically; failures and uncertain/pending requests retain their reservation. Usage metadata is separate from messages. Clearing history removes personal questions/replies and cancels pending history creation while keeping allowance counters.

## Remaining external setup

Select the real administrator; configure Google, Railway/Vercel deployment, Resend sender/key and scheduled worker; choose and configure an AI provider if desired. Production billing and provider bounce webhooks remain unavailable. There is no production credential or provider call in the local test fixtures.


### Support center and plan administration

Run `npm run db:generate` and `npm run db:migrate` to install migration `20261005120000_support`. No third-party support service or email credential is required: customer tickets persist in PostgreSQL and reach the selected administrator at `/admin/support`. Users submit and track replies at `/help`; the page refreshes its inbox every 30 seconds and an open conversation every 15 seconds while visible. Email notifications are not implemented.

Users can search the worldwide currency catalog in Settings/onboarding/finance forms; historical values are never converted. The existing two-decimal amount entry/storage behavior is preserved. All native dropdowns use explicit dark option styles.

Admin → Users → account → Change plan assigns Free/Pro/Lifetime immediately, records an audit event, and removes any prior temporary override. Temporary access still supports an expiry. Advanced tools/allowance settings are collapsed rather than deleted. Manual entitlements do not record paid revenue. Live checkout, signed provider webhooks, purchase reconciliation and automatic subscription activation remain unconfigured pending the user's payment-provider choice and credentials.

Validation: `tests/currency.test.ts` covers supported-code validation/formatting and existing storage; `tests/browser/support.spec.ts` exercises actual PostgreSQL ticket creation/admin reply/status, tenant isolation, CSRF/stale-version rejection, manual plan assignment and responsive currency/support UI. The support browser test uses isolated fixture users and signed test sessions without changing the selected administrator, and removes its own records afterwards. It requires `TEST_DATABASE_URL` and a local configured API environment with an existing selected administrator; use a development/test database only.
