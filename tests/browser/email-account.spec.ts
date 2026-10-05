import { test,expect } from '@playwright/test';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
test('real email signup opens an empty account, then logs in to the same workspace',async({page})=>{
 test.skip(!process.env.TEST_DATABASE_URL,'Disposable PostgreSQL required');
 const email=`browser-${randomUUID()}@example.com`,password='My private ledger 42!';
 const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});
 try{
  await page.goto('/signup');
  await page.getByLabel('Full name').fill('Browser Test');
  await expect(page.getByRole('button',{name:'Create account',exact:true})).toBeDisabled();
  await page.getByLabel('Email',{exact:true}).fill(email);
  await page.getByLabel('Password',{exact:true}).fill('twelvecharacters');
  await expect(page.getByRole('button',{name:'Create account',exact:true})).toBeDisabled();
  await page.getByLabel('Password',{exact:true}).fill(password);
  await expect(page.locator('.password-requirements .met')).toHaveCount(2);
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your life at a glance'})).toBeVisible();
  await expect(page.getByText('DEMO WORKSPACE',{exact:false})).toHaveCount(0);
  await expect(page.getByLabel('Selected month')).toHaveValue(new Date().toISOString().slice(0,7));
  await expect(page.getByText('Ahad Noor',{exact:true})).toHaveCount(0);
  await expect(page.getByText('No spending recorded in this period.',{exact:true})).toBeVisible();
  await page.context().clearCookies();
  await page.goto('/login?returnTo=%2Ffinance');
  await page.getByLabel('Email',{exact:true}).fill(email);
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Log in',exact:true}).click();
  await expect(page).toHaveURL(/\/finance$/);
  await expect(page.getByRole('heading',{name:'Financial Planner',exact:true})).toBeVisible();
 }finally{
  await pool.query('DELETE FROM session WHERE sess->\'passport\'->>\'user\' IN (SELECT id FROM "User" WHERE email=$1)',[email]);
  await pool.query('DELETE FROM "User" WHERE email=$1',[email]);
  await pool.end();
 }
});
