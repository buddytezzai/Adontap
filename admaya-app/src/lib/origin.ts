// Defence in depth on top of SameSite=Lax cookies: a state-changing request that names an Origin must
// name OUR origin. Requests with no Origin header (curl, server-to-server) are not browser CSRF and pass.

export class CrossOriginError extends Error {
  constructor() {
    super("Cross-origin request blocked");
  }
}

export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host =
    (process.env.TRUST_PROXY === "true" ? req.headers.get("x-forwarded-host") : null) ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new CrossOriginError();
  }
  if (originHost !== host) throw new CrossOriginError();
}
