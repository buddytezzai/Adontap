import "server-only";

// Read/write operations for the /admin operations pages (orders, wallets, provider status, account).
// Everything here is admin-only; callers are the /admin pages and /api/admin/* handlers.

import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { ConflictError, NotFoundError } from "./templates";

// ───────────────────────── orders & renders ─────────────────────────

export interface RenderRow {
  id: string;
  createdAt: string;
  templateTitle: string;
  customer: string | null; // null = guest (simulated render, nothing charged)
  chargedInr: number; // total taken, incl. GST
  status: string;
  prompt: string;
}

export interface OrdersSummary {
  totalRenders: number;
  paidRenders: number;
  guestRenders: number;
  revenueInr: number;
}

export async function getOrdersAndRenders(limit = 200): Promise<{ summary: OrdersSummary; rows: RenderRow[] }> {
  const [rows, total, paid, guests, revenue] = await Promise.all([
    prisma.generation.findMany({ orderBy: { createdAt: "desc" }, take: limit, include: { user: { select: { email: true } } } }),
    prisma.generation.count(),
    prisma.generation.count({ where: { chargeInr: { gt: 0 } } }),
    prisma.generation.count({ where: { userId: null } }),
    prisma.generation.aggregate({ _sum: { chargeInr: true, gstInr: true } }),
  ]);
  return {
    summary: {
      totalRenders: total,
      paidRenders: paid,
      guestRenders: guests,
      revenueInr: (revenue._sum.chargeInr ?? 0) + (revenue._sum.gstInr ?? 0),
    },
    rows: rows.map((g) => ({
      id: g.id,
      createdAt: g.createdAt.toISOString(),
      templateTitle: g.templateTitle,
      customer: g.user?.email ?? null,
      chargedInr: g.chargeInr + g.gstInr,
      status: g.status,
      prompt: g.assembledPrompt,
    })),
  };
}

// ───────────────────────── credit wallets ─────────────────────────

export interface WalletRow {
  id: string;
  email: string;
  name: string | null;
  creditBalance: number;
  renders: number;
  joinedAt: string;
  lastAdjustment: { amount: number; reason: string; by: string; at: string } | null;
}

export async function listWallets(): Promise<{ rows: WalletRow[]; totalCredits: number }> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { generations: true } },
      creditAdjustments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  return {
    totalCredits: users.reduce((s, u) => s + u.creditBalance, 0),
    rows: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      creditBalance: u.creditBalance,
      renders: u._count.generations,
      joinedAt: u.createdAt.toISOString(),
      lastAdjustment: u.creditAdjustments[0]
        ? { amount: u.creditAdjustments[0].amount, reason: u.creditAdjustments[0].reason, by: u.creditAdjustments[0].adminEmail, at: u.creditAdjustments[0].createdAt.toISOString() }
        : null,
    })),
  };
}

/** Adds (+) or removes (−) credits and writes the audit row in one transaction. A removal can never take the balance below 0. */
export async function adjustCredits(userId: string, amount: number, reason: string, adminEmail: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const res = await tx.user.updateMany({
      where: amount < 0 ? { id: userId, creditBalance: { gte: -amount } } : { id: userId },
      data: { creditBalance: amount < 0 ? { decrement: -amount } : { increment: amount } },
    });
    if (res.count !== 1) {
      const exists = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!exists) throw new NotFoundError("Customer not found");
      throw new ConflictError("That would take the balance below zero");
    }
    const { creditBalance } = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { creditBalance: true } });
    await tx.creditAdjustment.create({ data: { userId, amount, balanceAfter: creditBalance, reason, adminEmail } });
    return creditBalance;
  });
}

// ───────────────────────── provider / system status ─────────────────────────

export type StatusLevel = "ok" | "warn" | "off";
export interface StatusRow {
  name: string;
  level: StatusLevel;
  label: string;
  detail: string;
}

/** Whether things are configured — never their values. */
export async function getSystemStatus(): Promise<StatusRow[]> {
  const env = process.env;
  let dbOk = true;
  try {
    await prisma.$queryRaw`select 1`;
  } catch {
    dbOk = false;
  }
  const prod = env.NODE_ENV === "production";
  return [
    { name: "Database (Postgres)", level: dbOk ? "ok" : "warn", label: dbOk ? "Connected" : "Unreachable", detail: "Single source of truth for templates, customers and renders." },
    {
      name: "Render provider — Higgsfield / Seedance",
      level: env.HIGGSFIELD_API_KEY ? "ok" : "off",
      label: env.HIGGSFIELD_API_KEY ? "Key set" : "Not configured",
      detail: env.HIGGSFIELD_API_KEY
        ? "Real renders run only for signed-in customers with enough credits. Guests always get the simulated preview."
        : "All renders are simulated previews. Set HIGGSFIELD_API_KEY in .env to enable real renders.",
    },
    { name: "Render providers — HeyGen, Runway, Google Veo", level: "off", label: "Not built yet", detail: "Templates on these engines use the simulated preview." },
    { name: "Payments (credit top-ups)", level: "off", label: "Not built yet", detail: "Customers can't buy credits yet. Use Credit Wallets to grant credits manually." },
    {
      name: "Meta Ad Library",
      level: "off",
      label: env.META_ACCESS_TOKEN ? "Token set, live sync not built" : "Stub data",
      detail: "Ad Intelligence uses stub ads. The live Meta adapter isn't implemented yet.",
    },
    {
      name: "24-hour cleanup job",
      level: env.CRON_SECRET && env.CRON_SECRET.length >= 16 ? "ok" : "warn",
      label: env.CRON_SECRET && env.CRON_SECRET.length >= 16 ? "Secret set" : "CRON_SECRET missing",
      detail: "POST /api/cron/cleanup must be called on a schedule (Vercel Cron, crontab…) to delete expired files.",
    },
    {
      name: "Session secret",
      level: env.SESSION_SECRET && env.SESSION_SECRET.length >= 16 ? "ok" : "warn",
      label: env.SESSION_SECRET && env.SESSION_SECRET.length >= 16 ? "Set" : "Missing / too short",
      detail: "Signs admin and customer sign-in cookies.",
    },
    {
      name: "Trusted proxy (rate limiting)",
      level: env.TRUST_PROXY === "true" ? "ok" : prod ? "warn" : "off",
      label: env.TRUST_PROXY === "true" ? "Enabled" : "Off",
      detail: "Set TRUST_PROXY=true behind Vercel/nginx/Cloudflare so per-visitor limits work.",
    },
    {
      name: "Dev-only credit top-up",
      level: env.ALLOW_DEV_TOPUP === "true" && !prod ? "warn" : "ok",
      label: env.ALLOW_DEV_TOPUP === "true" && !prod ? "ON (local dev)" : "Off",
      detail: "Lets a signed-in customer add credits without paying. Never active in production.",
    },
    { name: "Signup bonus credits", level: Number(env.SIGNUP_BONUS_CREDITS) > 0 ? "warn" : "ok", label: `${Number(env.SIGNUP_BONUS_CREDITS) > 0 ? Number(env.SIGNUP_BONUS_CREDITS) : 0} credits`, detail: "Free credits given to each new account. Keep at 0 until signups are email-verified." },
  ];
}

// ───────────────────────── admin account ─────────────────────────

export async function changeAdminPassword(adminId: string, currentPassword: string, newPassword: string): Promise<void> {
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin || !(await bcrypt.compare(currentPassword, admin.passwordHash))) throw new ConflictError("Current password is incorrect");
  await prisma.adminUser.update({ where: { id: adminId }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
}
