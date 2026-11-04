# syntax=docker/dockerfile:1
# Builds the API, the public site and the dashboard from the monorepo.
# Targets: `api` (Node) and `web` (Caddy serving both static apps + /api proxy).
# Built by docker-compose.yml at the repo root; see DEPLOY.md.

# ── Build everything ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
RUN npm install -g pnpm@10.18.0
WORKDIR /app
COPY . .

# Public values baked into the browser bundles (the anon key is public by design).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_TURNSTILE_SITE_KEY=""
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server run build \
 && pnpm --filter @workspace/events-site run build \
 && pnpm --filter @workspace/ticket-dashboard run build
# Standalone API: its production node_modules (pdfkit and nodemailer are not
# bundled) plus the esbuild output.
RUN pnpm --filter @workspace/api-server deploy --prod --legacy /out/api \
 && cp -r artifacts/api-server/dist /out/api/dist

# ── API ───────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS api
ENV NODE_ENV=production \
    PORT=3001
WORKDIR /app
COPY --from=build --chown=node:node /out/api ./
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/index.mjs"]

# ── Web: HTTPS, static apps, /api proxy ─────────────────────────────────────
FROM caddy:2.8-alpine AS web
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/artifacts/events-site/dist/public /srv/site
COPY --from=build /app/artifacts/ticket-dashboard/dist/public /srv/dashboard
