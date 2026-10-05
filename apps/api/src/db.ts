import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
export const pool=new pg.Pool({connectionString:process.env.DATABASE_URL, max:8});
export const db=new PrismaClient({adapter:new PrismaPg(pool)});
