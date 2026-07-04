import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react/src/custom-fetch";

// In development, Vite proxies /api/* to the API server automatically.
// VITE_API_BASE_URL is only needed in production (e.g. Vercel → Render).
const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

export function configureApi() {
  setBaseUrl(apiBase);
  setAuthTokenGetter(() => {
    return localStorage.getItem("accessToken");
  });
}
