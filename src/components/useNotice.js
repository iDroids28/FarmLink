import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { useLoad } from "../api/farmlinkApi.js";

export const NoticesContext = createContext({
  notices: [],
  unseenIds: new Set(),
  unseenCount: 0,
  markSeen: () => {},
  markAllSeen: () => {},
});

function readSeen(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); } catch { return new Set(); }
}
function writeSeen(key, set) {
  try { localStorage.setItem(key, JSON.stringify([...set].slice(-300))); } catch { /* ignore */ }
}
const time = (v) => (v ? new Date(v).getTime() || 0 : 0);

// Builds the notice list (and the red count) for buyers and farmers from
// requirements, pre-orders, the seller application and server notifications.
export default function useNotices(user) {
  const isAdmin = user?.role === "admin";
  const isFarmer = user?.role === "farmer";
  const key = `farmlink:seenNotices:${user?.id ?? user?.email ?? "me"}`;

  const reqs = useLoad("/requirements/mine");
  const pre = useLoad("/preorders/mine");
  const inc = useLoad("/preorders/incoming");
  const app = useLoad("/applications/mine");
  const srv = useLoad("/notifications/mine");

  const [seen, setSeen] = useState(() => readSeen(key));
  useEffect(() => { setSeen(readSeen(key)); }, [key]);

  // Check again every 15 seconds so new notices show up by themselves.
  const rReqs = reqs.reload, rPre = pre.reload, rInc = inc.reload, rApp = app.reload, rSrv = srv.reload;
  useEffect(() => {
    if (isAdmin) return;
    const timer = setInterval(() => {
      rReqs?.(); rPre?.(); rApp?.(); rSrv?.();
      if (isFarmer) rInc?.();
    }, 15000);
    return () => clearInterval(timer);
  }, [isAdmin, isFarmer, rReqs, rPre, rInc, rApp, rSrv]);

  const notices = useMemo(() => {
    if (isAdmin) return [];
    const out = [];

    for (const r of reqs.data?.requirements || []) {
      const left = Math.max(Number(r.quantity) - Number(r.matched || 0), 0);
      if (r.status === "Partially Matched") {
        out.push({
          id: `req:${r.id}:partial:${r.matched}`,
          title: "Requirement partially matched",
          message: `${r.product}: ${r.matched} of ${r.quantity} ${r.unit} matched. ${left} ${r.unit} still needed. View details or pre-order the rest in Find Supply.`,
          tone: "warn", page: "requests", canPreorder: true, important: true,
          time: r.updatedAt || r.createdAt,
        });
      } else if (r.status === "Fully Matched") {
        out.push({
          id: `req:${r.id}:full`,
          title: "Requirement fully matched",
          message: `${r.product}: all ${r.quantity} ${r.unit} are matched. View details or pre-order in Find Supply.`,
          tone: "good", page: "requests", canPreorder: true, important: true,
          time: r.updatedAt || r.createdAt,
        });
      }
    }

    for (const p of pre.data?.preorders || []) {
      if (p.status === "Accepted" || p.status === "Declined") {
        out.push({
          id: `pre:${p.id}:${p.status}`,
          title: p.status === "Accepted" ? "Pre-order accepted" : "Pre-order declined",
          message: `${p.farmerName} ${p.status === "Accepted" ? "accepted" : "declined"} your pre-order of ${p.quantity} ${p.unit} ${p.product}.`,
          tone: p.status === "Accepted" ? "good" : "bad", page: "requests", important: true,
          time: p.updatedAt || p.createdAt,
        });
      }
    }

    if (isFarmer) {
      for (const p of inc.data?.preorders || []) {
        if (p.status === "Pending") {
          out.push({
            id: `inc:${p.id}`,
            title: "New pre-order",
            message: `${p.buyerName} wants ${p.quantity} ${p.unit} of ${p.product}. Accept or decline it in My Supply.`,
            tone: "warn", page: "supply", important: true, time: p.createdAt,
          });
        }
      }
    }

    const a = app.data?.application;
    if (a && (a.status === "Approved" || a.status === "Rejected")) {
      out.push({
        id: `app:${a.id ?? ""}:${a.status}`,
        title: a.status === "Approved" ? "Seller application approved" : "Seller application rejected",
        message: a.status === "Approved"
          ? "My Supply is unlocked. You can post your products now."
          : "Update your details and apply again.",
        tone: a.status === "Approved" ? "good" : "bad", page: "apply", important: true,
        time: a.updatedAt || a.createdAt,
      });
    }

    for (const n of srv.data?.notifications || []) {
      out.push({ id: `srv:${n.id}`, title: n.title, message: n.message, tone: "info", page: null, time: n.createdAt });
    }

    return out.sort((x, y) => time(y.time) - time(x.time));
  }, [isAdmin, isFarmer, reqs.data, pre.data, inc.data, app.data, srv.data]);

  const unseenIds = useMemo(() => new Set(notices.filter((n) => !seen.has(n.id)).map((n) => n.id)), [notices, seen]);

  const markSeen = useCallback((id) => {
    setSeen((prev) => {
      const next = new Set(prev);
      next.add(id);
      writeSeen(key, next);
      return next;
    });
  }, [key]);

  const markAllSeen = useCallback(() => {
    setSeen((prev) => {
      const next = new Set(prev);
      notices.forEach((n) => next.add(n.id));
      writeSeen(key, next);
      return next;
    });
  }, [notices, key]);

  return { notices, unseenIds, unseenCount: unseenIds.size, markSeen, markAllSeen };
}