# Product and interface refinements

The user's latest direction keeps the dashboard composition, applies the login/signup polish to feature pages, replaces the donut treatment, and prioritizes useful information. These changes are implemented in the existing application.

## Research used

- [Monarch budgeting documentation](https://help.monarchmoney.com/hc/en-us/articles/360048883631-Budgets) describes monthly cash-flow planning and visibility into money remaining. Daily Ledger now surfaces the remaining monthly budget alongside actual income, spending, net savings, and a readable spending plan.
- [YNAB reporting](https://www.ynab.com/blog/ynab-reports-and-data) demonstrates period/category filters and category-to-transaction drill-down. Daily Ledger preserves the selected month when drilling into categories and uses the same records for charts, transactions, and exports.
- [YNAB targets](https://support.ynab.com/how-to-use-targets-rk5kkI9ks) emphasizes progress and target alerts. Daily Ledger shows goal remainder, completed milestones, deadline attention, and budget overrun states without inventing goal forecasts.
- [NN/g dashboard guidance](https://www.nngroup.com/articles/dashboards-preattentive/) explains the importance of clear quantitative comparisons. The requested donut remains, with thinner rounded segments, clear amounts/percentages, category hover details, and accessible interactive legends. Precise comparison comes from the accompanying numbers rather than angles alone.

## Implemented decisions

| Area | Useful information and interaction |
| --- | --- |
| Finance | Net savings, budget remaining, daily spending average, largest spending category, date-preserving category drill-down, filtered CSV, paginated transactions, mobile transaction rows, budget editing |
| Tasks and habits | Due/open and completed counts, high-priority view, scheduled-day consistency, aligned monthly habit calendars, side-by-side desktop layout |
| Fitness | Active days, total minutes, average session, weekly training chart, concise scrollable workout log, honest empty chart |
| Meals | Monday–Sunday weeks across month boundaries, context-aware day/meal creation, grocery remainder and estimated cost, meals linked by name |
| Goals | Remaining target value, milestone completion, overdue target attention, goal-linked milestone creation without exposing record IDs |
| Settings/reports/help | Consistent typography, compact sections, dark gradient surfaces, clear controls, city timezone selection, readable report rows |
| Shared forms | Normal decimal currency inputs with exact conversion to integer minor units; named relationship selectors and contextual defaults |
| Branding | Supplied Daily Ledger logo on dashboard, loading/error states, login/signup, recovery, and legal pages |

The interface uses restrained GSAP entrances, real pending skeletons, reduced-motion support, and touch-sized mobile controls. No banking balances, exchange conversions, calorie data, financial advice, or forecasts are fabricated from records that do not contain them.
