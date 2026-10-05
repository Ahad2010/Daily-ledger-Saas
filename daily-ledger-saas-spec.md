# Daily Ledger — SaaS Build Specification

## How to use this file

Place this file in the project root as `daily-ledger-saas-spec.md` and place the supplied dashboard screenshot beside it as `dashboard-reference.png`. The screenshot is the primary visual reference; this specification defines behavior, infrastructure, security, and implementation order.

Read this entire file, inspect the repository and its applicable `AGENTS.md` instructions, and then implement the application. Do not stop at a plan. Preserve existing working functionality and user data.

If this is an empty project, scaffold it. If an application already exists, improve it incrementally rather than replacing everything unnecessarily.

## 1. Product

Build a professional personal life management SaaS named **Daily Ledger** with these modules:

- Overview
- Financial Planner
- Tasks & Habits
- Fitness
- Meals & Grocery
- Life Goals
- Monthly Reports
- Settings and Help

This is a personal planning product. The dashboard must summarize real records and lead users to useful actions. Avoid decorative charts or buttons that do nothing.

Use professional English throughout the product interface.

## 2. Required stack and hosting

| Layer | Requirement |
| --- | --- |
| Frontend hosting | Vercel |
| Frontend, new project | Next.js App Router + TypeScript |
| UI | Tailwind CSS + shadcn/ui + Lucide icons |
| Charts | Recharts |
| Animation | GSAP + @gsap/react (primary animation system) |
| API state | TanStack Query |
| Forms | React Hook Form + Zod |
| Backend | Node.js + Express + TypeScript, hosted on Railway |
| Database | PostgreSQL, hosted on Railway |
| ORM | Prisma with committed migrations |
| Authentication | Backend Google OAuth plus email/password (user-authorized extension); one PostgreSQL-backed session system |
| Email | Resend, called only from the backend |
| Scheduled work | Railway Cron + durable PostgreSQL job/outbox records |

**Do not use Supabase** for authentication, database, storage, or backend services.

Use compatible current stable dependencies. Inspect package versions and existing configuration before adding packages. Reuse installed libraries where practical and avoid unnecessary infrastructure.

If the existing frontend uses React/Vite or a suitable React framework, preserve it. Do not rewrite solely to adopt Next.js. Keep dependencies and package manager consistent with the repository.

For an empty repository, `apps/web`, `apps/api`, and `packages/shared` is an acceptable structure. Do not force a large monorepo migration onto a working project.

Keep backend business logic, secrets, and database access in the Railway API. The Vercel application is the frontend.

## 3. Visual direction and reference

Inspect `dashboard-reference.png` before building the UI. Match its composition, sidebar, spacing, typography, card hierarchy, and chart placement closely. Do not create an unrelated generic admin template.

Use a restrained black theme inspired by Resend:

| Token | Suggested value |
| --- | --- |
| Page background | `#080808` |
| Sidebar | `#0B0B0B` |
| Cards | `#111111` / `#151515` |
| Borders | `#292929` |
| Primary text | `#FAFAFA` |
| Secondary text | Muted gray |
| Chart accents | Soft ice blue and mint |
| Overdue/error | Muted red |

Use Geist or a similarly clean font, thin borders, restrained shadows, approximately 10px card corners, and consistent spacing. Maintain readable contrast.

Do not introduce gold, navy, heavy gradients, excessive glow, or glass effects. The screenshot takes precedence over suggested token values where a visible detail differs.

Use semantic design tokens and reusable components rather than repeating arbitrary colors throughout the application.

## 4. Sidebar and application shell

Desktop sidebar, in this order:

1. Daily Ledger logo and name.
2. Personal workspace selector.
3. Overview.
4. Financial Planner.
5. Tasks & Habits.
6. Fitness.
7. Meals & Grocery.
8. Life Goals.
9. Monthly Reports.

Bottom sidebar section:

- Settings.
- Help.
- User avatar or initials and actual signed-in name.
- Current plan badge.
- Save/sync status.

Match the selected-row treatment: a charcoal highlighted row with a subtle light indicator on the left.

