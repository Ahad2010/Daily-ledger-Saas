import 'dotenv/config';
import { defineConfig } from 'prisma/config';
export default defineConfig({schema:'prisma/schema.prisma',migrations:{path:'prisma/migrations'},datasource:{url:process.env.DATABASE_URL||'postgresql://ledger:ledger_local@localhost:5432/ledger'}});
