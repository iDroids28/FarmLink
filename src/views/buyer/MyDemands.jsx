import { useState, useEffect } from "react";
import { ShoppingCart, Clock, Link2, CheckCircle2, ClipboardList, X } from "lucide-react";
import GlassCard from "../../components/GlassCard.jsx";
import { DataTable, PageHeader, Field, LoadNote, inputCls, primaryBtn, primaryStyle } from "../../components/DemoBits.jsx";
import { StatusBadge, statusTone, formatDate, formatQty } from "../../components/FormBits.jsx";
import useDemandViewModel from "../../viewmodels/useDemandViewModel";
import { EMPTY_DEMAND_FORM, DEMAND_STATUS_LABEL, canCancelDemand } from "../../models/demand/Demand";
import {
  UNITS, todayISO, checkProduct, checkQuantity, checkUnit, checkDate, checkLocation,
} from "../../models/common";

const REQ_ICON = "/reqr.png";
const PRODUCTS = ["Potato", "Tomato", "Rice", "Eggplant", "Corn", "Cabbage", "Lettuce"];

const FILTERS = [
  { label: "All", statuses: null },
  { label: "Open", statuses: ["open"] },
  { label: "Potential Match", statuses: ["potential_match", "pending_confirmation"] },
  { label: "Partially Matched", statuses: ["partially_matched"] },
  { label: "Matched", statuses: ["matched", "completed"] },
  { label: "Cancelled", statuses: ["cancelled", "expired"] },
];

function validate(f) {
  const e = {};
  const set = (k, msg) => { if (msg) e[k] = msg; };
  set("product", checkProduct(f.product));
  set("quantity", checkQuantity(f.quantity));
  set("unit", checkUnit(f.unit));
  set("neededDate", checkDate(f.neededDate, "the needed date", true));
  set("location", checkLocation(f.location));
  return e;
}

const FieldError = ({ message }) => (message ? <p className="mt-1 text-[12px] text-red-600">{message}</p> : null);

