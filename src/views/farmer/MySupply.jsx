import { useState, useEffect } from "react";
import { X } from "lucide-react";
import GlassCard from "../../components/GlassCard.jsx";
import { DataTable, PageHeader, Field, LoadNote, inputCls, primaryBtn, primaryStyle } from "../../components/DemoBits.jsx";
import { StatusBadge, statusTone, formatDate, formatQty } from "../../components/FormBits.jsx";
import useSupplyViewModel from "../../viewmodels/useSupplyViewModel";
import {
  EMPTY_SUPPLY_FORM, SUPPLY_TYPES, SUPPLY_TYPE_LABEL, SUPPLY_STATUS_LABEL, canChangeSupply,
} from "../../models/supply/Supply";
import {
  UNITS, todayISO, checkProduct, checkQuantity, checkUnit, checkDate, checkLocation,
} from "../../models/common";

const PRODUCTS = ["Potato", "Tomato", "Rice", "Eggplant", "Corn", "Cabbage", "Lettuce", "Carrots"];

// Same rules as the server (models/common.js mirrors farmValidation.js).
function validate(f) {
  const e = {};
  const set = (k, msg) => { if (msg) e[k] = msg; };
  if (!SUPPLY_TYPES.some((t) => t.id === f.supplyType)) e.supplyType = "Please choose a supply type.";
  const expected = f.supplyType === "expected";
  set("product", checkProduct(f.product));
  set("quantity", checkQuantity(f.quantity));
  set("unit", checkUnit(f.unit));
  set("availabilityDate", checkDate(f.availabilityDate, expected ? "the expected harvest date" : "the availability date", expected));
  set("location", checkLocation(f.location));
  return e;
}

const FieldError = ({ message }) => (message ? <p className="mt-1 text-[12px] text-red-600">{message}</p> : null);

export default function MySupply({ intent, onNavigate }) {
  const vm = useSupplyViewModel();
  const { loadSupplies, clearMessages } = vm;
  const [form, setForm] = useState(EMPTY_SUPPLY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadSupplies();
  }, [loadSupplies]);

  // The "+" button in the top bar sends intent = "create".
  useEffect(() => {
    if (intent === "create") {
      clearMessages();
      setShowForm(true);
    }
  }, [intent, clearMessages]);

  const up = (k) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
    setFieldErrors((errs) => (errs[k] ? { ...errs, [k]: undefined } : errs));
  };

  function closeForm() {
    setShowForm(false);
    setFieldErrors({});
    clearMessages();
    onNavigate?.("supply", null);
  }

  async function submit(e) {
    e.preventDefault();
    if (vm.submitting) return;
    const errs = validate(form);
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    const ok = await vm.createSupply(form);
    if (ok) {
      setForm(EMPTY_SUPPLY_FORM);
      setShowForm(false);
      onNavigate?.("supply", null);
    }
  }

  const supplies = vm.supplies;
  const expected = form.supplyType === "expected";
  const typeHint = SUPPLY_TYPES.find((t) => t.id === form.supplyType)?.hint;

  const columns = [
    { key: "code", label: "ID", render: (r) => `SUP-${r.id.slice(-5).toUpperCase()}` },
    {
      key: "product", label: "Product",
      render: (r) => (
        <div>
          <p className="font-medium">{r.product}</p>
          <p className="text-[11.5px] text-gray-500">{SUPPLY_TYPE_LABEL[r.supplyType] || r.supplyType} | {r.location}</p>
        </div>
      ),
    },
    {
      key: "quantity", label: "Quantity",
      render: (r) => (
        <div>
          <p>{formatQty(r.availableQuantity)} {r.unit} available</p>
          <p className="text-[11.5px] text-gray-500">Total {formatQty(r.quantity)} | Reserved {formatQty(r.reservedQuantity)}</p>
        </div>
      ),
    },
    { key: "availabilityDate", label: "Available", render: (r) => formatDate(r.availabilityDate) },
    {
      key: "status", label: "Status",
      render: (r) => <StatusBadge label={SUPPLY_STATUS_LABEL[r.status] || r.status} tone={statusTone(r.status)} />,
    },
    {
      key: "action", label: "Action",
      render: (r) =>
        canChangeSupply(r) ? (
          <button
            type="button"
            onClick={() => vm.cancelSupply(r.id)}
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
      <PageHeader
        title="My Supply"
        subtitle="Post what you can supply. Buyers see the product, quantity, date and location, not your name. Use the + button at the top to add one."
      />
      <LoadNote loading={vm.loading && supplies.length === 0} error={showForm ? "" : vm.error} />
      {vm.success && !showForm && <p className="rounded-xl bg-green-50 p-3 text-[13px] text-green-800">{vm.success}</p>}

      <GlassCard padding="p-0">
        <h3 className="px-5 pt-5 text-[14.5px] font-semibold text-[#16301F]">My Products ({supplies.length})</h3>
        <div className="mt-3">
          <DataTable columns={columns} rows={supplies} empty="No supply yet. Click the + button at the top to post your first product." />
        </div>
      </GlassCard>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => e.target === e.currentTarget && closeForm()}
          role="dialog" aria-modal="true" aria-label="Add Supply"
        >
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[15.5px] font-semibold text-[#16301F]">Add Supply</h3>
                <p className="mb-3 text-[12.5px] text-gray-500">Buyers see the product, quantity, date and location only.</p>
              </div>
              <button type="button" onClick={closeForm} aria-label="Close" className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-3" noValidate>
              <Field label="Supply Type" required>
                <select value={form.supplyType} onChange={up("supplyType")} className={inputCls + errCls("supplyType")}>
                  {SUPPLY_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                {typeHint && <p className="mt-1 text-[11.5px] text-gray-500">{typeHint}</p>}
                <FieldError message={fieldErrors.supplyType} />
              </Field>
              <Field label="Product Name" required>
                <input list="supply-products" value={form.product} onChange={up("product")} maxLength={60} placeholder="e.g. Potato" className={inputCls + errCls("product")} />
                <datalist id="supply-products">{PRODUCTS.map((p) => <option key={p} value={p} />)}</datalist>
                <FieldError message={fieldErrors.product} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={expected ? "Estimated Quantity" : "Quantity"} required>
                  <input type="number" min="0" step="any" value={form.quantity} onChange={up("quantity")} placeholder="e.g. 30" className={inputCls + errCls("quantity")} />
                  <FieldError message={fieldErrors.quantity} />
                </Field>
                <Field label="Unit" required>
                  <select value={form.unit} onChange={up("unit")} className={inputCls + errCls("unit")}>
                    {UNITS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                  <FieldError message={fieldErrors.unit} />
                </Field>
              </div>
              <Field label={expected ? "Expected Harvest Date" : "Available Since"} required>
                <input type="date" min={expected ? todayISO() : undefined} value={form.availabilityDate} onChange={up("availabilityDate")} className={inputCls + errCls("availabilityDate")} />
                <FieldError message={fieldErrors.availabilityDate} />
              </Field>
              <Field label="Farm Location" required>
                <input value={form.location} onChange={up("location")} maxLength={100} placeholder="e.g. Pangasinan" className={inputCls + errCls("location")} />
                <FieldError message={fieldErrors.location} />
              </Field>
              {vm.error && <p className="rounded-lg bg-red-50 p-2.5 text-[12.5px] text-red-700">{vm.error}</p>}
              <button type="submit" disabled={vm.submitting} className={primaryBtn + " w-full"} style={primaryStyle}>
                {vm.submitting ? "Saving..." : "Post Supply"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}