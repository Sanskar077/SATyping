import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react/src/custom-fetch";

export function configureApi() {
  setBaseUrl("");
  setAuthTokenGetter(() => {
    return localStorage.getItem("accessToken");
  });
}
