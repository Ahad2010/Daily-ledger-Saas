import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderEmail,renderText} from '../apps/api/src/email-template';

test('the verification code is one selectable block, with no remote images and no script',()=>{
 const html=renderEmail({preheader:'Your code is 719879.',heading:'Confirm your email',blocks:[{type:'code',text:'719879'}]});
 assert.match(html,/<table/);assert.match(html,/user-select:all/);assert.ok(html.includes('>719879<'),'the code is a single text node, so one double-click selects all of it');
 assert.match(html,/Double-click, or tap and hold, the code to copy it/);
 assert.ok(!/<img/i.test(html),'nothing depends on remote images');assert.ok(!/<script/i.test(html));
});

test('all text is escaped and the call to action keeps its link and a fallback',()=>{
 const html=renderEmail({preheader:'x',heading:'<b>Hi</b>',blocks:[{type:'p',text:'a <script>alert(1)</script> & b'},{type:'list',items:['one <i>two</i>']}],cta:{label:'Open Daily Ledger',url:'https://app.example.com/?a=1&b="2"'}});
 assert.ok(!html.includes('<script>alert'));assert.ok(!html.includes('<b>Hi</b>'));assert.match(html,/&lt;script&gt;/);
 assert.match(html,/Open Daily Ledger/);assert.match(html,/href="https:\/\/app\.example\.com\/\?a=1&amp;b=&quot;2&quot;"/);assert.match(html,/Button not working\?/);
});

test('the plain-text twin carries the same content',()=>{
 const text=renderText({preheader:'x',heading:'Welcome',blocks:[{type:'p',text:'Hello'},{type:'list',items:['a','b']}],cta:{label:'Open',url:'https://x.test'}});
 assert.match(text,/Welcome/);assert.match(text,/- a/);assert.match(text,/Open: https:\/\/x\.test/);
});
