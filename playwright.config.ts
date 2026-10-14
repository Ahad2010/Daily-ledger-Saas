import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',timeout:120000,expect:{timeout:20000},use:{storageState:'./tests/browser/storage-state.json',baseURL:process.env.WEB_TEST_URL||'http://localhost:3000',headless:true,screenshot:'only-on-failure'},workers:1,reporter:'list'});
