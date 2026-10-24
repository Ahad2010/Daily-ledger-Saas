import test from 'node:test';
import assert from 'node:assert/strict';
import {levelAt,xpToReach,tierAt} from '../apps/web/lib/fitness-xp';

test('levels climb with XP and each level starts exactly at its threshold',()=>{
 assert.equal(levelAt(0),1);assert.equal(levelAt(99),1);assert.equal(levelAt(100),2);assert.equal(levelAt(299),2);assert.equal(levelAt(300),3);assert.equal(levelAt(1000),5);
 for(let level=1;level<60;level++){assert.equal(levelAt(xpToReach(level)),level);assert.equal(levelAt(xpToReach(level+1)-1),level);}
});
test('ranks change at 5, 10, 20, 30 and 45',()=>{
 assert.equal(tierAt(1).name,'Rookie');assert.equal(tierAt(4).name,'Rookie');assert.equal(tierAt(5).name,'Mover');assert.equal(tierAt(10).name,'Athlete');assert.equal(tierAt(20).name,'Warrior');assert.equal(tierAt(30).name,'Champion');assert.equal(tierAt(45).name,'Legend');
});
