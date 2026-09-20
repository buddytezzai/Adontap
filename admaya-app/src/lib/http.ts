import { ZodError } from "zod";
import { CrossOriginError } from "./origin";
import { ConflictError, NotFoundError } from "./templates";
import { firstIssue } from "./validation";

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: NO_STORE });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new BadRequestError("Request body must be valid JSON");
  }
}

export class BadRequestError extends Error {}
export class UnauthorizedError extends Error {}
export class TooManyRequestsError extends Error {}

/** Wraps a route handler body and maps known errors to clean JSON responses. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ZodError) return json({ error: firstIssue(e) }, 400);
    if (e instanceof BadRequestError) return json({ error: e.message }, 400);
    if (e instanceof UnauthorizedError) return json({ error: e.message }, 401);
    if (e instanceof TooManyRequestsError) return json({ error: e.message }, 429);
    if (e instanceof CrossOriginError) return json({ error: e.message }, 403);
    if (e instanceof NotFoundError) return json({ error: e.message }, 404);
    if (e instanceof ConflictError) return json({ error: e.message }, 409);
    console.error("[api] unhandled error", e);
    return json({ error: "Something went wrong" }, 500);
  }
}
