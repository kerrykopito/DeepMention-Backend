import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'prisma/config'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder"
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
  : undefined

export default defineConfig({
  earlyAccess: true,
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: connectionString,
  },
  migrate: {
    async adapter() {
      return new PrismaPg({ connectionString, ssl })
    },
  },
})
