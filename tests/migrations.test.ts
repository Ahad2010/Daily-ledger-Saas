import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {kinds} from '@ledger/shared';
// The database check on Record.kind must list every record kind the app can save, or saving that kind fails in production.
test('the latest Record_kind_check migration allows every shared record kind', () => {
 const root=resolve('apps/api/prisma/migrations');
 const files=readdirSync(root).filter(d=>/^\d+_/.test(d)).sort().map(d=>readFileSync(resolve(root,d,'migration.sql'),'utf8')).filter(sql=>sql.includes('ADD CONSTRAINT "Record_kind_check"'));
 const latest=files.at(-1)!;
 const allowed=[...latest.matchAll(/'([A-Za-z]+)'/g)].map(m=>m[1]);
 for(const kind of kinds)assert.ok(allowed.includes(kind),`Record_kind_check does not allow "${kind}"`);
});
