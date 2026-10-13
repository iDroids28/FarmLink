import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../AuthShared";

const BASE = API_URL.replace(/\/auth\/?$/, "") + "/role-applications";
const GENERIC = "Something went wrong. Please try again.";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export const errorMessage = (e) => (e && typeof e.message === "string" && e.message) || GENERIC;

async function call(path, { method = "GET", json, form } = {}) {
  const options = { method, credentials: "include", headers: {} };
  if (json !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(json);
  }
  // multipart/form-data: the browser sets the Content-Type + boundary itself.
  if (form) options.body = form;

  let res;
  try {
    res = await fetch(BASE + path, options);
  } catch {
    throw new ApiError("Cannot reach the server. Please check your connection and try again.", 0);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event("farmlink:session-expired"));
    throw new ApiError(typeof data?.error === "string" ? data.error : GENERIC, res.status);
  }
  return data;
}

export const roleApplicationApi = {
  mine: () => call("/mine"),
  submitFarmer: (form) => call("/farmer", { method: "POST", form }),
  submitBuyer: (form) => call("/buyer", { method: "POST", form }),
  adminList: ({ type, status } = {}) => {
    const q = new URLSearchParams();
    if (type) q.set("type", type);
    if (status) q.set("status", status);
    const s = q.toString();
    return call("/admin/applications" + (s ? `?${s}` : ""));
  },
  adminReview: (id, decision, reason) =>
    call(`/admin/applications/${id}`, { method: "PATCH", json: { decision, reason } }),

  // Documents are private: they are fetched with the login cookie and shown from
  // a temporary in-memory blob URL. There is no public file URL.
  async openDocument(appId, docId) {
    const win = window.open("", "_blank"); // opened first so the pop-up is not blocked
    try {
      const res = await fetch(`${BASE}/documents/${appId}/${docId}`, { credentials: "include" });
      if (!res.ok) throw new ApiError("This document could not be opened.", res.status);
      const url = URL.createObjectURL(await res.blob());
      if (win) win.location.href = url;
      else window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    } catch (err) {
      if (win) win.close();
      throw err instanceof ApiError ? err : new ApiError("This document could not be opened.", 0);
    }
  },
};

export function useMyApplications({ pollWhenPending = false } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(
    () =>
      roleApplicationApi
        .mine()
        .then((d) => {
          setData(d);
          setError("");
        })
        .catch((e) => setError(errorMessage(e)))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    reload();
  }, [reload]);

  const pending = Boolean(data?.pending);
  useEffect(() => {
    if (!pollWhenPending || !pending) return undefined;
    const t = setInterval(reload, 15000);
    return () => clearInterval(t);
  }, [pollWhenPending, pending, reload]);

  return { data, loading, error, reload };
}