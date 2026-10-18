import express, {Router, type Request, type Response} from 'express';
import rateLimit from 'express-rate-limit';
import {createHmac, timingSafeEqual} from 'node:crypto';
import type {Prisma, User} from '@prisma/client';
import {db} from './db.js';
import {HttpError} from './service.js';

// Whop payments. Everything here stays switched off until the four required variables exist on the API:
//   WHOP_API_KEY, WHOP_PRO_PLAN_ID, WHOP_LIFETIME_PLAN_ID, WHOP_WEBHOOK_SECRET   (optional: WHOP_SANDBOX=true for sandbox)
// A plan is only ever granted by a signed webhook. Returning from checkout never activates anything by itself.
const env = (name: string) => (process.env[name] || '').trim();
export const whopConfigured = () => !!(env('WHOP_API_KEY') && env('WHOP_PRO_PLAN_ID') && env('WHOP_LIFETIME_PLAN_ID') && env('WHOP_WEBHOOK_SECRET'));
const base = () => (env('WHOP_SANDBOX') === 'true' ? 'https://sandbox-api.whop.com' : 'https://api.whop.com');
const TOLERANCE_SECONDS = 5 * 60;

function planFor(planId: string | undefined): 'Pro' | 'Lifetime' | null {
  if (!planId) return null;
  if (planId === env('WHOP_LIFETIME_PLAN_ID')) return 'Lifetime';
  if (planId === env('WHOP_PRO_PLAN_ID')) return 'Pro';
  return null;
}

// Standard Webhooks: signature = base64(HMAC-SHA256(secret, `${id}.${timestamp}.${rawBody}`)), sent as "v1,<sig>" (several may be listed).
export function verifySignature(rawBody: string, headers: {id?: string; timestamp?: string; signature?: string}, secret: string, now = Date.now()) {
  const {id, timestamp, signature} = headers;
  if (!id || !timestamp || !signature || !secret) return false;
  const seconds = Number(timestamp);
  if (!Number.isInteger(seconds) || Math.abs(now / 1000 - seconds) > TOLERANCE_SECONDS) return false;
  const keys = [Buffer.from(secret, 'utf8')];
  if (/^whsec_/.test(secret)) keys.push(Buffer.from(secret.slice(6), 'base64'));
  const supplied = signature.split(' ').map(part => part.split(',')).filter(part => part[0] === 'v1' && part[1]).map(part => Buffer.from(part[1]));
  return keys.some(key => {
    const expected = Buffer.from(createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest('base64'));
    return supplied.some(candidate => candidate.length === expected.length && timingSafeEqual(candidate, expected));
  });
}

export async function createCheckout(user: Pick<User, 'id'>, plan: 'Pro' | 'Lifetime') {
  if (!whopConfigured()) throw new HttpError(503, 'Payments are not configured. No charge or plan activation occurred.');
  const origin = (process.env.FRONTEND_ORIGIN || '').replace(/\/$/, '');
  const response = await fetch(`${base()}/api/v1/checkout_configurations`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${env('WHOP_API_KEY')}`},
    body: JSON.stringify({plan_id: plan === 'Pro' ? env('WHOP_PRO_PLAN_ID') : env('WHOP_LIFETIME_PLAN_ID'), redirect_url: `${origin}/?checkout=complete`, metadata: {userId: user.id, plan}}),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    console.error(`[whop] checkout creation failed: HTTP ${response.status} ${(await response.text().catch(() => '')).slice(0, 300)}`);
    throw new HttpError(502, 'The payment provider could not start checkout. Please try again.');
  }
  const body = (await response.json()) as {purchase_url?: string; url?: string};
  const url = body.purchase_url || body.url;
  if (!url || !/^https:\/\//.test(url)) throw new HttpError(502, 'The payment provider returned an unexpected response.');
  return {url};
}

// Cancels at the end of the paid period (the member keeps access until Whop sends membership.deactivated).
export async function cancelMembership(membershipId: string) {
  const response = await fetch(`${base()}/api/v1/memberships/${encodeURIComponent(membershipId)}/cancel`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${env('WHOP_API_KEY')}`},
    body: JSON.stringify({cancellation_mode: 'at_period_end'}),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    console.error(`[whop] cancel failed: HTTP ${response.status} ${(await response.text().catch(() => '')).slice(0, 300)}`);
    throw new HttpError(502, 'The payment provider could not cancel the subscription. Please try again or contact support.');
  }
}

