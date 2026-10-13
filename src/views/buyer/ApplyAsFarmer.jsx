import { useState, useEffect } from "react";
import GlassCard from "../../components/GlassCard.jsx";
import StatusNotice from "../../components/StatusNotice.jsx";
import { PageHeader, Field, StatusBadge, LoadNote, inputCls, primaryBtn, primaryStyle } from "../../components/DemoBits.jsx";
import { api, useLoad, getUserMessage } from "../../api/farmlinkApi.js";

const EMPTY = { farmName: "", location: "", contact: "", products: "", farmSize: "", description: "" };
const FIELDS = Object.keys(EMPTY);

const STATUS_TEXT = {
  Pending: "Pending: your application is waiting for admin review.",
  Approved: "Approved by admin! My Supply is now unlocked.",
  Rejected: "Rejected by admin. Update your details below and apply again.",
};

export default function ApplyAsFarmer({ user, onNavigate, onRefreshUser }) {
  const { data, loading, error: loadError, reload } = useLoad("/applications/mine");
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [switching, setSwitching] = useState(false);

  const mine = data?.application;
  // The form shows ONLY when there is no application yet, or when the last
  // one was rejected. It is hidden while Pending and after Approved.
  const canApply = !loading && (!mine || mine.status === "Rejected");
  const up = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // After a rejection, fill the form with the old details so the applicant
  // only needs to fix what is wrong.
  useEffect(() => {
    if (mine?.status !== "Rejected") return;
    setForm(FIELDS.reduce((o, k) => ({ ...o, [k]: mine[k] ?? "" }), {}));
  }, [mine?.id, mine?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // While Pending, check again every 10 seconds so the decision shows up.
  useEffect(() => {
    if (mine?.status !== "Pending") return;
    const timer = setInterval(() => reload(), 10000);
    return () => clearInterval(timer);
  }, [mine?.status, reload]);

  // When the admin approves, re-read the account so My Supply unlocks.
  useEffect(() => {
    if (mine?.status === "Approved" && user?.role !== "farmer") {
      Promise.resolve(onRefreshUser?.()).catch(() => {});
    }
  }, [mine?.status, user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  function submit(e) {
    e.preventDefault();
    if (busy || !canApply) return;
    setError("");
    setDone(false);
    if (!form.farmName.trim()) return setError("Please enter your farm name.");
    if (!form.location.trim()) return setError("Please enter your farm location.");
    if (!form.contact.trim()) return setError("Please enter your contact number.");
    if (!form.products.trim()) return setError("Please list the products you sell.");
    setBusy(true);
    api
      .post("/applications", form)
      .then(() => {
        setForm(EMPTY);
        setDone(true);
        return reload();
      })
      .catch((err) => setError(getUserMessage(err)))
      .finally(() => setBusy(false));
  }

  function unlockSeller() {
    setSwitching(true);
    setError("");
    Promise.resolve(onRefreshUser?.())
      .catch((err) => setError(getUserMessage(err)))
      .finally(() => setSwitching(false));
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Apply as a Farmer / Seller" subtitle="Submit your details. An admin will review your application." />
      <LoadNote loading={loading && !data} error={loadError} />

      <StatusNotice user={user} application={mine} />

      {done && (
        <p className="rounded-xl bg-green-50 p-3 text-[13px] text-green-800">
          Application submitted! It is now Pending admin review.
        </p>
      )}

      {mine && (
        <GlassCard>
          <div className="flex items-center gap-3">
            <span className="text-[13.5px] font-semibold text-[#16301F]">Application status:</span>
            <StatusBadge status={mine.status} />
          </div>
          <p className="mt-2 text-[13px] text-gray-600">{STATUS_TEXT[mine.status]}</p>
          {mine.status === "Rejected" && (mine.adminNote || mine.reason || mine.rejectionReason) && (
            <p className="mt-1 text-[13px] text-red-600">
              Reason: {mine.adminNote || mine.reason || mine.rejectionReason}
            </p>
          )}

          {mine.status === "Approved" && user?.role !== "farmer" && (
            <div className="mt-3">
              <button type="button" onClick={unlockSeller} disabled={switching} className={primaryBtn} style={primaryStyle}>
                {switching ? "Unlocking..." : "Unlock My Supply"}
              </button>
            </div>
          )}

          {mine.status === "Approved" && user?.role === "farmer" && (
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => onNavigate?.("supply")} className={primaryBtn} style={primaryStyle}>
                Go to My Supply
              </button>
              <button
                type="button"
                onClick={() => onNavigate?.("dashboard")}
                className="rounded-md bg-gray-100 px-4 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-200"
              >
                Back to Dashboard
              </button>
            </div>
          )}

          {error && mine.status === "Approved" && <p className="mt-2 text-[12.5px] text-red-600">{error}</p>}
        </GlassCard>
      )}

      {canApply && (
        <GlassCard>
          <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2" noValidate>
            <Field label="Farm Name" required>
              <input value={form.farmName} onChange={up("farmName")} placeholder="Enter your farm name" className={inputCls} />
            </Field>
            <Field label="Farm Location" required>
              <input value={form.location} onChange={up("location")} placeholder="e.g. Dagupan, Pangasinan" className={inputCls} />
            </Field>
            <Field label="Contact Number" required>
              <input value={form.contact} onChange={up("contact")} placeholder="09XXXXXXXXX" className={inputCls} />
            </Field>
            <Field label="Farm Size (hectares)">
              <input type="number" min="0" value={form.farmSize} onChange={up("farmSize")} placeholder="e.g. 2" className={inputCls} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Products You Sell" required>
                <input value={form.products} onChange={up("products")} placeholder="e.g. Tomatoes, Rice, Eggplant" className={inputCls} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Additional Information">
                <textarea rows={3} value={form.description} onChange={up("description")} className={inputCls} />
              </Field>
            </div>
            {error && mine?.status !== "Approved" && <p className="text-[12.5px] text-red-600 sm:col-span-2">{error}</p>}
            <div className="sm:col-span-2">
              <button type="submit" disabled={busy} className={primaryBtn + " w-full"} style={primaryStyle}>
                {busy ? "Submitting..." : mine ? "Apply Again" : "Submit Application"}
              </button>
            </div>
          </form>
        </GlassCard>
      )}
    </div>
  );
}