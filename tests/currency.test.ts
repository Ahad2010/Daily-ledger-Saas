import {test} from 'node:test';
import assert from 'node:assert/strict';
import {currencyOptions,currencySchema,preferenceSchema,money} from '@ledger/shared';
test('worldwide currency preferences share supported codes and preserve existing amount storage',()=>{assert.ok(currencyOptions.length>150);for(const code of ['USD','PKR','EUR','GBP','JPY','KWD','INR','AUD','SAR','AED','ZAR']){assert.ok(currencyOptions.includes(code));assert.ok(currencySchema.safeParse(code).success);assert.ok(preferenceSchema.safeParse({name:'Test',currency:code,timezone:'UTC',optionalEmails:false,productUpdates:false}).success);assert.ok(money(12345,code).includes('123.45'));}assert.equal(currencySchema.safeParse('ZZZ').success,false);assert.equal(currencySchema.safeParse('usd').success,false);});
