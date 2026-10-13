import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { Menu, Bell, ArrowLeft, X } from "lucide-react";
import Sidebar, { MENU } from "./Sidebar.jsx";
import NotificationPanel from "./notificationPanel.jsx";
import { useLoad } from "../api/farmlinkApi.js";
import { apiClient } from "../services/api/apiClient";
import { MATCH_NOTICE_TONE } from "../models/match/Match";

/* ------------------------------------------------------------------ */
/* Notices: matches, application result, server messages               */
/* ------------------------------------------------------------------ */

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

function useNotices(user) {
  const isAdmin = user?.role === "admin" || user?.role === "user";
  const key = `farmlink:seenNotices:${user?.id ?? user?.email ?? "me"}`;

  // Legacy feeds (old /api/farmlink system) - unchanged.
  const reqs = useLoad(isAdmin ? null : "/requirements/mine");
  const app = useLoad(isAdmin ? null : "/applications/mine");
  const srv = useLoad(isAdmin ? null : "/notifications/mine");

  // New feed: /api/notifications/mine (match notices live here).
  const [fresh, setFresh] = useState([]);
  const loadFresh = useCallback(() => {
    if (isAdmin) return Promise.resolve();
    return apiClient
      .get("/notifications/mine")
      .then((d) => setFresh(d?.notifications || []))
      .catch(() => { /* keep the last good list; try again on the next poll */ });
  }, [isAdmin]);

  useEffect(() => { loadFresh(); }, [loadFresh]);

  // The Notifications page marks everything read; refresh right away so the badge clears.
  useEffect(() => {
    window.addEventListener("farmlink:notices-read", loadFresh);
    return () => window.removeEventListener("farmlink:notices-read", loadFresh);
  }, [loadFresh]);

  const [seen, setSeen] = useState(() => readSeen(key));
  useEffect(() => { setSeen(readSeen(key)); }, [key]);

  // Check again every 15 seconds so new notices show up by themselves.
  const rReqs = reqs.reload, rApp = app.reload, rSrv = srv.reload;
  useEffect(() => {
    if (isAdmin) return;
    const timer = setInterval(() => {
      rReqs?.(); rApp?.(); rSrv?.();
      loadFresh();
    }, 15000);
    return () => clearInterval(timer);
  }, [isAdmin, rReqs, rApp, rSrv, loadFresh]);

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

    // New feed: unread notices only (read ones are history on the Notification page).
    for (const n of fresh) {
      if (n.read) continue;
      const isMatch = Object.prototype.hasOwnProperty.call(MATCH_NOTICE_TONE, n.type);
      out.push({
        id: `new:${n.id}`,
        title: n.title,
        message: n.message,
        tone: MATCH_NOTICE_TONE[n.type] || "info",
        page: isMatch ? "matches" : null,
        important: isMatch,
        time: n.createdAt,
      });
    }

    return out.sort((x, y) => time(y.time) - time(x.time));
  }, [isAdmin, reqs.data, app.data, srv.data, fresh]);

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

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

// Only the Dashboard title is fixed here. Every other page title
// comes from the sidebar menu label, so the two always match.
const PAGE_TITLES = {
  dashboard: "Dashboard",
};

const BACK_STYLE = {
  background: "linear-gradient(90deg, #4CAF50, #2E7D32)",
  boxShadow: "0 4px 12px rgba(46,125,50,0.28)",
};

const TOAST_TONE = {
  warn: "border-amber-300 bg-amber-50 text-amber-900",
  good: "border-green-300 bg-green-50 text-green-900",
  bad: "border-red-300 bg-red-50 text-red-800",
  info: "border-gray-200 bg-white text-gray-800",
};

