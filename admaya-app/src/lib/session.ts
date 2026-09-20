import "server-only";

// One place that signs and verifies session JWTs. Admin and customer sessions share the signing key but
// carry different `aud` claims, so a customer token can never be replayed as an admin token (or vice versa).

import { jwtVerify, SignJWT } from "jose";

export type SessionAudience = "admin" | "customer";

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  // No fallback on purpose: a built-in default would let anyone who reads the source forge sessions.
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set to a long random string (openssl rand -base64 32)");
  return new TextEncoder().encode(s);
}

export async function signSession(aud: SessionAudience, sub: string, email: string, days: number): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(secret());
}

/** The token's subject if it is valid, unexpired and issued for `aud`; otherwise null. */
export async function readSession(aud: SessionAudience, token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"], audience: aud });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
