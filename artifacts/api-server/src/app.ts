import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Allow explicit origin list via CORS_ORIGIN env, or permit all in dev.
// Example: CORS_ORIGIN=https://your-frontend.vercel.app,https://www.yoursite.com
//
// An unset/empty CORS_ORIGIN reflects whatever Origin the caller sends. That is convenient
// locally but must never happen in production, where it would let any site call the API with a
// user's credentials. In production we therefore fail loudly at boot rather than starting up in a
// silently insecure state.
const corsOriginList = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (process.env.NODE_ENV === "production" && corsOriginList.length === 0) {
  throw new Error(
    "CORS_ORIGIN must be set in production (comma-separated origins, e.g. https://your-app.vercel.app). " +
      "Refusing to start with an allow-all CORS policy.",
  );
}

const corsOrigin = corsOriginList.length > 0 ? corsOriginList : true;

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
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        // Allows the frontend to load Razorpay's checkout widget (see plans.tsx / Phase 4).
        "script-src": ["'self'", "https://checkout.razorpay.com"],
        "frame-src": ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
        "connect-src": ["'self'", "https://api.razorpay.com", "https://lumberjack.razorpay.com"],
      },
    },
  }),
);

// Tight limiter on auth endpoints — brute-force/credential-stuffing surface.
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again in a minute." },
});

// Looser general limiter for the rest of the API.
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again shortly." },
});

app.use("/api/auth", authLimiter);
app.use("/api", generalLimiter);

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(
  express.json({
    // Stash the raw bytes for the webhook route only — needed to verify Razorpay's HMAC
    // signature against the exact payload, which re-serializing the parsed JSON can't guarantee.
    verify: (req, _res, buf) => {
      const expressReq = req as express.Request & { rawBody?: Buffer };
      if (expressReq.originalUrl === "/api/payments/webhook") {
        expressReq.rawBody = buf;
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// 404 for any /api/* path no router matched. Placed after the router so real routes win.
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
});

// Centralized error handler — MUST be last and MUST keep all four args so Express treats it as an
// error handler. Express 5 forwards rejected async route handlers here automatically, so individual
// routes don't need their own try/catch to avoid an unhandled rejection. Logs with request context
// via pino, never leaks a stack trace to the client, and always returns { error, code? }.
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  // If the response already started streaming, defer to Express's default handler to close it.
  if (res.headersSent) {
    next(err);
    return;
  }

  const status =
    typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status :
    typeof (err as { statusCode?: unknown })?.statusCode === "number" ? (err as { statusCode: number }).statusCode :
    500;

  const log = (req as Request & { log?: typeof logger }).log ?? logger;
  log.error({ err, method: req.method, url: req.originalUrl?.split("?")[0], status }, "Unhandled request error");

  // Never surface internal error text/stack for 5xx. For deliberate 4xx thrown with a message,
  // it's safe to pass a short message through.
  const clientMessage =
    status >= 500
      ? "Internal server error"
      : (typeof (err as { message?: unknown })?.message === "string"
          ? (err as { message: string }).message
          : "Request failed");

  const code = typeof (err as { code?: unknown })?.code === "string" ? (err as { code: string }).code : undefined;

  res.status(status).json(code ? { error: clientMessage, code } : { error: clientMessage });
});

export default app;
