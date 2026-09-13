# Deploy the backend (Empty/) to Vercel — runbook

The backend is now Vercel-ready:
- `server.ts` exports the Express `app` and skips `app.listen()` when `process.env.VERCEL` is set.
- `api/index.ts` is the serverless entrypoint.
- `vercel.json` routes all requests to it via `@vercel/node`.

I could not deploy for you: the Vercel connection available to me has **no access to your account** (403 on the `deepmention` project, `teams: []`), and a deploy needs your Vercel login, which I can't perform. Run the steps below yourself.

## Steps (≈10 min)

```bash
cd Empty
npx vercel login            # log into YOUR Vercel account
npx vercel link             # create/link a project (e.g. "deepmention-api")
```

### Set environment variables in Vercel
The function needs the same secrets as `Empty/.env`. At minimum for signup/OTP:
- `DATABASE_URL`
- `EMAIL_PROVIDER=brevo`
- `BREVO_API_KEY`
- `EMAIL_FROM_ADDRESS=welcome@deepmention.xyz`
- `EMAIL_FROM_NAME=DeepMention`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (whatever names `src/utils/jwt.ts` uses)
- **`OTP_HASH_SECRET`** — REQUIRED. OTPs are stored as a keyed HMAC; the code **fails closed** and registration throws if this is missing or empty. Copy the value from `Empty/.env`, or generate a new one with `openssl rand -hex 32` (note: a new value invalidates any OTP issued in the previous 10 minutes).
- `CORS_ALLOWED_ORIGINS` — only needed if the frontend is served from an origin outside the built-in allowlist (`deepmention.xyz`, `www.`, `app.`, localhost). A `*.vercel.app` preview URL **must** be added here or the browser will block every API call.
- **`DB_SSL_CA`** — on Vercel use this (the PEM *contents*), NOT `DB_SSL_CA_PATH`. The serverless bundler only includes files that are `import`ed, so a runtime `fs.readFileSync` of `certs/prod-ca-2021.crt` can fail with ENOENT. Paste the contents of `Empty/certs/prod-ca-2021.crt` into this variable. (Docker/Cloud Run keeps using `DB_SSL_CA_PATH`; the Dockerfiles now `COPY certs ./certs`.)
- `NODE_ENV=production`
- Redis/Upstash vars (several routes import BullMQ at load, so the function needs Redis reachable or it can crash on cold start)

Fastest way to push them all:
```bash
# review .env first, then:
npx vercel env pull            # sanity check current
# or add them from the dashboard: Project > Settings > Environment Variables
```

### Deploy
```bash
npx vercel --prod              # prints your backend URL, e.g. https://deepmention-api.vercel.app
```

### Point the frontend at the new backend
Either:
- **A (recommended):** map `api.deepmention.xyz` (Vercel domain) to this new project, so the existing frontend keeps working unchanged; or
- **B:** set `Empty_UI1/frontend/.env.production` → `VITE_BACKEND_BASE_URL=https://<your-new-backend>.vercel.app` (and `VITE_AGENTS_BASE_URL` similarly if you deploy the agents service), then redeploy the frontend.

## Important caveats
- **Only the HTTP API runs on Vercel.** The BullMQ workers (`worker:scrape`, `worker:sources`) and schedulers (`scheduler:weekly-email`, daily scraper) are long-running and will NOT run on Vercel. Signup/OTP/dashboards work; scraping/weekly-emails need a separate always-on host (Cloud Run — the Dockerfiles are already set up for that).
- This serverless adaptation is **untested** (I can't deploy). If cold starts fail, the usual cause is a route importing BullMQ/Redis at module load with Redis unreachable — set the Redis env vars, or lazy-import the queue in the affected routes.
- Alternative that avoids all of this: find where the backend used to live (it once answered at `api.deepmention.xyz`) — if it's still on Cloud Run, just re-point the DNS instead of moving to Vercel.
