import "server-only";

// MVP admin auth: email + bcrypt password in the AdminUser table, a signed JWT in an httpOnly
// cookie. Deliberately simple — see the README for what "production-grade" would add.

import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { assertSameOrigin } from "./origin";
import { readSession, signSession } from "./session";

export const SESSION_COOKIE = "admaya_admin";
const SESSION_DAYS = 7;

// Compared against when the email is unknown, so "no such user" and "wrong password" take the same time.
const DUMMY_HASH = bcrypt.hashSync(randomUUID(), 10);

export interface AdminSession {
  id: string;
  email: string;
}

export async function verifyCredentials(email: string, password: string): Promise<AdminSession | null> {
  const user = await prisma.adminUser.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  return user && ok ? { id: user.id, email: user.email } : null;
}

export async function startSession(admin: AdminSession): Promise<void> {
  const token = await signSession("admin", admin.id, admin.email, SESSION_DAYS);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The signed-in admin, or null. Re-checks the user still exists, so deleting a user revokes access. */
export async function getAdmin(): Promise<AdminSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const sub = await readSession("admin", token);
  if (!sub) return null;
  return prisma.adminUser.findUnique({ where: { id: sub }, select: { id: true, email: true } });
}

/** For server components/layouts under /admin. */
export async function requireAdminPage(): Promise<AdminSession> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/**
 * For /api/admin/* route handlers. Returns the admin, or a ready-made error Response.
 * Mutations must also come from our own origin (defence in depth on top of SameSite=Lax).
 */
export async function requireAdminApi(req: Request): Promise<AdminSession | Response> {
  if (!["GET", "HEAD"].includes(req.method)) {
    try {
      assertSameOrigin(req);
    } catch {
      return Response.json({ error: "Cross-origin request blocked" }, { status: 403 });
    }
  }
  const admin = await getAdmin();
  if (!admin) return Response.json({ error: "Not signed in" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return admin;
}
