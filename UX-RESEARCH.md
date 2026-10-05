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

## Practical finance tools

Dedicated option pages reduce nested navigation. Planned income and bills stay separate from received/paid transactions; confirmation creates one linked transaction per month. Category budgets can repeat, and savings goals show a manual contribution rather than silently reducing spendable cash. Calculators show assumptions and handle zero interest, insufficient repayment and negative profit. Compound growth follows starting principal, monthly contributions, return and term ([Investor.gov](https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator)); loan estimates distinguish interest and principal and explicitly exclude fees, taxes and insurance ([CFPB](https://www.consumerfinance.gov/ask-cfpb/how-does-paying-down-a-mortgage-work-en-1943/)). Poppins is locally bundled with its OFL license.
# Exercise and planning references — 5 October 2026

The exercise detail text is an original concise summary, with its ACE source linked on each page. It includes setup, three movement steps, common mistakes, easier variations, equipment and primary/secondary muscle targets. The generated training illustration is approximate and does not claim clinical anatomy precision.

- [ACE exercise library](https://www.acefitness.org/resources/everyone/exercise-library/) — body-part/equipment filtering and sourced movement instructions.
- [ACE hamstring study](https://contentcdn.eacefitness.com/February2018/ACE_HamstringsStudy.pdf) — Romanian deadlift and seated leg curl context.
- [Hevy routines](https://www.hevyapp.com/features/gym-routines/) — reusable routines with editable sets/repetitions and workout logging.
- [Eat This Much](https://www.eatthismuch.com/how-to/) — editable weekly meal planning.
- [Canada healthy plate](https://www.canada.ca/en/health-canada/services/food-guide/eating-support/cooking/make-healthy-meals-plate.html) — produce, whole grains and protein-food proportions.
- [National Academies protein reference](https://www.ncbi.nlm.nih.gov/books/NBK610205/) — general healthy-adult 0.8 g/kg reference, not an athlete or measured meal target.
- [NIH Body Weight Planner](https://www.niddk.nih.gov/bwp) — calorie planning needs more than weight alone.

- [MyPlate weekly planning](https://www.myplate.gov/eathealthy/budget/budget-weekly-meals) — breakfast, lunch, dinner and snacks, kitchen inventory and connected shopping.
- [CDC meals and snacks](https://www.cdc.gov/healthy-weight-growth/healthy-eating/meals-snacks.html) — editable meal ideas, portions and planning. Optional nutrition is entered from labels/recipes; the application does not estimate intake from dish names.
