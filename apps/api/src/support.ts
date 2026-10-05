import {Router,type Request} from 'express';
import rateLimit from 'express-rate-limit';
import {z} from 'zod';
import {db} from './db.js';
import type {Prisma} from '@prisma/client';
import {HttpError} from './service.js';
const statusSchema=z.enum(['open','in_progress','resolved']);
const bodySchema=z.string().trim().min(10,'Please include a little more detail.').max(4000);
const createSchema=z.object({subject:z.string().trim().min(5).max(160),category:z.enum(['account','finance','tasks','billing','bug','other']),priority:z.enum(['low','normal','high']),body:bodySchema});
const replySchema=z.object({body:z.string().trim().min(1,'Write a message before sending.').max(4000),version:z.number().int().positive()});
const pageSchema=z.coerce.number().int().min(1).max(10000).default(1);
export function supportRoutes(admin=false){
 const router=Router();
 const limiter=rateLimit({windowMs:3600000,limit:admin?120:30,keyGenerator:req=>req.user!.id,standardHeaders:true,legacyHeaders:false,message:{error:'Too many support messages. Please try again later.'}});
 router.get('/',async(req,res)=>{
  const page=pageSchema.parse(req.query.page);const q=z.string().max(160).default('').parse(req.query.q);
  const status=req.query.status?statusSchema.parse(req.query.status):undefined;
  const owner=admin?{}:{userId:req.user!.id};
  const where={...owner,...(status?{status}:{}),...(q?{subject:{contains:q,mode:'insensitive' as const}}:{})};
  const [total,tickets,counts]=await Promise.all([db.supportTicket.count({where}),db.supportTicket.findMany({where,orderBy:{updatedAt:'desc'},skip:(page-1)*20,take:20,include:{_count:{select:{messages:true}},...(admin?{user:{select:{name:true,email:true}}}:{})}}),db.supportTicket.groupBy({by:['status'],where:owner,_count:true})]);
  res.json({tickets,total,page,limit:20,counts:Object.fromEntries(counts.map(c=>[c.status,c._count]))});
 });
 if(!admin)router.post('/',limiter,async(req,res)=>{
  const input=createSchema.parse(req.body);const user=await db.user.findUniqueOrThrow({where:{id:req.user!.id}});
  const {body,...data}=input;
  const ticket=await db.supportTicket.create({data:{...data,userId:user.id,messages:{create:{role:'user',authorName:user.name,body}}},include:{messages:true}});
  res.status(201).json(ticket);
 });
 router.get('/:id',async(req,res)=>{const ticket=await db.supportTicket.findFirst({where:{id:String(req.params.id),...(admin?{}:{userId:req.user!.id})},include:{messages:{orderBy:{createdAt:'asc'}},...(admin?{user:{select:{name:true,email:true}}}:{})}});if(!ticket)throw new HttpError(404,'Ticket not found.');res.json(ticket);});
 async function assertAdmin(req:Request,tx:Prisma.TransactionClient){
  // Keep the grant stable for the entire audited mutation.
  await tx.$queryRaw`SELECT id FROM "AdminAccess" WHERE id=1 FOR UPDATE`;
  const access=await tx.adminAccess.findUnique({where:{id:1}});
  if(!access?.active||access.userId!==req.user!.id||req.session.adminVersion!==access.version)throw new HttpError(403,'Administrator access changed. Sign in again.');
 }
 router.post('/:id/messages',limiter,async(req,res)=>{
  const input=replySchema.parse(req.body);const id=String(req.params.id);
  const result=await db.$transaction(async tx=>{
   if(admin)await assertAdmin(req,tx);
   await tx.$queryRaw`SELECT id FROM "SupportTicket" WHERE id=${id} FOR UPDATE`;
   const ticket=await tx.supportTicket.findFirst({where:{id,...(admin?{}:{userId:req.user!.id})}});
   if(!ticket)throw new HttpError(404,'Ticket not found.');
   if(ticket.version!==input.version)throw new HttpError(409,'This conversation changed. Refresh it before sending your reply.');
   const user=await tx.user.findUniqueOrThrow({where:{id:req.user!.id}});
   const message=await tx.supportMessage.create({data:{ticketId:id,role:admin?'admin':'user',authorName:admin?'Daily Ledger Support':user.name,body:input.body}});
   await tx.supportTicket.update({where:{id},data:{version:{increment:1},status:admin?ticket.status:'open'}});
   if(admin)await tx.adminAudit.create({data:{actorId:user.id,action:'support-reply',target:id,changes:{messageId:message.id}}});
   return message;
  });res.status(201).json(result);
 });
 if(admin)router.patch('/:id',async(req,res)=>{
  const {status,version}=z.object({status:statusSchema,version:z.number().int().positive()}).parse(req.body);const id=String(req.params.id);
  await db.$transaction(async tx=>{await assertAdmin(req,tx);const result=await tx.supportTicket.updateMany({where:{id,version},data:{status,version:{increment:1}}});if(!result.count)throw new HttpError(409,'Ticket changed. Refresh and retry.');await tx.adminAudit.create({data:{actorId:req.user!.id,action:'support-status',target:id,changes:{status}}});});res.json({ok:true});
 });
 return router;
}