export default function Layout({ user, active, onNavigate, onLogout, headerActions, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => new Set());
  const role = user?.role || "buyer";
  const isAdmin = role === "admin";

  const noticeState = useNotices(user);
  const { notices, unseenIds, unseenCount } = noticeState;

  const current =
    PAGE_TITLES[active] ||
    (MENU[role] || []).find((m) => m.id === active)?.label ||
    active.charAt(0).toUpperCase() + active.slice(1);

  const displayName = user?.name || user?.email || "";
  const showBack = active !== "dashboard";

  // Pop-up notice: the newest unread important notice (not shown on the Notification page).
  const toast = isAdmin || active === "notifications"
    ? null
    : notices.find((n) => n.important && unseenIds.has(n.id) && !dismissed.has(n.id)) || null;

  const toastId = toast?.id;
  useEffect(() => {
    if (!toastId) return;
    const t = setTimeout(() => setDismissed((s) => new Set(s).add(toastId)), 9000);
    return () => clearTimeout(t);
  }, [toastId]);

  function dismissToast() {
    if (toast) setDismissed((s) => new Set(s).add(toast.id));
  }

  function onBell() {
    if (isAdmin) setNotifOpen(true);
    else onNavigate?.("notifications");
  }

  return (
    <NoticesContext.Provider value={noticeState}>
      <div
        className="flex h-screen w-full overflow-hidden bg-[#F5F8F3]"
        style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
      >
        <Sidebar
          role={role}
          active={active}
          onNavigate={onNavigate}
          onLogout={onLogout}
          user={user}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          badges={isAdmin ? {} : { notifications: unseenCount }}
        />

        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[28vh] min-h-[180px]"
            style={{
              background:
                "linear-gradient(to bottom, rgba(76,175,80,0.30) 0%, rgba(167,227,160,0.16) 55%, rgba(245,248,243,0) 100%)",
            }}
          />
          <div
            className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(76,175,80,0.45) 0%, transparent 70%)",
              filter: "blur(28px)",
            }}
          />
          <div
            className="pointer-events-none absolute left-1/3 -top-28 h-64 w-80 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(139,195,74,0.38) 0%, transparent 70%)",
              filter: "blur(30px)",
            }}
          />
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(46,125,50,0.30) 0%, transparent 70%)",
              filter: "blur(30px)",
            }}
          />
          <div
            className="pointer-events-none absolute bottom-0 left-1/4 h-72 w-72 rounded-full"
            style={{
              background: "radial-gradient(circle, #E4F2DE 0%, transparent 70%)",
              opacity: 0.5,
              filter: "blur(10px)",
            }}
          />

          <header className="relative z-10 flex h-16 shrink-0 items-center gap-3 border-b border-white/40 bg-white/25 px-4 backdrop-blur-md lg:px-7">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="text-[#16301F]/70 hover:text-[#16301F] lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>

            {showBack && (
              <button
                type="button"
                onClick={() => onNavigate?.("dashboard")}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2 active:scale-[0.98]"
                style={BACK_STYLE}
              >
                <ArrowLeft size={15} strokeWidth={2.6} />
                Back
              </button>
            )}

            <h1 className="min-w-0 truncate text-[17px] font-semibold tracking-tight text-[#16301F]">
              {current}
            </h1>

            <div className="ml-auto flex shrink-0 items-center gap-3">
              {headerActions}
              <button
                type="button"
                onClick={onBell}
                className="relative text-[#16301F]/70 hover:text-[#2E7D32]"
                aria-label={unseenCount > 0 ? `Notifications, ${unseenCount} new` : "Notifications"}
              >
                <Bell size={19} />
                {!isAdmin && unseenCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
                    {unseenCount > 9 ? "9+" : unseenCount}
                  </span>
                )}
              </button>
            </div>
          </header>

          <main className="relative z-10 flex-1 overflow-y-auto p-5 lg:p-7">
            <div className="mb-4">
              <span className="block min-w-0 max-w-full truncate text-[22px] font-extrabold text-[#16301F]">
                {displayName}
              </span>
            </div>

            {children}
          </main>
        </div>

        {/* Pop-up notice (matches, approvals, server messages) */}
        {toast && (
          <div
            role="alert"
            className={"fixed bottom-5 right-5 z-40 w-[320px] max-w-[calc(100vw-2.5rem)] rounded-2xl border p-4 shadow-xl " + (TOAST_TONE[toast.tone] || TOAST_TONE.info)}
          >
            <div className="flex items-start gap-2">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold">{toast.title}</p>
                <p className="mt-0.5 text-[12.5px]">{toast.message}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => { noticeState.markSeen(toast.id); onNavigate?.(toast.page || "notifications"); }}
                    className="rounded-md bg-[#2E7D32] px-3 py-1 text-[12px] font-semibold text-white hover:brightness-110"
                  >
                    View Details
                  </button>
                  {toast.canPreorder && (
                    <button
                      type="button"
                      onClick={() => { noticeState.markSeen(toast.id); onNavigate?.("available"); }}
                      className="rounded-md bg-white/80 px-3 py-1 text-[12px] font-semibold text-[#16301F] hover:bg-white"
                    >
                      Pre-order
                    </button>
                  )}
                </div>
              </div>
              <button type="button" onClick={dismissToast} aria-label="Dismiss" className="rounded p-1 hover:bg-black/5">
                <X size={15} />
              </button>
            </div>
          </div>
        )}

        {isAdmin && notifOpen && (
          <NotificationPanel
            onClose={() => setNotifOpen(false)}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </NoticesContext.Provider>
  );
}