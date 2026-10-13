import { useState } from "react";
import GlassCard from "../components/GlassCard.jsx";
import { PageHeader, DataTable, Field, LoadNote, inputCls, primaryBtn, primaryStyle } from "../components/DemoBits.jsx";
import { api, useLoad, getUserMessage } from "../api/farmlinkApi.js";

export default function AdminNotifications() {
  const { data, loading, error: loadError, reload } = useLoad("/admin/notifications");
  const [audience, setAudience] = useState("all");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setSent(false);
    if (!title.trim() || !message.trim()) return setError("Please enter a title and a message.");
    setBusy(true);
    api
      .post("/admin/announcements", { audience, title, message })
      .then(() => { setTitle(""); setMessage(""); setSent(true); return reload(); })
      .catch((err) => setError(getUserMessage(err)))
      .finally(() => setBusy(false));
  }

  const columns = [
    { key: "date", label: "Date", render: (n) => String(n.createdAt).slice(0, 10) },
    { key: "to", label: "To" },
    { key: "title", label: "Title" },
    { key: "message", label: "Message" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" subtitle="Send announcements. Approval and rejection notices are sent automatically." />
      <LoadNote loading={loading && !data} error={loadError} />

      <GlassCard>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-3" noValidate>
          <Field label="Send to">
            <select value={audience} onChange={(e) => setAudience(e.target.value)} className={inputCls}>
              <option value="all">All users</option>
              <option value="farmers">Farmers only</option>
              <option value="buyers">Buyers only</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Title" required>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div className="sm:col-span-3">
            <Field label="Message" required>
              <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className={inputCls} />
            </Field>
          </div>
          {error && <p className="text-[12.5px] text-red-600 sm:col-span-3">{error}</p>}
          {sent && <p className="text-[12.5px] text-green-700 sm:col-span-3">Announcement sent.</p>}
          <div className="sm:col-span-3">
            <button type="submit" disabled={busy} className={primaryBtn} style={primaryStyle}>
              {busy ? "Sending..." : "Send Announcement"}
            </button>
          </div>
        </form>
      </GlassCard>

      <GlassCard padding="p-0">
        <h3 className="px-5 pt-5 text-[14.5px] font-semibold text-[#16301F]">Sent Notifications</h3>
        <div className="mt-3">
          <DataTable columns={columns} rows={data?.notifications || []} empty="Nothing sent yet." />
        </div>
      </GlassCard>
    </div>
  );
}