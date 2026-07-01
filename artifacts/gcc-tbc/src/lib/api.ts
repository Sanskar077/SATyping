import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react/src/custom-fetch";

// In production, VITE_API_BASE_URL points to the deployed API server.
// Locally it defaults to the api-server dev port (3001).
// When frontend and API share the same origin (same-host proxy), leave it empty.
const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

export function configureApi() {
  setBaseUrl(apiBase);
  setAuthTokenGetter(() => {
    return localStorage.getItem("accessToken");
  });
}
