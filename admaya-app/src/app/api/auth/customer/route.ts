import {
  addCredits,
  AccountExistsError,
  createCustomer,
  endCustomerSession,
  getCustomerUser,
  startCustomerSession,
  verifyCustomerCredentials,
} from "@/lib/customer-auth";
import { BadRequestError, handle, json, readJson, TooManyRequestsError, UnauthorizedError } from "@/lib/http";
import { assertSameOrigin } from "@/lib/origin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { customerLoginSchema, customerRegisterSchema, firstIssue } from "@/lib/validation";

export const dynamic = "force-dynamic";

const MAX_DEV_TOPUP = 10_000;

export function GET() {
  return handle(async () => json({ user: await getCustomerUser() }));
}

export function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const raw = await readJson(req);
    const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const ip = clientIp(req);

    switch (body.action) {
      case "register": {
        const parsed = customerRegisterSchema.safeParse(body);
        if (!parsed.success) throw new BadRequestError(firstIssue(parsed.error));
        if (!rateLimit(`register:${ip}`, 5, 60 * 60_000).ok) throw new TooManyRequestsError("Too many sign-ups from this network. Try again later.");
        try {
          const user = await createCustomer(parsed.data.email, parsed.data.password, parsed.data.name);
          await startCustomerSession({ id: user.id, email: user.email });
          return json({ ok: true, user });
        } catch (e) {
          if (e instanceof AccountExistsError) return json({ error: e.message }, 409);
          throw e;
        }
      }

      case "login": {
        const parsed = customerLoginSchema.safeParse(body);
        if (!parsed.success) throw new BadRequestError(firstIssue(parsed.error));
        const { email, password } = parsed.data;
        if (!rateLimit(`clogin:${ip}:${email}`, 10, 10 * 60_000).ok || !rateLimit(`clogin-acct:${email}`, 20, 10 * 60_000).ok) {
          throw new TooManyRequestsError("Too many attempts. Try again in a few minutes.");
        }
        const user = await verifyCustomerCredentials(email, password);
        if (!user) throw new UnauthorizedError("Invalid email or password");
        await startCustomerSession({ id: user.id, email: user.email });
        return json({ ok: true, user });
      }

      case "logout": {
        await endCustomerSession();
        return json({ ok: true });
      }

      case "topup": {
        // Credits must only ever come from a verified payment. Until a payment gateway is wired in, the one
        // exception is a local-development convenience that is impossible to enable in production.
        const devTopup = process.env.ALLOW_DEV_TOPUP === "true" && process.env.NODE_ENV !== "production";
        if (!devTopup) return json({ error: "Adding credits requires online payment, which isn't available yet." }, 403);
        const user = await getCustomerUser();
        if (!user) throw new UnauthorizedError("Please sign in first");
        const credits = body.credits;
        if (typeof credits !== "number" || !Number.isInteger(credits) || credits < 1 || credits > MAX_DEV_TOPUP) {
          throw new BadRequestError(`credits must be a whole number between 1 and ${MAX_DEV_TOPUP}`);
        }
        return json({ ok: true, creditBalance: await addCredits(user.id, credits) });
      }

      default:
        throw new BadRequestError("Unknown action");
    }
  });
}
