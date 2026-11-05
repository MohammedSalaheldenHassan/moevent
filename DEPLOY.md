# Deploying Nexus Youth on Railway

Nexus Youth runs as **three Railway services** from this one repo, plus your existing Supabase project:

| Service | What it is | Config file |
|---|---|---|
| **API** | Express API (bookings, emails, stats, admin actions) | `deploy/railway/api.railway.json` |
| **Site** | Public booking website | `deploy/railway/site.railway.json` |
| **Dashboard** | Admin dashboard | `deploy/railway/dashboard.railway.json` |

Each service builds from a Dockerfile in `deploy/railway/`. The site and dashboard are served by Caddy, which adds the security headers (Content-Security-Policy, HSTS, etc.). All database migrations in `supabase/migrations/` are already applied.

## 1. Point each service at its config file

For **each** service: *Settings → Config-as-code → Railway Config File* and enter its path from the table above. Leave *Root Directory* empty (the repo root): the Dockerfiles need the whole monorepo.

That's all the build setup: no build or start commands to type. Each service only rebuilds when its own files change.

If you already have API and dashboard services, switch them to these config files. For the site, **add a new service** from the same GitHub repo.

## 2. Variables

Set these under each service's **Variables** tab. `https://…` values are your Railway domains (Settings → Networking → *Generate Domain*, or a custom domain).

### API service

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **service_role** (secret!) |
| `CORS_ORIGINS` | **Required:** `https://<site domain>,https://<dashboard domain>`, comma-separated, no trailing slash. Without it the site and dashboard can't reach the API (the API logs an error at startup). |
| `BREVO_API_KEY` / `MAIL_FROM` | **Use this on Railway Free/Hobby, which blocks SMTP.** Brevo (free, 300 emails/day) → *SMTP & API → API keys*; `MAIL_FROM` = `Nexus Youth <address@gmail.com>`, an address verified under *Senders*. |
| `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Only on a plan that allows SMTP (Railway Pro): Gmail address, its 16-character **App password**, and `Nexus Youth <address@gmail.com>` |
| `TURNSTILE_SECRET_KEY` | Turnstile secret key (see step 3), recommended |
| `PUBLIC_SITE_URL` | Optional: the site's URL (e.g. `https://ssos-ticket.up.railway.app`). Adds the logo and a **View event** button to ticket emails. |
| `TRUST_PROXY_HOPS` | `1` (the default; Railway puts one proxy in front of the service) |

Railway sets `PORT` itself.

### Site service

| Variable | Value |
|---|---|
| `APP` | `events-site` |
| `VITE_SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase → **anon / public** key |
| `VITE_API_BASE` | The API service's URL, e.g. `https://moevent-api.up.railway.app` |
| `VITE_TURNSTILE_SITE_KEY` | Turnstile site key (see step 3), recommended |

### Dashboard service

| Variable | Value |
|---|---|
| `APP` | `ticket-dashboard` |
| `VITE_SUPABASE_URL` | same as above |
| `VITE_SUPABASE_ANON_KEY` | same as above |
| `VITE_API_BASE` | same as above |

`VITE_*` values are baked in when the app is built, so **after changing one, redeploy** that service.

## 3. Bot protection (strongly recommended)

Cloudflare **Turnstile** is free and doesn't need your domain on Cloudflare:
dash.cloudflare.com → **Turnstile → Add widget** → add the **site's domain** → put the *site key* in the Site service (`VITE_TURNSTILE_SITE_KEY`) and the *secret key* in the API service (`TURNSTILE_SECRET_KEY`).

Set **both or neither**. With neither, bookings still have rate limits and daily caps, but scripts have an easier time.

## 4. Supabase settings

1. **Authentication → Sign In / Providers → turn off "Allow new users to sign up".** Staff accounts are created from the dashboard.
2. **Authentication → URL Configuration:** *Site URL* = the dashboard's URL, and add it to *Redirect URLs*, so password-reset emails open the dashboard.

## 5. Check it works

- `https://<api domain>/api/healthz` → `{"status":"ok"}`
- The site lists events, and a test booking (with your own email) arrives in your inbox
- The dashboard logs in, and the browser console shows **no CORS or Content-Security-Policy errors**. If it does, check `CORS_ORIGINS` and `VITE_API_BASE`.
- API service → *Deployments → Logs*: `Server listening`, and **no** `CORS_ORIGINS is not set` error

## Day-to-day

- **Deploys:** push to the branch Railway watches; only the services whose files changed rebuild.
- **Logs:** each service → *Deployments → View logs*.
- **Backups:** all data is in Supabase. Turn on backups there (Database → Backups).
- **Old events:** the API deletes events, and their tickets, **3 days after the event date** (`artifacts/api-server/src/lib/cleanup.ts`). Export anything you need before then.

## Security model

| Who | Can | Can't |
|---|---|---|
| Anyone (public key in the site) | Read events and seat counts | Read tickets, emails, phones or requests; **write anything** |
| Public booking form → `POST /api/public/bookings` | Book Student/Regular (tickets emailed), request Organization | Book VVIP; exceed seats or per-booking limits; book past events |
| Staff (signed in) | Read and scan tickets of events assigned to them | Change anything else (enforced by a database trigger) |
| Admin (signed in) | Everything in the dashboard | — |

Booking abuse protection: per IP **10 bookings / 15 min**; per email and per phone **5 bookings and 3 organization requests / 24 h**; Turnstile when configured; seat limits enforced inside the database, so they hold even under concurrent bookings.

Other protections: strict Content-Security-Policy on the site and dashboard (no inline scripts); HSTS; dashboard not indexed by search engines; API runs as a non-root user; only the listed origins may call the API; image uploads must be real PNG/JPEG/WebP/GIF under 5 MB.

> **Other apps:** the public key can no longer create tickets. Anything else that inserted tickets with the anon key must book through `POST /api/public/bookings` instead. The staff gate app is unaffected: it signs in and only reads/scans.
