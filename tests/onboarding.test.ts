import {test} from 'node:test';
import assert from 'node:assert/strict';
import {onboardingSchema} from '../packages/shared/src/index';
test('onboarding validates identity, persona, focus, currency and timezone',()=>{
 const input={name:'Ledger User',currency:'PKR',timezone:'Asia/Karachi',persona:'Developer',focusAreas:['finance','tasks'],referralSource:'A friend'};
 assert.equal(onboardingSchema.parse(input).persona,'Developer');assert.equal(onboardingSchema.parse({name:'User',currency:'USD',timezone:'UTC'}).persona,null);
 for(const invalid of [{name:''},{persona:'admin'},{focusAreas:['finance','finance']},{focusAreas:['private-admin']},{currency:'XXX'},{timezone:'not/a-zone'},{referralSource:'x'.repeat(121)}])assert.equal(onboardingSchema.safeParse({...input,...invalid}).success,false);
});
