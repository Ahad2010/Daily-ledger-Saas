import type {Prisma} from '@prisma/client';
import {preferenceSchema} from '@ledger/shared';
import {db} from './db.js';
// Both preferences and first-login setup write the same profile fields.
export function savePreferences(userId:string,input:unknown,client:Prisma.TransactionClient|typeof db=db){return client.user.update({where:{id:userId},data:preferenceSchema.partial().parse(input)});}
