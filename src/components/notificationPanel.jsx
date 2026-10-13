import { useEffect } from "react";
import { X, Bell } from "lucide-react";
import { LoadNote } from "./DemoBits.jsx";
import { useLoad } from "../api/farmlinkApi.js";

// Change this if your notifications route has a different path.
const NOTIF_ENDPOINT = "/notifications/mine";

function timeAgo(value) {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return "";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day > 1 ? "s" : ""} ago`;
  return new Date(value).toLocaleDateString();
}

// This component is only mounted while the panel is open (see Layout.jsx),
// so the list is reloaded every time the bell is clicked.
export default function NotificationPanel({ onClose, onNavigate }) {
  const { data, loading, error } = useLoad(NOTIF_ENDPOINT);
  const items = data?.notifications || [];

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={onClose} />
      <aside
        role="dialog"
        aria-label="Notifications"
        className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-sm flex-col bg-white shadow-2xl"
        style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
      >
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-[#2E7D32]" />
            <h2 className="text-[16px] font-semibold text-[#16301F]">Notifications</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close notifications" className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 pt-3">
            <LoadNote loading={loading && !data} error={error} />
          </div>

          {!loading && !error && items.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F5E9] text-[#2E7D32]">
                <Bell size={22} />
              </span>
              <p className="text-[14px] font-medium text-[#16301F]">No notifications yet</p>
              <p className="text-[13px] text-gray-500">Updates about your requirements and applications will show here.</p>
            </div>
          )}

          <ul className="divide-y divide-black/5">
            {items.map((n, i) => (
              <li key={n.id || n._id || i} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[14px] font-semibold text-[#16301F]">{n.title}</p>
                  <span className="shrink-0 text-[11.5px] text-gray-400">{timeAgo(n.createdAt)}</span>
                </div>
                <p className="mt-1 text-[13px] text-gray-600">{n.message}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-black/5 p-4">
          <button
            type="button"
            onClick={() => {
              onClose?.();
              onNavigate?.("notifications");
            }}
            className="w-full rounded-md bg-gray-100 px-4 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-200"
          >
            View all notifications
          </button>
        </div>
      </aside>
    </>
  );
}