# Deploying MoEvent

One server runs everything with Docker:

| Container | What it does |
|---|---|
| `web` (Caddy) | HTTPS (automatic Let's Encrypt certificates), serves the **public site** on `SITE_DOMAIN` and the **dashboard** on `ADMIN_DOMAIN`, adds security headers, forwards `/api` to the API |
| `api` (Node) | The Express API. Not reachable from the internet, only through Caddy |

The database is your existing Supabase project; all migrations in `supabase/migrations/` are already applied to it.

## 1. Before you start

- **A server** (any Linux VPS with 1 GB+ RAM) with [Docker](https://docs.docker.com/engine/install/) and the Compose plugin.
- **Two domain names** pointing at the server's IP (DNS `A` records), e.g. `tickets.example.com` (site) and `admin.example.com` (dashboard).
- Ports **80 and 443** open in the server's firewall.

## 2. Supabase settings (dashboard → your project)

1. **Authentication → Sign In / Providers → turn off "Allow new users to sign up".** Staff accounts are created from the dashboard, so nobody needs public sign-up. (Strangers who sign up can't access anything today, but there's no reason to let them create accounts.)
2. **Authentication → URL Configuration:** set *Site URL* to `https://ADMIN_DOMAIN` and add it to *Redirect URLs*, so password-reset links open the dashboard.
3. Keep the **service_role key** secret. It lives only in `.env.production` on the server.

## 3. Bot protection (strongly recommended)

Cloudflare **Turnstile** is free and doesn't need your domain to be on Cloudflare:
dash.cloudflare.com → **Turnstile → Add widget** → add `SITE_DOMAIN` → copy the **site key** and **secret key** into `.env.production`.

With both keys set, every booking must pass the check. With them empty, bookings still have rate limits and daily caps (see below), but scripts are easier.

## 4. Deploy

```bash
git clone <your repo> moevent && cd moevent
cp .env.production.example .env.production
nano .env.production            # fill in every value
docker compose --env-file .env.production up -d --build
```

The first start takes a few minutes (it builds all three apps). Caddy gets the certificates on first visit.

**Check it:**
- `https://SITE_DOMAIN` shows the events
- `https://ADMIN_DOMAIN` shows the login
- `https://SITE_DOMAIN/api/healthz` returns `{"status":"ok"}`
- `docker compose logs -f api` shows `Server listening` and no errors

## 5. Updating

```bash
git pull
docker compose --env-file .env.production up -d --build
```

## 6. Day-to-day

- **Logs:** `docker compose logs -f api` / `docker compose logs -f web`
- **Restart:** `docker compose restart api`
- **Backups:** the data is in Supabase. Turn on backups in Supabase (Database → Backups); the server itself holds nothing that can't be rebuilt.
- **Old events:** the API deletes events, and their tickets, **3 days after the event date** (`artifacts/api-server/src/lib/cleanup.ts`). Export anything you need to keep before then.

## Security model

What the public can and can't do:

| Who | Can | Can't |
|---|---|---|
| Anyone (public key in the site) | Read events and seat counts | Read tickets, emails, phones or requests; **write anything** |
| Public booking form → `POST /api/public/bookings` | Book Student/Regular (tickets emailed), request Organization | Book VVIP; exceed seats or per-booking limits; book past events |
| Staff (signed in) | Read and scan tickets of events assigned to them | Change anything else (enforced by a database trigger) |
| Admin (signed in) | Everything in the dashboard | — |

Booking abuse protection: per IP **10 bookings / 15 min**; per email and per phone **5 bookings and 3 organization requests / 24 h**; Turnstile when configured; seat limits enforced inside the database, so they hold even under concurrent bookings.

Other protections: HTTPS everywhere with HSTS; strict Content-Security-Policy (no inline scripts); dashboard not indexed by search engines; API container runs read-only as a non-root user; image uploads must be real PNG/JPEG/WebP/GIF under 5 MB; the API rejects cross-origin requests in production.

> **Gate / other apps:** the public key can no longer create tickets. If any other app (e.g. an older booking site) inserted tickets with the anon key, it must book through `POST /api/public/bookings` instead. The staff gate app is unaffected: it signs in and only reads/scans.