// The newest Pro membership id we recorded for this user, or null.
export async function activeMembership(userId: string, client: Prisma.TransactionClient | typeof db = db) {
  const row = await client.billingRecord.findFirst({where: {userId, provider: 'whop', verified: true, subscriptionReference: {not: null}}, orderBy: {createdAt: 'desc'}, select: {subscriptionReference: true}});
  return row?.subscriptionReference ?? null;
}

type Obj = Record<string, any>;
const str = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
const minor = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
};

async function ownerOf(tx: Prisma.TransactionClient, data: Obj, membershipId?: string) {
  const meta = (data.metadata || data.checkout_configuration?.metadata || {}) as Obj;
  const id = str(meta.userId);
  if (id) {
    const user = await tx.user.findUnique({where: {id}});
    if (user) return user;
  }
  if (membershipId) {
    const known = await tx.billingRecord.findFirst({where: {provider: 'whop', subscriptionReference: membershipId}, select: {userId: true}});
    if (known) return tx.user.findUnique({where: {id: known.userId}});
  }
  return null;
}

async function grant(tx: Prisma.TransactionClient, user: User, plan: 'Pro' | 'Lifetime') {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
  const current = await tx.user.findUniqueOrThrow({where: {id: user.id}});
  if (current.plan === 'Lifetime' && current.entitlementSource === 'provider') return false; // never downgrade a lifetime member
  await tx.user.update({where: {id: user.id}, data: {plan, entitlementSource: 'provider', subscriptionCancelledAt: null}});
  await tx.entitlementOverride.deleteMany({where: {userId: user.id, grantedBy: 'trial'}});
  return true;
}

