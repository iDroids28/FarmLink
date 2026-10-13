import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import GlassCard from "../../components/GlassCard.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { PageHeader, LoadNote } from "../../components/DemoBits.jsx";
import { useLoad, getUserMessage } from "../../api/farmlinkApi.js";
import { apiClient } from "../../services/api/apiClient";

const time = (v) => (v ? new Date(v).getTime() || 0 : 0);

export default function Notifications() {
  // Legacy feed: /api/farmlink/notifications/mine (announcements, old application results)
  const legacy = useLoad("/notifications/mine");

  // New feed: /api/notifications/mine (match_created / confirmed / declined / cancelled ...)
  const [fresh, setFresh] = useState(null);
  const [freshError, setFreshError] = useState("");

  useEffect(() => {
    let alive = true;
    apiClient
      .get("/notifications/mine")
      .then((d) => {
        if (!alive) return;
        setFresh(d?.notifications || []);
        // Opening the page counts as reading: clear the unread state on the server.
        if ((d?.unread || 0) > 0) {
          apiClient
            .post("/notifications/read-all")
            .then(() => window.dispatchEvent(new Event("farmlink:notices-read")))
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (alive) setFreshError(getUserMessage(err));
      });
    return () => { alive = false; };
  }, []);

  const list = useMemo(() => {
    const old = (legacy.data?.notifications || []).map((n) => ({
      id: `old:${n.id}`, title: n.title, message: n.message, createdAt: n.createdAt,
    }));
    const added = (fresh || []).map((n) => ({
      id: `new:${n.id}`, title: n.title, message: n.message, createdAt: n.createdAt,
    }));
    return [...old, ...added].sort((a, b) => time(b.createdAt) - time(a.createdAt));
  }, [legacy.data, fresh]);

  const legacyLoading = legacy.loading && !legacy.data;
  const freshLoading = fresh === null && !freshError;
  const loading = legacyLoading || freshLoading;
  // Only show an error when BOTH feeds failed; otherwise show what we have.
  const error = legacy.error && freshError ? legacy.error : "";

  return (
    <div className="space-y-6">
      <PageHeader title="Notification" subtitle="Announcements and updates about your account." />
      <LoadNote loading={loading && list.length === 0} error={error} />
      {!loading && !error && list.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" message="You're all caught up." />
      ) : (
        <div className="space-y-3">
          {list.map((n) => (
            <GlassCard key={n.id}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[14px] font-semibold text-[#16301F]">{n.title}</h3>
                <span className="text-[12px] text-gray-500">{String(n.createdAt).slice(0, 10)}</span>
              </div>
              <p className="mt-1 text-[13px] text-gray-600">{n.message}</p>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}