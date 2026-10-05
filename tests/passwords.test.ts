import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword,verifyPassword,matchesReset,tokenHash } from '../apps/api/src/passwords';
test('password hashes are salted and checked in constant time; reset token tampering fails',async()=>{const password='correct horse battery staple';const first=await hashPassword(password);const second=await hashPassword(password);assert.notEqual(first,second);assert.ok(!first.includes(password));assert.equal(await verifyPassword(password,first),true);assert.equal(await verifyPassword('wrong password',first),false);assert.equal(await verifyPassword(password,undefined),false);assert.equal(matchesReset('abc',tokenHash('abc')),true);assert.equal(matchesReset('xyz',tokenHash('abc')),false);});
