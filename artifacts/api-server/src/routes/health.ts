import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function health(_req: unknown, res: { json: (body: unknown) => void }) {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
}

// Deliberately unauthenticated and DB-free: platform health checks (Render, uptime monitors) must
// succeed even when the database is unreachable, otherwise a transient DB blip causes the platform
// to kill and restart an otherwise-healthy process.
router.get("/healthz", health);

// `/api/health` is the conventional name most platforms and monitors default to; `/healthz` is
// kept because it is the original path and may already be configured somewhere.
router.get("/health", health);

export default router;
