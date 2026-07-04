/**
 * This file MUST be the first import in index.ts.
 *
 * Problem: pnpm changes CWD to the package directory (artifacts/api-server)
 * when running scripts, so dotenv's default `.env` lookup finds nothing.
 * The workspace root .env is three directories up from this file:
 *   src/ -> api-server/ -> artifacts/ -> [workspace root]
 *
 * We resolve the path from __dirname (always this file's location, regardless
 * of CWD) and load it explicitly before any other module is evaluated.
 */
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Walk up: src -> api-server -> artifacts -> workspace root
const rootEnvPath = path.resolve(__dirname, "..", "..", "..", ".env");

const result = config({ path: rootEnvPath });

if (result.error) {
  // Not a hard crash — env vars may be injected by the host (Render, Railway, etc.)
  // Only warn so production deployments without a .env file still work.
  console.warn(
    `[env] .env file not found at ${rootEnvPath} — relying on host-injected environment variables.`
  );
}
