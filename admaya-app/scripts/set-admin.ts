// Create an admin login, or reset its password.
//   npm run admin:set -- someone@example.com "a-long-password"
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !/^\S+@\S+\.\S+$/.test(email) || !password || password.length < 10) {
    console.error('Usage: npm run admin:set -- <email> "<password, at least 10 characters>"');
    process.exit(1);
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const normalised = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 10);
    const existing = await prisma.adminUser.findUnique({ where: { email: normalised } });
    await prisma.adminUser.upsert({ where: { email: normalised }, update: { passwordHash }, create: { email: normalised, passwordHash } });
    console.log(`${existing ? "Password reset for" : "Admin created:"} ${normalised}`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
