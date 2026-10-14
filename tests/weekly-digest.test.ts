import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoSnapshot} from '@ledger/shared';
import {weeklyDigest} from '../apps/api/src/push';
test('Monday digest summarises the week from the account\'s own records, and stays silent with nothing to say',()=>{
 const s=demoSnapshot();const digest=weeklyDigest(s.records,'USD','UTC',new Date('2026-09-30T08:30:00Z'));
 assert.ok(digest);assert.equal(digest!.title,'Your week in review');assert.equal(digest!.url,'/today');
 assert.ok(digest!.body.length>10&&digest!.body.length<=240);
 assert.equal(weeklyDigest([],'USD','UTC',new Date('2026-09-30T08:30:00Z')),null);
});
