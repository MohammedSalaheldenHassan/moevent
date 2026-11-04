import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Number of reverse proxies in front of the API (Caddy/nginx = 1). Needed so
// per-IP rate limits see the visitor's IP, not the proxy's. Never "true":
// that would trust a spoofed X-Forwarded-For.
app.set("trust proxy", Number(process.env["TRUST_PROXY_HOPS"] ?? 1));
app.disable("x-powered-by");

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(helmet());

// CORS_ORIGINS: comma-separated dashboard origins, e.g. https://dashboard.example.com
const allowedOrigins = (process.env["CORS_ORIGINS"] ?? "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);
const isProduction = process.env["NODE_ENV"] === "production";
if (allowedOrigins.length === 0) {
  // Production: refuse cross-origin calls rather than allow every website.
  // On Railway the site and dashboard are separate origins, so CORS_ORIGINS
  // must list them. Development: any origin, for the Vite dev servers.
  if (isProduction) {
    logger.error(
      "CORS_ORIGINS is not set: browsers on other origins (the public site and dashboard on Railway) can't call this API. " +
        "Set CORS_ORIGINS=https://<site-domain>,https://<dashboard-domain>",
    );
  } else {
    logger.warn("CORS_ORIGINS is not set; accepting requests from any origin (development)");
  }
}
app.use(cors({ origin: allowedOrigins.length > 0 ? allowedOrigins : !isProduction }));

const limiter = (limit: number) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests. Please wait a few minutes and try again." },
  });
app.use("/api", limiter(300));
app.use(["/api/auth", "/api/staff", "/api/issue-ticket", "/api/cleanup/run", "/api/org", "/api/tickets/send-email"], limiter(60));
// Public bookings: a person books a few times at most; scripts get cut off.
app.use("/api/public/bookings", limiter(10));

// Logo uploads carry a base64 image; everything else is small JSON.
app.use("/api/org/upload-logo", express.json({ limit: "10mb" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api", router);

// Return JSON for payload-too-large errors instead of default HTML page
app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  if (err.type === "entity.too.large" || (err as { status?: number }).status === 413) {
    res.status(413).json({ error: "Request is too large. Images must be under 8 MB." });
    return;
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
