import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword,verifyPassword,matchesReset,tokenHash } from '../apps/api/src/passwords';
test('password hashes are salted and checked in constant time; reset token tampering fails',async()=>{const password='correct horse battery staple';const first=await hashPassword(password);const second=await hashPassword(password);assert.notEqual(first,second);assert.ok(!first.includes(password));assert.equal(await verifyPassword(password,first),true);assert.equal(await verifyPassword('wrong password',first),false);assert.equal(await verifyPassword(password,undefined),false);assert.equal(matchesReset('abc',tokenHash('abc')),true);assert.equal(matchesReset('xyz',tokenHash('abc')),false);});

test('new hashes carry their cost; old Node-default hashes still verify and are flagged for upgrade',async()=>{
 const {scryptSync,randomBytes}=await import('node:crypto');
 const {needsRehash}=await import('../apps/api/src/passwords');
 const fresh=await hashPassword('a fine long passphrase 123!');
 assert.match(fresh,/^scrypt2:16:8:2:/);assert.equal(needsRehash(fresh),false);assert.equal(await verifyPassword('a fine long passphrase 123!',fresh),true);assert.equal(await verifyPassword('wrong',fresh),false);
 const salt=randomBytes(24).toString('hex'),legacy=`scrypt:${salt}:${scryptSync('old password 123!',salt,64).toString('hex')}`;
 assert.equal(await verifyPassword('old password 123!',legacy),true);assert.equal(needsRehash(legacy),true);
 assert.equal(await verifyPassword('x',undefined),false);assert.equal(await verifyPassword('x','scrypt2:99:8:2:aa:bb'),false,'out-of-range cost is rejected');
});