Every navigation item must open a working page. A personal workspace selector can be single-workspace for the MVP; do not pretend collaboration exists.

Top bar:

- Breadcrumb.
- Search.
- Notification bell with unread count.
- User menu with settings and logout.

Search should search records the user is authorized to access. Use appropriate debouncing and loading states. Notifications must reflect real unread items once the backend is connected.

On mobile, use an accessible sidebar drawer. Support approximately 390px mobile, 768px tablet, and 1440px/1920px desktop widths without horizontal overflow.

Show “All changes saved” only after successful saves. Also support saving, failure, and retry states.

## 5. Overview dashboard

Heading: **Your life at a glance**

Subtitle: **Track your money, routines and progress in one place.**

Controls:

- Month/date-range selector.
- Export report.
- Quick add.

Quick add must open a working form/menu for a transaction, task, habit, workout, or goal. The selected period must consistently affect relevant dashboard data.

### Metric cards

1. Income for the selected period, with a valid comparison when available.
2. Expenses, showing budget usage where a budget exists.
3. Net savings and savings rate.
4. Completed tasks / eligible tasks, with a progress ring.

Definitions:

- Net savings = income minus expenses.
- Savings rate = net savings / income when income is greater than zero.
- Budget usage = expenses / configured budget when budget is greater than zero.
- Task completion = completed eligible tasks / total eligible tasks when the denominator is greater than zero.

Define and label the task cohort, for example tasks due in the selected period. Do not silently mix creation, due, and completion dates.

Compare equivalent periods; for a partial month, label month-to-date comparisons clearly. When a comparison is unavailable, show an honest empty state or “—”. Never fabricate percentages.

### Cash flow chart

Build the large cumulative income and expense line/area chart shown in the reference.

- Distinct income and expense series.
- Clear currency and date axes.
- Hover crosshair and tooltip.
- Accessible legend and textual summary.
- Month/week grouping controls with genuine aggregation changes.
- Loading, empty, and failed states.

Both series must use the same selected date range and currency. Tooltips must show calculated values from actual records.

### Spending breakdown donut

- Display total expenses in the center.
- Show category amount and percentage in a legend.
- Add interactive tooltips.
- Clicking a category opens filtered transactions.
- Category totals must equal the total shown in the center.

### Other widgets

- Today’s priorities: working checkboxes, due times, and overdue labels.
- Habit consistency: completed versus scheduled occurrences, with useful daily/weekly detail.
- Goal progress: current value, target, progress, and deadline.
- Small dismissible announcement banner.

Seed demo records coherently. All metric cards, graphs, lists, and exports must derive from shared records rather than unrelated hardcoded numbers.

## 6. Feature pages

### Financial Planner

Support income/expense creation, editing, deletion, categories, notes, dates, currency, and account/payment information. Add monthly budgets, search, filters, recurring definitions, and CSV export.

Useful charts: spending trend, category breakdown, and budget versus actual.

Store amounts using an explicit decimal-safe strategy such as PostgreSQL numeric/Prisma Decimal or integer minor units with currency metadata. Do not use binary floating-point arithmetic for persisted money calculations. Avoid losing precision during API serialization.

Do not combine different currencies into one total without an explicit conversion system. Exclude transfers from income and expenses.

Recurring entries need duplicate prevention and an explicit schedule. Do not create duplicate entries on page refresh.

### Tasks & Habits

Tasks: title, description, priority, status, due date/time, reminders, and optional recurrence. Support create, edit, complete, reschedule, and delete, with today/upcoming/overdue/completed views.

Habits: customizable weekly schedules, completion records, streaks, a calendar heatmap, and scheduled-occurrence completion rate.

Calculate habit streaks and due dates in the user’s timezone. Unscheduled days must not count as failures.

### Fitness

Support workout date, type, duration, and optional notes. Show weekly workout frequency and duration trends.

Weight tracking may be optional and user-entered. Do not invent calorie burn or health recommendations.

### Meals & Grocery

Support weekly meal planning, grocery lists, completion checkboxes, optional quantity, and estimated cost. Connect meals to grocery items where useful.

Prefer a clear planner/list over unnecessary charts.

