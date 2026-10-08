// Loaded only by the disposable OTP integration process. No real emails are sent.
import {appendFileSync} from 'node:fs';
if(process.env.NODE_ENV!=='test'||!process.env.TEST_DATABASE_URL||!process.env.OTP_TEST_MAILBOX)throw new Error('Resend fixture requires an isolated test process.');
const original=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 if(url==='https://api.resend.com/emails'){
  const body=JSON.parse(options.body);
  if(!String(body.to).endsWith('@example.com'))throw new Error('Only synthetic email addresses are allowed.');
  if(process.env.OTP_TEST_FAIL_EMAIL==='true'||String(body.to).endsWith('-fail@example.com'))return new Response(JSON.stringify({name:'validation_error',message:'Fixture delivery failure'}),{status:422,headers:{'content-type':'application/json'}});
  appendFileSync(process.env.OTP_TEST_MAILBOX,JSON.stringify(body)+'\n');
  return new Response(JSON.stringify({id:'fixture-email'}),{status:200,headers:{'content-type':'application/json'}});
 }
 return original(input,options);
};
