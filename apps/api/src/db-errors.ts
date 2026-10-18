// Recognises "the database cannot be reached right now" so clients get a temporary 503 instead of a generic 500.
// Only known connectivity signals count. Constraint violations, bad SQL and programming errors are NOT matched and stay 500s.
const NETWORK = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE']);
// Prisma: P1001 unreachable, P1002 timed out reaching it, P1008 operation timed out, P1017 server closed the connection, P2024 pool timeout.
const PRISMA = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);
// PostgreSQL: 08xxx connection exceptions, 57P01 admin shutdown, 57P02 crash shutdown, 57P03 cannot connect now, 53300 too many connections.
const PG = new Set(['57P01', '57P02', '57P03', '53300']);
const ADAPTER_KINDS = new Set(['DatabaseNotReachable', 'ConnectionClosed', 'TooManyConnections', 'SocketTimeout']);
const MESSAGES = /timeout exceeded when trying to connect|Connection terminated|terminating connection|the database system is (starting up|shutting down)|Client has encountered a connection error/i;

export function isDatabaseUnavailable(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== 'object' || depth > 4) return false;
  const e = error as {code?: unknown; message?: unknown; cause?: unknown; errors?: unknown; meta?: {driverAdapterError?: {cause?: {kind?: unknown}}}};
  const code = typeof e.code === 'string' ? e.code : '';
  if (NETWORK.has(code) || PRISMA.has(code) || PG.has(code) || /^08/.test(code)) return true;
  const kind = e.meta?.driverAdapterError?.cause?.kind;
  if (typeof kind === 'string' && ADAPTER_KINDS.has(kind)) return true;
  if (typeof e.message === 'string' && MESSAGES.test(e.message)) return true;
  if (isDatabaseUnavailable(e.cause, depth + 1)) return true;
  return Array.isArray(e.errors) && e.errors.some(inner => isDatabaseUnavailable(inner, depth + 1));
}
