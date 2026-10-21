import { useState, useEffect } from "react";
import { ShoppingCart, Clock, Link2, CheckCircle2, ClipboardList, X } from "lucide-react";
import GlassCard from "../../components/GlassCard.jsx";
import { DataTable, PageHeader, Field, LoadNote, inputCls, primaryBtn, primaryStyle } from "../../components/DemoBits.jsx";
import { StatusBadge, statusTone, formatDate, formatQty } from "../../components/FormBits.jsx";
import useDemandViewModel from "../../viewmodels/useDemandViewModel";
import { EMPTY_DEMAND_FORM, DEMAND_CATEGORIES, DEMAND_STATUS_LABEL, canCancelDemand } from "../../models/demand/Demand";
import {
  UNITS, todayISO, checkQuantity, checkUnit, checkDate, checkLocation,
} from "../../models/common";
import LocationPicker from "../../components/LocationPicker.jsx";

const REQ_ICON = "/reqr.png";

const BLANK_FORM = { ...EMPTY_DEMAND_FORM, category: "", unit: "kg" };
const DEMAND_PRODUCT_RE = /^\p{L}{2,60}$/u;

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
  set("product", DEMAND_PRODUCT_RE.test(String(f.product || "").trim())
    ? null
    : "Use 2–60 letters only. Spaces, numbers, and special characters are not allowed.");
  set("category", DEMAND_CATEGORIES.includes(f.category) ? null : "Choose a product category.");
  const quantityError = checkQuantity(f.quantity);
  set("quantity", quantityError || (Number(f.quantity) < 25 ? `Minimum quantity is 25 ${f.unit || "units"}.` : null));
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
  const [form, setForm] = useState(BLANK_FORM);
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
    { label: "Total Demands", value: mine.length, icon: ShoppingCart },
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

  const upLettersOnly = (k) => (e) => {
    const value = e.target.value.replace(/[^\p{L}]/gu, "").slice(0, 60);
    setForm((f) => ({ ...f, [k]: value }));
    setFieldErrors((errs) => (errs[k] ? { ...errs, [k]: undefined } : errs));
  };

  const setLocation = (value) => {
    setForm((f) => ({ ...f, location: value }));
    setFieldErrors((errs) => (errs.location ? { ...errs, location: undefined } : errs));
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
    const payload = { ...form };
    const errs = validate(payload);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const ok = await vm.createDemand(payload);
    if (ok) {
      setForm(BLANK_FORM);
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
          {r.category && <p className="text-[11px] text-[#55815A]">{r.category}</p>}
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
      <PageHeader title="My Demands" subtitle="Tell farmers what your business needs, then track possible matches and confirmations." />
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
          <h3 className="text-[14.5px] font-semibold text-[#16301F]">My Demands ({mine.length})</h3>
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
          <DataTable columns={columns} rows={shown} empty="No demands yet. Use Create a Demand to tell farmers what you need." />
        </div>
      </GlassCard>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#102615]/45 p-3 backdrop-blur-[2px] sm:p-5"
          onMouseDown={(e) => e.target === e.currentTarget && closeForm()}
          role="dialog" aria-modal="true" aria-label="Create a Demand"
        >
          <div className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[#DDEBDD] bg-white p-4 shadow-[0_24px_80px_rgba(14,54,26,0.24)] sm:p-7">
            <div className="rounded-2xl border border-[#DCEBDD] bg-gradient-to-br from-[#EEF8EA] via-white to-[#F7FBF5] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#DFF0D9] text-[#287238] shadow-sm">
                    {iconFailed ? (
                      <ClipboardList size={23} />
                    ) : (
                      <img src={REQ_ICON} alt="" className="h-7 w-7 object-contain" onError={() => setIconFailed(true)} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <span className="inline-flex rounded-full border border-[#CFE5CA] bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#357342]">Business / Buyer</span>
                    <h3 className="mt-2 text-xl font-bold tracking-tight text-[#16301F] sm:text-2xl">Create a Demand</h3>
                    <p className="mt-1 max-w-md text-[12.5px] leading-5 text-gray-600">Tell nearby farmers which product you need, the quantity, and the date you need it.</p>
                  </div>
                </div>
                <button type="button" onClick={closeForm} aria-label="Close" className="rounded-xl border border-transparent p-2 text-gray-500 transition hover:border-gray-200 hover:bg-white hover:text-gray-800">
                  <X size={19} />
                </button>
              </div>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Product Name" required>
                  <input
                    value={form.product}
                    onChange={upLettersOnly("product")}
                    maxLength={60}
                    autoComplete="off"
                    placeholder="e.g. Milk"
                    className={inputCls + errCls("product")}
                    aria-describedby="demand-product-help"
                  />
                  <p id="demand-product-help" className="mt-1.5 text-[11px] leading-4 text-gray-500">Letters only. No spaces, numbers, or special characters.</p>
                  <FieldError message={fieldErrors.product} />
                </Field>
                <Field label="Category" required>
                  <select value={form.category} onChange={up("category")} className={inputCls + errCls("category")}>
                    <option value="">Select product category</option>
                    {DEMAND_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                  <FieldError message={fieldErrors.category} />
                </Field>
              </div>

              <div className="rounded-2xl border border-[#E0EBDD] bg-[#F8FCF6] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-[13px] font-bold text-[#203D25]">Quantity needed</h4>
                    <p className="mt-0.5 text-[11.5px] text-gray-500">Minimum: 25 in the selected unit</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#397345] ring-1 ring-[#D8E9D2]">Required</span>
                </div>
                <div className="grid grid-cols-[1fr_0.85fr] gap-3">
                  <Field label="Quantity" htmlFor="demand-quantity" required>
                    <input id="demand-quantity" type="number" min="25" max="1000000" step="any" inputMode="decimal" value={form.quantity} onChange={up("quantity")} placeholder="Minimum 25" className={inputCls + errCls("quantity")} />
                    <FieldError message={fieldErrors.quantity} />
                  </Field>
                  <Field label="Unit" htmlFor="demand-unit" required>
                    <select id="demand-unit" value={form.unit} onChange={up("unit")} className={inputCls + errCls("unit")}>
                      {UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                    </select>
                    <FieldError message={fieldErrors.unit} />
                  </Field>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Needed Date" htmlFor="demand-date" required>
                  <input id="demand-date" type="date" min={todayISO()} value={form.neededDate} onChange={up("neededDate")} className={inputCls + errCls("neededDate")} />
                  <FieldError message={fieldErrors.neededDate} />
                </Field>
                <Field label="Location / Delivery Address" htmlFor="demand-location" required>
                  <LocationPicker value={form.location} onChange={setLocation} invalid={Boolean(fieldErrors.location)} />
                  <FieldError message={fieldErrors.location} />
                </Field>
              </div>

              {vm.error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-[12.5px] text-red-700">{vm.error}</p>}

              <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row">
                <button type="button" onClick={closeForm} disabled={vm.submitting} className="min-h-11 rounded-xl border border-[#DDE7DC] bg-white px-5 py-3 text-[13px] font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-60 sm:w-1/3">
                  Cancel
                </button>
                <button type="submit" disabled={vm.submitting} className={primaryBtn + " min-h-11 flex-1 justify-center rounded-xl px-5 py-3 text-[13px] font-bold shadow-[0_8px_18px_rgba(46,125,50,0.2)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"} style={primaryStyle}>
                  {vm.submitting ? "Submitting Demand..." : "Submit Demand"}
                </button>
              </div>

              <p className="flex items-start gap-2 rounded-xl border border-[#DDEEDD] bg-[#F4FAF1] p-3 text-[11.5px] leading-5 text-[#43694A]">
                <Link2 size={15} className="mt-0.5 shrink-0" />
                FarmLink compares your demand with farmers’ supply. A possible match still needs the farmer’s confirmation.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}