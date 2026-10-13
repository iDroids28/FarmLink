import { API_URL, safeFetchJson } from "../../AuthShared";

/* Single place that talks to the backend. It reuses safeFetchJson, so cookies,
   the 10-second timeout and safe user-facing errors all keep working. */

const API_ROOT = API_URL.replace(/\/auth$/, "");

async function request(path, options) {
  try {
    return await safeFetchJson(`${API_ROOT}${path}`, options);
  } catch (err) {
    // The server says the session is gone: let App.jsx return to Log In.
    if (err && err.status === 401) {
      window.dispatchEvent(new Event("farmlink:session-expired"));
    }
    throw err;
  }
}

const withBody = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body ?? {}),
});

export const apiClient = {
  get: (path) => request(path),
  post: (path, body) => request(path, withBody("POST", body)),
  patch: (path, body) => request(path, withBody("PATCH", body)),
};
