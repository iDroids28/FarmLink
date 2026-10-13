import { useCallback, useEffect, useState } from "react";
import { API_URL, safeFetchJson, getUserMessage } from "../AuthShared";

// API_URL looks like ".../api/auth"; the new routes live at ".../api/farmlink".
const BASE = API_URL.replace(/\/auth\/?$/, "") + "/farmlink";
const JSON_HEADERS = { "Content-Type": "application/json" };

export const api = {
  get: (p) => safeFetchJson(BASE + p),
  post: (p, body) =>
    safeFetchJson(BASE + p, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body || {}) }),
  patch: (p, body) =>
    safeFetchJson(BASE + p, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(body || {}) }),
  del: (p) => safeFetchJson(BASE + p, { method: "DELETE" }),
};

export { getUserMessage };

// Loads a GET endpoint and gives back { data, loading, error, reload }.
export function useLoad(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

   const reload = useCallback(() => {
    if (!path) {
      setLoading(false);
      return Promise.resolve();
    }
    setLoading(true);
    return api
      .get(path)
      .then((d) => { setData(d); setError(""); })
      .catch((e) => setError(getUserMessage(e)))
      .finally(() => setLoading(false));
  }, [path]);

  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload };
}