export default function MyDemands({ onNavigate, intent }) {
  const vm = useDemandViewModel();
  const { loadDemands, clearMessages } = vm;
  const [filter, setFilter] = useState("All");
  const [form, setForm] = useState(EMPTY_DEMAND_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);

  useEffect(() => {
    loadDemands();
  }, [loadDemands]);

  useEffect(() => {
    if (intent === "create") {
      clearMessages();
      setShowForm(true);
    }
  }, [intent, clearMessages]);

  const mine = vm.demands;
  const countOf = (statuses) => mine.filter((d) => statuses.includes(d.status)).length;
  const active = FILTERS.find((f) => f.label === filter);
  const shown = !active || !active.statuses ? mine : mine.filter((d) => active.statuses.includes(d.status));

  const stats = [
    { label: "Total Requirements", value: mine.length, icon: ShoppingCart },
    { label: "Open", value: countOf(["open"]), icon: Clock },
    { label: "Potential Match", value: countOf(["potential_match", "pending_confirmation"]), icon: Link2 },
    { label: "Partially Matched", value: countOf(["partially_matched"]), icon: ClipboardList },
    { label: "Matched", value: countOf(["matched", "completed"]), icon: CheckCircle2 },
  ];

  const up = (k) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
    setFieldErrors((errs) => (errs[k] ? { ...errs, [k]: undefined } : errs));
  };

  function closeForm() {
    setShowForm(false);
    setFieldErrors({});
    clearMessages();
    onNavigate?.("demands", null);
  }

  async function submit(e) {
    e.preventDefault();
    if (vm.submitting) return;
    const errs = validate(form);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const ok = await vm.createDemand(form);
    if (ok) {
      setForm(EMPTY_DEMAND_FORM);
      setShowForm(false);
      onNavigate?.("demands", null);
    }
  }

  const columns = [
    { key: "code", label: "ID", render: (r) => `DEM-${r.id.slice(-5).toUpperCase()}` },
    {
      key: "product", label: "Product",
      render: (r) => (
        <div>
          <p className="font-medium">{r.product}</p>
          <p className="text-[11.5px] text-gray-500">
            {r.location} | Need: {formatQty(r.quantity)} {r.unit} | Confirmed: {formatQty(r.confirmedQuantity ?? 0)} | Waiting for farmer: {formatQty(r.pendingQuantity ?? 0)} | Remaining: {formatQty(r.remainingQuantity)}
          </p>
        </div>
      ),
    },
    { key: "quantity", label: "Quantity", render: (r) => formatQty(r.quantity) },
    { key: "unit", label: "Unit" },
    { key: "neededDate", label: "Needed Date", render: (r) => formatDate(r.neededDate) },
    {
      key: "status", label: "Status",
      render: (r) => <StatusBadge label={DEMAND_STATUS_LABEL[r.status] || r.status} tone={statusTone(r.status)} />,
    },
    {
      key: "action", label: "Action",
      render: (r) =>
        canCancelDemand(r) ? (
          <button
            type="button"
            onClick={() => vm.cancelDemand(r.id)}
            disabled={vm.submitting}
            className="rounded-md bg-gray-100 px-3 py-1 text-[12px] font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-60"
          >
            Cancel
          </button>
        ) : "—",
    },
  ];

  const errCls = (k) => (fieldErrors[k] ? " !border-red-400" : "");

  return (
    <div className="space-y-6">
      <PageHeader title="My Requirements" subtitle="Manage your product requirements and track their status. Use the + button at the top to create a new one." />
      <LoadNote loading={vm.loading && mine.length === 0} error={showForm ? "" : vm.error} />
      {vm.success && !showForm && <p className="rounded-xl bg-green-50 p-3 text-[13px] text-green-800">{vm.success}</p>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map(({ label, value, icon: Icon }) => (
          <GlassCard key={label}>
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] text-gray-500">{label}</span>
              <Icon size={16} className="text-[#4CAF50]" />
            </div>
            <p className="mt-2 text-[24px] font-bold text-[#16301F]">{value}</p>
          </GlassCard>
        ))}
      </div>

      <GlassCard padding="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
          <h3 className="text-[14.5px] font-semibold text-[#16301F]">My Requirements ({mine.length})</h3>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.label} type="button" onClick={() => setFilter(f.label)}
                className={"rounded-full px-3 py-1 text-[12px] font-medium " + (filter === f.label ? "bg-[#2E7D32] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <DataTable columns={columns} rows={shown} empty="No requirements yet. Click the + button at the top to create one." />
        </div>
      </GlassCard>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => e.target === e.currentTarget && closeForm()}
          role="dialog" aria-modal="true" aria-label="Create New Requirement"
        >
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8F5E9]">
                  {iconFailed ? (
                    <ClipboardList size={20} className="text-[#2E7D32]" />
                  ) : (
                    <img src={REQ_ICON} alt="" className="h-6 w-6 object-contain" onError={() => setIconFailed(true)} />
                  )}
                </span>
                <div>
                  <h3 className="text-[15.5px] font-semibold text-[#16301F]">Create New Requirement</h3>
                  <p className="mb-3 text-[12.5px] text-gray-500">Fill in the details of the product you need.</p>
                </div>
              </div>
              <button type="button" onClick={closeForm} aria-label="Close" className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-3" noValidate>
              <Field label="Product Name" required>
                <input list="product-options" value={form.product} onChange={up("product")} maxLength={60} placeholder="Select or enter product name" className={inputCls + errCls("product")} />
                <datalist id="product-options">{PRODUCTS.map((p) => <option key={p} value={p} />)}</datalist>
                <FieldError message={fieldErrors.product} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantity" required>
                  <input type="number" min="0" step="any" value={form.quantity} onChange={up("quantity")} placeholder="Enter quantity" className={inputCls + errCls("quantity")} />
                  <FieldError message={fieldErrors.quantity} />
                </Field>
                <Field label="Unit" required>
                  <select value={form.unit} onChange={up("unit")} className={inputCls + errCls("unit")}>
                    {UNITS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                  <FieldError message={fieldErrors.unit} />
                </Field>
              </div>
              <Field label="Needed Date" required>
                <input type="date" min={todayISO()} value={form.neededDate} onChange={up("neededDate")} className={inputCls + errCls("neededDate")} />
                <FieldError message={fieldErrors.neededDate} />
              </Field>
              <Field label="Location / Delivery Address" required>
                <input value={form.location} onChange={up("location")} maxLength={100} placeholder="e.g. Pangasinan" className={inputCls + errCls("location")} />
                <FieldError message={fieldErrors.location} />
              </Field>
              {vm.error && <p className="rounded-lg bg-red-50 p-2.5 text-[12.5px] text-red-700">{vm.error}</p>}
              <button type="submit" disabled={vm.submitting} className={primaryBtn + " w-full"} style={primaryStyle}>
                {vm.submitting ? "Submitting..." : "Submit Requirement"}
              </button>
              <p className="rounded-xl bg-blue-50 p-3 text-[12px] text-blue-800">
                Your requirement is compared with supply posted by farmers. A possible match needs the farmer's confirmation.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}