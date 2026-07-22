import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Allow explicit origin list via CORS_ORIGIN env, or permit all in dev.
// Example: CORS_ORIGIN=https://your-frontend.vercel.app,https://www.yoursite.com
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : true;

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

export default app;