### Life Goals

Support title, description, target date, milestones, and manual or explicitly linked progress. Measurable goals should have current and target values.

Make financial links visible and prevent double counting. Never silently reinterpret a manually tracked goal as a computed one.

### Monthly Reports

Generate deterministic summaries from stored records: income, expenses, net savings, budgets, task completion, habit consistency, workouts, and goal progress.

Include previous equivalent-month comparisons where data exists. Support CSV and PDF exports whose totals match the UI.

Do not add fabricated AI insights. AI is not required for the MVP. Generate PDFs on demand; do not rely on an ephemeral server filesystem for permanent report retention.

### Settings and Help

Settings should include profile, currency preference, timezone, reminder preferences, subscription details, and data export. Help should explain product behavior clearly and offer an appropriate support entry point.

## 7. Interaction, animation, and accessibility

Use GSAP as the primary UI animation system with scoped animations, React lifecycle cleanup, and reduced-motion-aware contexts. Do not use GSAP and Motion on the same elements or introduce overlapping animation systems.

Implement staggered dashboard card entrances, subtle metric count-ups, smooth progress bars and goal indicators, coordinated chart entrances and donut transitions, sidebar selection indicators, mobile drawer transitions, smooth modals/dropdowns/notifications/expandable sections, and refined button hover/press/focus feedback. Keep animation restrained and fast; avoid continuous element animation, layout shifts, and entrance replays on data refresh.

Keep Recharts. Customize smooth cash-flow lines, restrained area fills, thin grids, readable date/currency axes, premium dark crosshair tooltips with formatted values, ice-blue/mint colors, compact sparklines, animated progress rings, and a centered-total donut with consistent spacing and rounded segment edges. Legends must show category names, amounts, and percentages and open filtered transactions. Coordinate Recharts chart animation with GSAP without animating the same chart twice. Supply accessible summaries, honest empty states, and responsive labels and legends without clipping.

Create reusable skeletons for metric cards, line/donut charts, task lists, tables, goal cards, and profile/notification content. Match final dimensions to avoid layout shifts. Connect skeletons to actual pending data states with no artificial delays; use a subtle dark shimmer disabled under reduced motion. Support empty, error, retry, and saving states.

Verify 360px, 390px, 768px, 1024px, 1440px, and 1920px layouts. Mobile drawers require focus management. Stack cards/charts cleanly, simplify axis labels when needed, wrap filters/action bars, use touch-friendly controls and practical forms, contain table horizontal scrolling, and prevent page-level overflow. Preserve the reference's black theme and desktop composition and polish typography, spacing, icons, borders, tooltips, and interactions across all pages. Inspect desktop/mobile screenshots and fix visual and interaction issues before reporting completion.

Use approximately 150–300ms for interactions and 600–900ms for initial chart reveals. Avoid looping decorative animation and replaying entrances on every data refresh.

Respect `prefers-reduced-motion`. Keep chart animations separate from the underlying calculations.

Use keyboard-accessible controls, visible focus states, labeled forms, useful validation errors, accessible dialogs, and chart summaries. Provide loading, empty, error, success, and retry behavior across the application.

## 8. Google authentication and security

### Premium authentication pages

Provide `/login` and `/signup` with a shared full-screen black layout, local SVG/CSS silver folded corner shapes matching the supplied login/signup screenshots, a restrained D mark, top-left Home link, and a centered 460–510px content column without a large bordered form card. Use headings “Log in to Daily Ledger” and “Create your Daily Ledger account”, reciprocal signup/login links, and one full-width “Continue with Google” action. As subsequently requested by the user, also provide email/password login and signup, with full name, email, and password on signup (restored at the user’s latest request), live requirements below the password field (at least 12 characters; mix of letters, numbers, and symbols), and a disabled submit action until requirements are met, and `/forgot-password` plus `/reset-password`. Do not add GitHub or magic-link authentication. Provide real `/terms` and `/privacy` routes.

