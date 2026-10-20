import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { apiClient } from "../services/api/apiClient";
import * as farmlinkApi from "../api/farmlinkApi.js";
import { getLegacyRead, addLegacyRead } from "../utils/legacyRead.js";

const time = (v) => (v ? new Date(v).getTime() || 0 : 0);

// If farmlinkApi.js has no "api" export, this is undefined instead of crashing the app.
const legacyApi = farmlinkApi.api;

export default function NotificationBell({ user, onNavigate }) {
  const role = user?.role;
  const uid = user?.id || user?._id;
  const [items, setItems] = useState([]);
  const [toast, setToast] = useState(null);
  const seen = useRef(null);

  const load = useCallback(async () => {
    const [freshRes, oldRes] = await Promise.allSettled([
      apiClient.get("/notifications/mine"),
      legacyApi?.get ? legacyApi.get("/notifications/mine") : Promise.reject(new Error("no legacy api")),
    ]);
    const legacyRead = getLegacyRead(uid);

    const fresh =
      freshRes.status === "fulfilled"
        ? (freshRes.value?.notifications || []).map((n) => ({
            key: `new:${n.id}`, source: "new", rawId: n.id, title: n.title, message: n.message,
            createdAt: n.createdAt, read: n.read !== false, type: n.type,
            matchId: n.matchId || null, requestId: n.requestId || null,
          }))
        : [];
    const old =
      oldRes.status === "fulfilled"
        ? (oldRes.value?.notifications || []).map((n) => ({
            key: `old:${n.id}`, source: "old", rawId: String(n.id), title: n.title, message: n.message,
            createdAt: n.createdAt, read: legacyRead.has(String(n.id)), type: "old",
            matchId: null, requestId: null,
          }))
        : [];

    const all = [...fresh, ...old].sort((a, b) => time(b.createdAt) - time(a.createdAt));
    setItems(all);

    const unreadRows = all.filter((n) => !n.read);
    if (seen.current === null) {
      seen.current = new Set(all.map((n) => n.key));
      if (unreadRows.length) setToast(unreadRows[0]); // pop-up for what is unread on open
    } else {
      const added = unreadRows.filter((n) => !seen.current.has(n.key));
      all.forEach((n) => seen.current.add(n.key));
      if (added.length) setToast(added[0]);
    }
  }, [uid]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    window.addEventListener("focus", load);
    window.addEventListener("farmlink:notices-read", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", load);
      window.removeEventListener("farmlink:notices-read", load);
    };
  }, [load]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  function markRead(n) {
    if (n.read) return;
    setItems((rows) => rows.map((x) => (x.key === n.key ? { ...x, read: true } : x)));
    if (n.source === "new") {
      apiClient.post(`/notifications/${n.rawId}/read`).then(load).catch(() => {});
    } else {
      addLegacyRead(uid, [n.rawId]);
    }
  }

  // Clicking the pop-up opens the matching page.
  function openItem(n) {
    setToast(null);
    markRead(n);
    if (n.requestId) {
      onNavigate?.(role === "farmer" ? "requests" : "my-requests");
    } else if (n.matchId && (role === "farmer" || role === "buyer")) {
      onNavigate?.("notifications", `match:${n.matchId}`);
    } else {
      onNavigate?.("notifications");
    }
  }

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setToast(null); onNavigate?.("notifications"); }}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        title="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#16301F] hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50]"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10.5px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {toast && (
        <div className="fixed right-4 top-4 z-[60] w-80 max-w-[92vw] rounded-2xl border border-black/5 bg-white p-4 shadow-2xl" role="status" aria-live="polite">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8F5E9] text-[#2E7D32]">
              <Bell size={16} />
            </span>
            <button type="button" onClick={() => openItem(toast)} className="min-w-0 flex-1 text-left">
              <p className="truncate text-[13.5px] font-semibold text-[#16301F]">{toast.title}</p>
              <p className="mt-0.5 line-clamp-2 text-[12.5px] text-gray-600">{toast.message}</p>
            </button>
            <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}