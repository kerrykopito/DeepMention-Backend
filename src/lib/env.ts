import dotenv from "dotenv"
import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const candidatePaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../../../.env"),
  path.resolve(__dirname, "../../../agents/.env"),
  path.resolve(__dirname, "../../.env"),
]

for (const envPath of candidatePaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false })
  }
}

// Where the customer's browser gets sent back to: Stripe's back arrow (cancel_url), the post-checkout
// success page, the billing portal return, and the weekly email's "Open dashboard" button.
//
// Every one of those call sites used to inline `?? "http://localhost:5173"`. In production that
// fallback does not fail — it silently hands a real paying customer a dead localhost link. Fail loudly
// instead, at startup of the request rather than in the customer's browser.
export function resolveFrontendUrl(): string {
  const configured = process.env.FRONTEND_URL?.trim()
  if (configured) return configured.replace(/\/+$/, "")

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "FRONTEND_URL is not set. Stripe redirects and email links would point at localhost. " +
        "Set it on the deepmention-api deployment (e.g. https://deepmention.xyz)."
    )
  }
  return "http://localhost:5173"
}