Use a scoped, cleaned-up GSAP entrance sequence for brand, heading, subtitle, action, and footer; respect reduced motion. Keep corner art restrained and smaller on mobile, allow short-screen scrolling, and supply accessible focus and touch states. Handle session checks, redirect pending state, failures/retries, unavailable/unconfigured OAuth, and duplicate-click prevention. Validate internal return URLs in both browser and backend; never accept external redirects. Create an account only on a successful first Google callback and reuse the stable provider identity afterward. Redirect authenticated users to their validated destination. Inspect desktop/mobile authentication screenshots alongside the dashboard verification.

Use backend Google OAuth with routes such as:

- `GET /auth/google`
- `GET /auth/google/callback`
- `GET /auth/me`
- `POST /auth/logout`

Use Google’s stable provider user ID as the identity key. Request only identity/profile/email permissions needed for sign-in. Signing in must not request Gmail access.

Use PostgreSQL-backed server sessions, for example `express-session` and `connect-pg-simple`, with:

- HttpOnly cookies.
- Secure cookies in production.
- Appropriate SameSite settings.
- Session rotation after login.
- OAuth state validation.
- CSRF protection for state-changing requests.
- Input validation, sensible rate limits, and server-side authorization.

Do not store authentication/session tokens in localStorage or expose them in URLs. Email/password and Google use the same PostgreSQL-backed sessions, rotation, CSRF, and authorization. Hash passwords with salted scrypt; enforce 12–128 characters with a mix of letters, numbers, and symbols, and rate limits. Reset links are single-use, expire after one hour, and invalidate existing sessions on successful consumption. Store reset-token hashes only; deliver essential reset email through the durable backend Resend worker independently of optional reminder quotas. Do not silently link identities based only on an unverified email. Reset tokens may appear only in the emailed reset URL and must be removed from browser history after parsing, with a no-referrer policy.

Document production domains such as:

- `app.dailyledger.store` → Vercel frontend.
- `api.dailyledger.store` → Railway API.

These are proposed domains, not evidence that DNS is already configured. Use exact allowed frontend origins and credentialed requests. Never use wildcard CORS with credentials.

Prefer host-only session cookies unless broader cookie scope is explicitly necessary. Configure Express proxy handling correctly for Railway.

Document development and preview authentication separately. Unrelated `vercel.app` and `railway.app` sites do not automatically behave like sibling custom domains. Use an appropriate development proxy or a documented custom-domain setup instead of weakening production protections.

Keep Google secrets, database credentials, Resend keys, and payment secrets on the backend. Never expose them through frontend public environment variables.

## 9. Database and API contracts

Define the schema and shared contracts before building disconnected screens.

Include models as appropriate for users, sessions, preferences, transactions, categories, budgets, recurring schedules, tasks, habits, habit completions, workouts, meal plans, grocery items, goals, milestones, notifications, announcements, entitlements, automation rules, jobs, and delivery attempts.

Every private record must belong to an authorized user or workspace. Derive authorization from the authenticated session. Never trust a browser-supplied user ID as permission.

Enforce ownership in all reads, writes, searches, exports, and aggregates. Add database constraints and indexes for ownership, dates, statuses, and unique records.

Store timestamps in UTC and preserve the user’s IANA timezone. Define inclusive/exclusive period boundaries consistently.

Use shared Zod schemas/types, consistent errors, pagination, and documented filtering. Return aggregation metadata such as period and currency so the UI can label results correctly.

## 10. Plans and billing

Centralize server-side entitlements. Treat these initial prices and allowances as configurable product settings.

| Plan | Price | Initial allowance |
| --- | --- | --- |
| Free | $0 | 30 active tasks, 3 active habits, 3 active goals, 100 finance entries/month, basic/current-month reports, CSV export, in-app reminders |
| Pro | $20/month | Core usage without fixed count caps subject to reasonable abuse controls; full report history and PDF/CSV; recurring planning; 10 enabled automation rules; 150 optional reminder emails/month |
| Lifetime | $100 one-time | Core paid features; 5 enabled automation rules; 60 optional reminder emails/month; standard support |

Do not describe lifetime access as unlimited infrastructure or unlimited future costly services. Keep recurring revenue and one-time lifetime purchases separate in any billing metrics.

