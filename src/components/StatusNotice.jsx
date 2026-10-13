import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

// Shows a one-time notice when the admin approves or rejects the seller
// application. Dismissing it remembers the decision, so it will not nag again.
export default function StatusNotice({ user, application }) {
  const status = application?.status;
  const token = `${application?.id ?? ""}:${status}`;
  const key = `farmlink:appSeen:${user?.id ?? user?.email ?? "me"}`;
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (status !== "Approved" && status !== "Rejected") return setShow(false);
    let seen = "";
    try { seen = localStorage.getItem(key) || ""; } catch { /* storage blocked */ }
    setShow(seen !== token);
  }, [status, token, key]);

  if (!show) return null;

  function dismiss() {
    try { localStorage.setItem(key, token); } catch { /* ignore */ }
    setShow(false);
  }

  const approved = status === "Approved";
  const reason = application?.adminNote || application?.reason || application?.rejectionReason;

  return (
    <div
      role="status"
      className={
        "flex items-start gap-3 rounded-xl p-3.5 text-[13.5px] " +
        (approved ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700")
      }
    >
      <Bell size={17} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {approved ? "Your seller application was approved!" : "Your seller application was rejected."}
        </p>
        <p className="mt-0.5">
          {approved
            ? "My Supply is now unlocked. You can post products for buyers to see."
            : "Update your details in the form below and apply again."}
        </p>
        {!approved && reason && <p className="mt-1">Reason: {reason}</p>}
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="shrink-0 rounded p-1 hover:bg-black/5">
        <X size={16} />
      </button>
    </div>
  );
}