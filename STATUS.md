# Daily Ledger: project status

Last updated: 14 October 2026. Read this first. It separates what is built and tested from what is still open.

## Built and verified locally

| Area | What exists | Where |
| --- | --- | --- |
| Dashboard | Gradient KPI cards, cash-flow chart, gauge donut that sweeps 0 to 100, budget pulse, smart insights | `apps/web/components/ledger-app.tsx`, `dashboard-charts.tsx`, `spending-chart.tsx`, `spending-insights.tsx` |
| Finance | KPI row, budget-vs-actual pace chart, recommendations from the user's own budgets and last month, donut with legend, insights, income, bills, budgets, savings, recurring, calculators | `finance-workspace.tsx`, `finance-overview.tsx`, `lib/recommendations.ts` |
| Monthly Report | Month-only report: totals, animated cash-flow wave, donut, habit wave, task ring, week-by-week table, spending by category, goal progress, CSV and PDF export | `reports-view.tsx` |
| Budgets | Monthly and per-category budgets, red bars from 80 percent, in-app and browser alerts at 80 and 100 percent (once per budget, month and threshold) | `finance-workspace.tsx`, `apps/api/src/service.ts` |
| Bank import | CSV import with column, date and decimal detection, preview, duplicate-safe re-import, plan limits, exact cents | `csv-import.tsx`, `apps/api/src/import.ts` |
| Ledger assistant | Time-of-day greeting with the account name, real counts of open tasks and habits, Claude-style thread with word-by-word replies, confirm-to-run actions for tasks, expenses, habits, workouts, goals, meals and groceries | `ai-assistant.tsx`, `lib/daily-brief.ts`, `apps/api/src/ai-actions.ts` |
| Settings | Section sidebar (General, Notifications, Plan and usage, Billing and invoices, Referrals, Data), row layout, product tour replay | `ledger-app.tsx` (`Preferences`) |
| Suggestions | Data-driven strip on Overview, Tasks, Finance, Fitness, Meals and Goals; upgrade hints only near a real plan limit | `lib/suggestions.ts`, `page-suggestions.tsx` |
| Add or edit record | Slide-over drawer (bottom sheet on phones) | `ui/dialog.tsx` |
| Hold to confirm | Hold button for every delete, logout and maintenance switch | `hold-button.tsx` |
| Checkboxes and loader | iOS-style checkbox, bouncing-balls loader instead of skeleton blocks | `app/redesign.css`, `skeleton.tsx` |
| Product tour | Auto-starts once after onboarding; Next, Back, Skip; replay from Settings | `product-tour.tsx` |
| Payment confirmation page | `/billing/success` waits for the server-confirmed plan, then shows the animated plan-active page with benefits | `plan-activated.tsx` |
| Startup effect | Empty dashboards rev their gauges once and settle on zero | `ignition.tsx` |
| Fonts | Inter for interface text and tabular numbers, Manrope for headings and large numbers, bundled locally | `app/layout.tsx`, `app/fonts/` |
| Trial and plans | 7-day no-card Pro trial (`TRIAL_MODE`), usage meters, billing history panel | `apps/api/src/billing.ts` |
| Admin | Users, plans and revenue, announcements, automations, reports, AI, platform settings, admin audit log | `admin-app.tsx`, `apps/api/src/admin.ts` |
| Admin: user activity | Per-account timeline, sign-in counts, failed sign-ins, record counts by type, global filterable log, 180-day retention | `apps/api/src/activity.ts` |
| Admin: maintenance mode | Toggle with message and expected end; customers see a maintenance page, admin tools stay open | `apps/api/src/server.ts`, `maintenance-screen.tsx` |
| Hosting | Separate app and admin on Vercel, one shared API and PostgreSQL and a 5-minute worker on Railway | `DEPLOYMENT.md`, `railway.*.json` |

## Not built yet

| Item | Why it matters | What is needed from the owner |
| --- | --- | --- |
| Whop payments (checkout, signature-verified webhook, refunds, expiry) | No paid plan can be bought yet. The payment page only reflects a plan the server has confirmed. | Whop account, sandbox API key, webhook secret and the two plan IDs |
| Annual plan | Easiest revenue lift | Price decision |
| Monday weekly-review notification | Retention; the weekly data already exists in the report | Confirm wording and send time |
| Starter templates in onboarding (student, freelancer, family) | Faster first-day value | Confirm the three templates |
| Referral rewards (for example one month of Pro) | Only ranking exists today | Reward rules |
| Bank sync (Plaid style) | CSV import covers the need for now | Provider choice |
| Shared rate-limit store | Limits are in memory, so run exactly one API replica | None until you scale beyond one replica |
| Content-Security-Policy header | Hardening | None |

## Needed before launch (owner actions)

1. Railway and Vercel projects, domain and DNS (`DEPLOYMENT.md`).
2. Resend: verified sending domain, otherwise signup and password reset cannot send codes.
3. Google OAuth client (optional but recommended).
4. VAPID keys for browser notifications.
5. Terms and Privacy pages: add the business name and contact. Mention the AI provider and the shortened IP addresses kept in the activity log for 180 days.
6. PostgreSQL backups and uptime or error monitoring.
7. `TRUST_PROXY_HOPS=2`, `BILLING_STUB_ENABLED=false`, `NODE_ENV=production`, a strong `SESSION_SECRET`.

## Known limits

- Never verified live: Google sign-in, real e-mail delivery, real push delivery, Cloudinary uploads, a real AI provider, a hosted deployment.
- The 3D anatomy browser test fails in the headless sandbox only (software WebGL); it loads and rotates in a real browser.
- One API replica only, until the rate-limit store is shared.