Show limits and remaining allowances. Enforce limits on the server and handle concurrent requests without allowing simple quota bypasses.

On downgrade, retain records and reading/export access. Restrict new above-limit actions and pause paid automation; do not delete user data.

The payment provider is not selected. Build a clean adapter and explicitly labeled development stub. Do not pretend production payments are working or activate paid entitlements from an unverified client redirect.

A real integration must verify webhook signatures, process events idempotently, and use verified server-side subscription/payment state.

## 11. Resend and durable automations

Send email only from the backend using Resend. Keep essential transactional messages separate from optional reminders and product-update preferences.

Use durable PostgreSQL jobs/outbox records and a short-lived Railway Cron worker. Browser timers, long sleeps, and frontend page visits must not determine reminder reliability.

Initial cron schedule: `*/5 * * * *`. Treat this as a delivery window, not an exact-second guarantee. Railway cron schedules use UTC; evaluate user-facing dates in the stored user timezone.

The worker should process bounded batches, close database connections, and exit. Use unique job keys, locks/leases, retries with backoff, delivery attempts, and appropriate status logs. Handle worker crashes without sending uncontrolled duplicates.

Recheck user eligibility, quotas, preferences, and current record state immediately before sending.

Default task reminder rule: an incomplete task remains overdue for 24 hours after its due time. Skip completed, deleted, or rescheduled tasks. A creation-time rule should be a separate explicit configuration.

Avoid Redis for this MVP unless an existing dependency or demonstrated requirement justifies it.

### Announcements

Admin announcements should support Everyone/Free/Pro/Lifetime targeting, priority, scheduled publication, expiry, and per-user/version read or dismiss state.

Optional follow-up email after 24 hours is permitted only when the announcement remains unread and the user’s preferences allow it. Protect admin routes using server-side role checks.

Publishing an announcement is not deploying application code. App updates should preserve unsaved work and avoid forced refreshes that lose input.

## 12. Implementation phases

### Phase 1 — Repository review and contracts

Inspect existing code and instructions. Identify reusable features and components. Define shared data types, metric formulas, database design, API boundaries, and a brief implementation plan.

### Phase 2 — Functional frontend first

Build the screenshot-matched shell and overview, then all feature pages. Implement responsive layouts, working forms, navigation, filters, charts, and quick add.

Use a replaceable data adapter and coherent demo seed records. Label demo mode clearly and keep demo-only persistence separate from production authentication. Avoid disconnected hardcoded totals.

Inspect desktop and mobile screenshots against the reference and correct obvious differences before moving on.

### Phase 3 — Railway backend and database

Implement Express, PostgreSQL/Prisma migrations, Google authentication, sessions, authorization, and APIs. Replace the demo adapter with real requests without rebuilding the UI.

Provide a local PostgreSQL setup, preferably Docker Compose, so development does not require production credentials. Keep demo seeds isolated and do not seed production automatically.

### Phase 4 — SaaS functionality

Implement entitlements, report exports, recurring records, job worker, reminder emails, and announcements. Integrate production billing only after a provider and credentials are supplied.

### Phase 5 — Verification and deployment preparation

Run appropriate type checks, linting, production builds, and meaningful tests. Document frontend/API deployment, custom domains, OAuth callback configuration, migrations, and the cron service.

Continue through work that is possible without credentials. Clearly identify missing external configuration and never claim an unconfigured integration has been verified.

## 13. Acceptance criteria

- Desktop overview closely matches the attached reference.
- Mobile/tablet layouts are usable without overflow.
- All sidebar routes, forms, filters, and quick-add actions work.
- Cards, charts, tables, and exports agree on totals, currency, and date range.
- Charts use useful labels, tooltips, and genuine records.
- Empty, loading, failure, validation, and retry states work.
- User A cannot access user B’s records or exports.
- Paid limits are enforced on the server.
- Authentication is secure and logout invalidates the session.
- Reminder jobs handle completion, deletion, rescheduling, and duplicate attempts correctly.
- Reduced motion and keyboard navigation work.

Use meaningful tests for authorization, financial calculations, timezone boundaries, plan limits, and reminder eligibility. Add billing idempotency tests when a provider is implemented. Avoid tests that only restate component markup.

