# Load test (k6)

Run this only against a disposable LOCAL copy. `seed.ts` refuses any database that is not on localhost.

1. Create an empty local database, run `npm run db:migrate` against it.
2. `LOAD_DATABASE_URL=<local db> SESSION_SECRET=<secret the API will use> tsx tests/load/seed.ts users.json` (10,000 users, 50 records each, a live session each).
3. Start the API with that database and the same `SESSION_SECRET`, `NODE_ENV=development`.
4. `k6 run -e SCENARIO=browse|login|mixed|spike|tabs|tabsonly -e BASE=http://localhost:4200 -e USERS=users.json tests/load/k6.js`

`tabs` models open browser tabs: the web app refreshes identity and the snapshot every 15 seconds (apps/web/components/ledger-app.tsx, `refetchInterval:15000`), so 133 tab refreshes per second is about 2,000 tabs open at once.
