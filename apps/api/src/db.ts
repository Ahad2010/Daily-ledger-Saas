import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
export const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:8,connectionTimeoutMillis:10000,idleTimeoutMillis:30000});
// An idle client dropped by a database restart emits 'error'; unhandled, it would crash the whole API process.
pool.on('error',error=>console.error('PostgreSQL idle client error:',error.message));
export const db=new PrismaClient({adapter:new PrismaPg(pool)});