Verify visual behavior at 360px, 390px, 768px, 1024px, 1440px, and 1920px. Run the production build and inspect desktop/mobile screenshots. Use existing test tooling where possible.

## 14. Required deliverables

- Working frontend and backend source.
- Database schema and committed migrations.
- Safe `.env.example` files containing placeholders only.
- Local development instructions and clearly separated demo seeds.
- API documentation or a clear endpoint reference.
- Deployment README for Vercel and Railway.
- Exact setup steps for Google OAuth, Resend, domains, migrations, and cron.
- Brief completion report: implemented features, verification performed, and remaining external configuration.

Do not introduce unrelated features, unnecessary services, fake production integrations, or secrets in source control. The result should move cleanly from a screenshot-matched frontend demo to a real Railway-backed SaaS.

## 15. Premium workspace refinement

Apply the login/signup visual polish to all feature pages: compact headings, balanced card proportions, dark gradient surfaces, subtle borders, readable secondary text, and consistent controls. Keep the dashboard composition while using the supplied project logo in its sidebar and refining the donut into a larger, thicker colorful segmented ring with rounded ends, a centered total, category hover detail, and interactive amount/percentage legends.

Prioritize user value from actual shared records: remaining monthly budget, daily spending average, largest category, due and high-priority tasks, habit calendars, active training days/minutes, meal coverage and grocery cost, goal remainder and milestones. Preserve the selected month when drilling into transactions. Paginate transaction lists and provide practical mobile transaction rows; contain scroll rather than rendering an endlessly tall table.

Use normal decimal currency inputs with exact conversion to stored minor units. Present linked goals/meals by name, prefill context when adding milestones or meals, and avoid exposing record IDs or storage implementation details in forms. Use Monday–Sunday meal weeks and align habit calendars with weekdays. Keep honest empty states when no records exist.

The latest signup requirement includes Full name, Email, and Password, with live password requirements below the password field. Google sign-in remains available alongside email/password. Do not add GitHub.
# Finance workflow, admin and AI additions (October 5, 2026)

The latest user requests extend the existing implementation. Preserve the dashboard composition and working authentication/backend. Use locally hosted Poppins, compact black/charcoal surfaces, thin borders, restrained mint/ice accents and Lucide icons. The sidebar shows only the supplied logo at the top, without adjacent Daily Ledger text; accessible link names remain. Use compact navigation rows and a subtle selected state.

Finance has an overview and clear option cards/menu leading to `/finance/income`, `/finance/bills`, `/finance/budgets`, `/finance/savings`, `/finance/transactions`, `/finance/recurring` and `/finance/calculators`; each child page includes a Back link. Calculator options open dedicated loan, growth, goal, percentage, debt and profit pages. Avoid nested tab bars. Income sources and bills are reusable monthly manual plans with pause/resume, edit/remove and actual-date received/paid confirmation. Confirmation creates one owner-scoped linked transaction per plan/month, safely deduplicated. Expected income is separate from received income. The overview shows actual cash flow, unpaid bills, expected income, category spending and budget progress. Positive income/net results use mint green, losses/overruns use restrained red with explicit labels.

Support monthly/category budgets, repeating limits, custom category choices, currency-filtered savings goals and manual savings contributions. Monthly limits override repeating limits for the same category; overall budgets take precedence over the category-total allowance. Savings contributions change the goal, not income. All six calculators validate inputs, describe assumptions and present estimates separately from recorded money. Keep existing automatic recurring schedules distinct from manually confirmed plans. Forms use concise labels, normal decimal money, contained scrolling, fixed modal headings, accessible controls and mobile-friendly layouts.

Add separate `/admin/login` email/password authentication without public admin signup. Use a database-enforced singleton active administrator, secure hidden-input server CLI selection/password/reset/transfer commands, session rotation, CSRF, rate limiting and per-request grant/version validation. Ordinary user sessions do not grant admin access. Changing administrators revokes previous access and sessions.

