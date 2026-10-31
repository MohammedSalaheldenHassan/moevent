import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Render (and most hosts) sit behind one proxy; needed for per-IP rate limits.
app.set("trust proxy", 1);
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
if (allowedOrigins.length === 0) {
  logger.warn("CORS_ORIGINS is not set; accepting requests from any origin");
}
app.use(cors({ origin: allowedOrigins.length > 0 ? allowedOrigins : true }));

const limiter = (limit: number) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests. Please wait a few minutes and try again." },
  });
app.use("/api", limiter(300));
app.use(["/api/auth", "/api/staff", "/api/issue-ticket", "/api/cleanup/run", "/api/org"], limiter(60));

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