// Applies one verified event. Returns what happened, for the WebhookEvent log. Runs inside the same transaction that records the event id.
async function apply(tx: Prisma.TransactionClient, type: string, data: Obj): Promise<{outcome: string; cancelMembershipId?: string}> {
  const planId = str(data.plan?.id) || str(data.plan_id);
  const plan = planFor(planId);
  const isMembership = type.startsWith('membership.');
  const membershipId = isMembership ? str(data.id) : str(data.membership?.id) || str(data.membership_id);

  if (type === 'payment.succeeded') {
    const reference = str(data.id);
    if (!reference || !plan) return {outcome: 'ignored: unknown plan'};
    const user = await ownerOf(tx, data, membershipId);
    if (!user) return {outcome: 'unmatched: no owner'};
    const values = {userId: user.id, provider: 'whop', subscriptionReference: plan === 'Pro' ? membershipId ?? null : null, kind: plan === 'Lifetime' ? 'lifetime' : 'recurring', currency: (str(data.currency) || 'usd').toUpperCase(), amount: BigInt(minor(data.total ?? data.final_amount ?? data.subtotal)), status: 'paid', verified: true, receiptUrl: str(data.receipt_url) || null, description: plan === 'Lifetime' ? 'Daily Ledger Lifetime' : 'Daily Ledger Pro'};
    await tx.billingRecord.upsert({where: {reference}, create: {reference, ...values}, update: {status: 'paid', verified: true, amount: values.amount, currency: values.currency}});
    const granted = await grant(tx, user, plan);
    const previous = plan === 'Lifetime' ? await activeMembership(user.id, tx) : null;
    return {outcome: granted ? `granted ${plan}` : 'kept existing lifetime', ...(previous ? {cancelMembershipId: previous} : {})};
  }
  if (type === 'membership.activated') {
    if (!plan || !membershipId) return {outcome: 'ignored: unknown plan'};
    const user = await ownerOf(tx, data, membershipId);
    if (!user) return {outcome: 'unmatched: no owner'};
    if (plan === 'Lifetime') return {outcome: 'lifetime is granted by its payment'};
    return {outcome: (await grant(tx, user, 'Pro')) ? 'granted Pro' : 'kept existing lifetime'};
  }
  if (type === 'membership.deactivated') {
    if (!membershipId) return {outcome: 'ignored'};
    const record = await tx.billingRecord.findFirst({where: {provider: 'whop', subscriptionReference: membershipId}, orderBy: {createdAt: 'desc'}});
    if (!record) return {outcome: 'unmatched: unknown membership'};
    // Only the newest membership may end access; an old one finishing must not cancel a newer purchase.
    if ((await activeMembership(record.userId, tx)) !== membershipId) return {outcome: 'ignored: superseded membership'};
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${record.userId} FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({where: {id: record.userId}});
    if (user.plan === 'Pro' && user.entitlementSource === 'provider') {
      await tx.user.update({where: {id: user.id}, data: {plan: 'Free', entitlementSource: 'free'}});
      return {outcome: 'downgraded to Free'};
    }
    return {outcome: 'no change'};
  }
  if (type === 'membership.cancel_at_period_end_changed') {
    if (!membershipId) return {outcome: 'ignored'};
    const record = await tx.billingRecord.findFirst({where: {provider: 'whop', subscriptionReference: membershipId}, orderBy: {createdAt: 'desc'}});
    if (!record) return {outcome: 'unmatched: unknown membership'};
    await tx.user.update({where: {id: record.userId}, data: {subscriptionCancelledAt: data.cancel_at_period_end ? new Date() : null}});
    return {outcome: data.cancel_at_period_end ? 'cancellation scheduled' : 'cancellation withdrawn'};
  }
  if (type === 'payment.failed') {
    const reference = str(data.id);
    const user = reference ? await ownerOf(tx, data, membershipId) : null;
    if (!reference || !user || !plan) return {outcome: 'ignored'};
    await tx.billingRecord.upsert({where: {reference}, create: {reference, userId: user.id, provider: 'whop', subscriptionReference: null, kind: plan === 'Lifetime' ? 'lifetime' : 'recurring', currency: (str(data.currency) || 'usd').toUpperCase(), amount: BigInt(minor(data.total ?? data.final_amount)), status: 'failed', verified: true, description: 'Failed payment'}, update: {}});
    return {outcome: 'recorded failed payment'};
  }
  if (type === 'refund.created' || type === 'dispute.created') {
    const reference = str(data.payment?.id) || str(data.payment_id) || str(data.id);
    const record = reference ? await tx.billingRecord.findUnique({where: {reference}}) : null;
    if (!record) return {outcome: 'unmatched: unknown payment'};
    await tx.billingRecord.update({where: {reference: record.reference}, data: {status: type === 'refund.created' ? 'refunded' : 'disputed'}});
    // A refunded or disputed one-time purchase ends access. A subscription ends through its own membership.deactivated event.
    if (record.kind === 'lifetime') {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${record.userId} FOR UPDATE`;
      const user = await tx.user.findUniqueOrThrow({where: {id: record.userId}});
      if (user.plan === 'Lifetime' && user.entitlementSource === 'provider') await tx.user.update({where: {id: user.id}, data: {plan: 'Free', entitlementSource: 'free'}});
    }
    return {outcome: `marked ${type === 'refund.created' ? 'refunded' : 'disputed'}`};
  }
  return {outcome: 'ignored: unhandled type'};
}

export async function handleWebhook(req: Request, res: Response) {
  if (!whopConfigured()) return res.status(503).json({error: 'Payments are not configured.'});
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  const id = req.get('webhook-id') || '';
  if (!verifySignature(raw, {id, timestamp: req.get('webhook-timestamp') || '', signature: req.get('webhook-signature') || ''}, env('WHOP_WEBHOOK_SECRET'))) return res.status(400).json({error: 'Invalid signature.'});
  let event: Obj;
  try {
    event = JSON.parse(raw);
  } catch {
    return res.status(400).json({error: 'Invalid payload.'});
  }
  const type = str(event.type) || '';
  const data = (event.data && typeof event.data === 'object' ? event.data : {}) as Obj;
  let cancelAfter: string | undefined;
  try {
    const duplicate = await db.$transaction(async tx => {
      if (await tx.webhookEvent.findUnique({where: {id}})) return true;
      const result = await apply(tx, type, data);
      await tx.webhookEvent.create({data: {id, provider: 'whop', type: type.slice(0, 80), outcome: result.outcome.slice(0, 120)}});
      cancelAfter = result.cancelMembershipId;
      return false;
    });
    if (cancelAfter) await cancelMembership(cancelAfter).catch(error => console.error('[whop] could not cancel the old subscription:', error instanceof Error ? error.message : error));
    return res.status(200).json({ok: true, duplicate});
  } catch (error: any) {
    // Two deliveries of the same event racing each other: the loser hits the primary key and is a duplicate.
    if (error?.code === 'P2002') return res.status(200).json({ok: true, duplicate: true});
    console.error('[whop] webhook processing failed:', error instanceof Error ? error.message : error);
    return res.status(500).json({error: 'Webhook processing failed.'});
  }
}

// Mounted before the JSON parser: the signature covers the exact raw bytes.
export function whopWebhookRoutes() {
  const router = Router();
  router.post('/whop', rateLimit({windowMs: 60000, limit: 300, standardHeaders: true, legacyHeaders: false}), express.raw({type: () => true, limit: '256kb'}), handleWebhook);
  return router;
}