Admin routes: Overview, Users, Plans & Subscriptions, Announcements, Automations & Email, Platform Reports, AI Settings & Usage, Platform Settings and Activity Log under `/admin`. Keep the interface minimal with the supplied logo, reusable loading skeletons, GSAP cleanup and responsive tables/drawer. Show actual aggregate registrations/activity/plans/jobs/delivery/AI usage; define activity and periods. Revenue requires verified payments and remains separated by recurring/Lifetime kind and currency. User detail pages expose account administration and aggregate usage, not private entries or chat content. Support audited suspension/reactivation, session revocation, expiring reasoned manual overrides, allowance configuration with effective dates/affected-account review, plain-text draft/scheduled announcements with validated CTAs/read/dismissal state, eligible deduplicated retries/cancellation and an explicit admin-only test email.

Add `/assistant` to the user sidebar. It provides read-only chat/history, suggested questions, pending/retry/error and genuine unconfigured states. Use a configurable backend provider adapter without selecting/purchasing a provider automatically. Compute totals in shared deterministic functions; supply only the current user's minimum requested context and treat all stored text as untrusted data. Provide no write or email tools. Store usage metadata separately from conversation text, enforce monthly request/token limits atomically and support history deletion without resetting allowances. Admin AI settings provide enablement, provider/model metadata, per-plan quotas, aggregated request/failure/token data, optional reliably priced cost estimates and instruction revision history. Keys stay in environment variables.

Every important admin action records actor, target, time, mandatory reasons where applicable and redacted changes. Installation and local tests must not send real email, publish real announcements or create a real administrator automatically. Document external configuration and verify unauthorized access, transfers, suspension, entitlements, delivery deduplication, AI isolation/limits and responsive layouts.

## First-login setup, paced reveal and navigation polish

Real accounts with null `onboardingCompletedAt` complete a four-step wizard: full name, optional persona, optional module focus, and currency/timezone plus optional referral. Demo mode skips setup. POST /api/onboarding is authenticated, CSRF protected, validated, idempotent and writes the existing profile fields through the same preferences helper. Persona and focus never change admin role or billing.

After a successful save, a scoped GSAP-only Building your dashboard component gates the real dashboard. A tunable 5,000ms frontend reveal checks off actual persisted setup/preferences/persona; the final tick waits for a fresh snapshot. Errors preserve saved setup and offer retry. Reduced motion skips the cosmetic duration. No backend sleep or fabricated building job is used.

The root client provider preserves the workspace shell, state and snapshot across Next.js client-side route navigation. Only newly requested content shows genuine loading. The sidebar has a centered supplied logo with no adjacent branding or workspace selector, charcoal selection with no extra left line, and contained dark navigation scrolling on short screens. The spending donut is larger and thicker with distinct category colors, a stable centered total and non-overlapping hover details. Tiny percentages remain accurate instead of rounded to zero.

## Useful feature charts

Tasks show current status of the selected month’s due tasks, a four-week workload/completion comparison, and scheduled-habit consistency over time. Completions use server-stamped timestamps, not due dates; older undated completions are explicitly excluded from completion history while their real due dates still contribute to workload. Fitness shows daily logged minutes and Meals shows actual planned meal counts. Charts use Recharts custom dark styling and scoped GSAP entrances, with no invented history or duplicate chart animations.

### Latest empty-state and onboarding polish

The sidebar displays the Daily Ledger mark and name on the left, with black/charcoal styling. Real dashboard headings welcome the saved profile name. Persona selection advances to focus; a single focus advances to preferences, while an explicit multiple-focus toggle allows several selections. The optional referral never submits the final step automatically.

Empty charts and record lists share a local metallic illustration, restrained silver glow and contextual create action. Creating a relevant record replaces the empty content with actual records/charts. The ring rotates slowly with scoped GSAP, pauses offscreen or in hidden tabs, and is static under reduced motion. Center glyphs remain stationary and bold for readability.

Initial account/session resolution uses a neutral branded pending screen. Do not render the dashboard shell or dashboard skeleton before the snapshot establishes whether first-login onboarding is required. Subsequent snapshot refreshes reuse the session CSRF token instead of repeating the identity request; authorization remains enforced by every backend request.
