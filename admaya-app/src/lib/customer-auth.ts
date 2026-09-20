import "server-only";

import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { readSession, signSession } from "./session";
import type { CustomerUserDTO } from "./types";

export const CUSTOMER_SESSION_COOKIE = "admaya_customer_session";
const SESSION_DAYS = 14;

const DUMMY_HASH = bcrypt.hashSync(randomUUID(), 10);

export class AccountExistsError extends Error {
  constructor() {
    super("An account with this email already exists");
  }
}

export interface CustomerSession {
  id: string;
  email: string;
}

const userSelect = { id: true, email: true, name: true, creditBalance: true } as const;

/**
 * Free starter credits granted at signup. Defaults to 0: with no email verification, a non-zero bonus is
 * free money for anyone who can type a fake address. Set SIGNUP_BONUS_CREDITS for local testing only.
 */
function signupBonus(): number {
  const n = Number(process.env.SIGNUP_BONUS_CREDITS ?? 0);
  return Number.isInteger(n) && n >= 0 && n <= 100_000 ? n : 0;
}

export async function createCustomer(email: string, password: string, name?: string): Promise<CustomerUserDTO> {
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    return await prisma.user.create({
      data: { email, passwordHash, name: name?.trim() || email.split("@")[0], creditBalance: signupBonus() },
      select: userSelect,
    });
  } catch (e) {
    // The unique index is the source of truth (a find-then-create check races).
    if ((e as { code?: string }).code === "P2002") throw new AccountExistsError();
    throw e;
  }
}

export async function verifyCustomerCredentials(email: string, password: string): Promise<CustomerUserDTO | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return null;
  return { id: user.id, email: user.email, name: user.name, creditBalance: user.creditBalance };
}

export async function startCustomerSession(user: CustomerSession): Promise<void> {
  const token = await signSession("customer", user.id, user.email, SESSION_DAYS);
  (await cookies()).set(CUSTOMER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endCustomerSession(): Promise<void> {
  (await cookies()).delete(CUSTOMER_SESSION_COOKIE);
}

export async function getCustomerUser(): Promise<CustomerUserDTO | null> {
  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!token) return null;
  const sub = await readSession("customer", token);
  if (!sub) return null;
  return prisma.user.findUnique({ where: { id: sub }, select: userSelect });
}

/**
 * Takes `amount` from the wallet in ONE conditional statement (`... WHERE creditBalance >= amount`).
 * Returns false — and changes nothing — if the balance is too low, so two concurrent requests can never
 * both spend the same credits or push the balance negative.
 */
export async function chargeCredits(userId: string, amount: number): Promise<boolean> {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Invalid charge amount");
  const res = await prisma.user.updateMany({
    where: { id: userId, creditBalance: { gte: amount } },
    data: { creditBalance: { decrement: amount } },
  });
  return res.count === 1;
}

export async function refundCredits(userId: string, amount: number): Promise<void> {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Invalid refund amount");
  await prisma.user.update({ where: { id: userId }, data: { creditBalance: { increment: amount } } });
}

/** Adds credits. Only ever call this from a verified payment webhook, or the dev-only top-up. */
export async function addCredits(userId: string, amount: number): Promise<number> {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Invalid credit amount");
  const user = await prisma.user.update({
    where: { id: userId },
    data: { creditBalance: { increment: amount } },
    select: { creditBalance: true },
  });
  return user.creditBalance;
}
