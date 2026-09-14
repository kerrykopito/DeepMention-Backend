import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!;
  // Verify the DB server certificate by default (prevents MITM of the DB link).
  // Local dev against a cert not in the trust store: set DB_SSL_REJECT_UNAUTHORIZED=false.
  // Production verify-full: supply Supabase's CA via DB_SSL_CA (PEM contents) or
  // DB_SSL_CA_PATH (file path).
  const ssl = connectionString.includes("supabase.co")
    ? {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
        ca: process.env.DB_SSL_CA
          ? process.env.DB_SSL_CA
          : process.env.DB_SSL_CA_PATH
            ? fs.readFileSync(process.env.DB_SSL_CA_PATH, "utf8")
            : undefined,
      }
    : undefined;
  // One connection per instance, not the pg default of ten. On Vercel each concurrent
  // function instance evaluates this module separately and gets its own pool, so a default
  // pool multiplies by the number of warm instances: a handful of them is enough to exhaust
  // Postgres and start answering "too many connections" — a 500, not a slow page. Serverless
  // scales by adding instances, so each one needs exactly one connection.
  const adapter = new PrismaPg({ connectionString, ssl, max: 1, idleTimeoutMillis: 10_000 });
  return new PrismaClient({ adapter });
}

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
