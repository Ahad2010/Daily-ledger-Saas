import {test} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {isDatabaseUnavailable} from '../apps/api/src/db-errors';
import {HttpError} from '../apps/api/src/service';

test('connectivity failures are recognised, in every shape the stack produces',()=>{
 assert.equal(isDatabaseUnavailable(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'),{code:'ECONNREFUSED'})),true,'pg / session store');
 assert.equal(isDatabaseUnavailable(Object.assign(new Error('x'),{code:'P1001'})),true,'Prisma cannot reach');
 assert.equal(isDatabaseUnavailable(Object.assign(new Error('Raw query failed'),{code:'P2010',meta:{driverAdapterError:{cause:{kind:'DatabaseNotReachable'}}}})),true,'Prisma raw query via adapter');
 assert.equal(isDatabaseUnavailable(Object.assign(new Error('x'),{code:'57P01'})),true,'server shutting down');
 assert.equal(isDatabaseUnavailable(Object.assign(new Error('x'),{code:'08006'})),true,'connection exception class');
 assert.equal(isDatabaseUnavailable(new Error('timeout exceeded when trying to connect')),true,'pool exhausted');
 assert.equal(isDatabaseUnavailable(new Error('Connection terminated unexpectedly')),true);
 assert.equal(isDatabaseUnavailable(Object.assign(new AggregateError([Object.assign(new Error('a'),{code:'ECONNREFUSED'})],'multi'))),true,'IPv4+IPv6 aggregate');
 assert.equal(isDatabaseUnavailable(new Error('wrapper',{cause:Object.assign(new Error('inner'),{code:'ETIMEDOUT'})})),true,'wrapped cause');
});

test('everything else stays an ordinary error',()=>{
 assert.equal(isDatabaseUnavailable(new TypeError("Cannot read properties of undefined (reading 'id')")),false,'programming error');
 assert.equal(isDatabaseUnavailable(Object.assign(new Error('Unique constraint failed'),{code:'P2002'})),false);
 assert.equal(isDatabaseUnavailable(Object.assign(new Error('Record not found'),{code:'P2025'})),false);
 assert.equal(isDatabaseUnavailable(Object.assign(new Error('relation "x" does not exist'),{code:'42P01'})),false,'bad SQL');
 assert.equal(isDatabaseUnavailable(Object.assign(new Error('canceling statement due to statement timeout'),{code:'57014'})),false,'a slow query is not an outage');
 assert.equal(isDatabaseUnavailable(new HttpError(403,'This account is suspended.')),false);
 assert.equal(isDatabaseUnavailable(new HttpError(403,'Upgrade','UPGRADE_REQUIRED')),false);
 assert.equal(isDatabaseUnavailable((()=>{try{z.string().parse(1);}catch(e){return e;}})()),false);
 for(const v of [null,undefined,'ECONNREFUSED',42,{}])assert.equal(isDatabaseUnavailable(v),false);
 const loop:any={code:'X'};loop.cause=loop;assert.equal(isDatabaseUnavailable(loop),false,'cyclic causes terminate');
});
