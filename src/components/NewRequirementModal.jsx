import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Field, inputCls, primaryBtn, primaryStyle } from "./DemoBits.jsx";
import { api, getUserMessage } from "../api/farmlinkApi.js";

const PRODUCTS = ["Tomatoes", "Rice", "Eggplant", "Corn", "Cabbage", "Lettuce"];
const UNITS = ["kg", "sack", "piece", "bundle"];
const EMPTY = { product: "", quantity: "", unit: "kg", neededDate: "", location: "", targetPrice: "", notes: "" };

export default function NewRequirementModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const up = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (!form.product.trim()) return setError("Please enter the product name.");
    if (!(Number(form.quantity) > 0)) return setError("Please enter a valid quantity.");
    if (!form.neededDate) return setError("Please select the needed date.");
    if (!form.location.trim()) return setError("Please enter the delivery location.");
    setBusy(true);
    api
      .post("/requirements", form)
      .then(() => {
        setForm(EMPTY);
        onCreated?.();
        onClose();
      })
      .catch((err) => setError(getUserMessage(err)))
      .finally(() => setBusy(false));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog" aria-modal="true" aria-label="Create New Requirement"
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-[15.5px] font-semibold text-[#16301F]">Create New Requirement</h3>
            <p className="mb-3 text-[12.5px] text-gray-500">Fill in the details of the product you need.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3" noValidate>
          <Field label="Product Name" required>
            <input list="product-options" value={form.product} onChange={up("product")} placeholder="Select or enter product name" className={inputCls} />
            <datalist id="product-options">{PRODUCTS.map((p) => <option key={p} value={p} />)}</datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity" required>
              <input type="number" min="1" value={form.quantity} onChange={up("quantity")} placeholder="Enter quantity" className={inputCls} />
            </Field>
            <Field label="Unit" required>
              <select value={form.unit} onChange={up("unit")} className={inputCls}>
                {UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Needed Date" required>
            <input type="date" value={form.neededDate} onChange={up("neededDate")} className={inputCls} />
          </Field>
          <Field label="Location / Delivery Address" required>
            <input value={form.location} onChange={up("location")} placeholder="e.g. Dagupan, Pangasinan" className={inputCls} />
          </Field>
          <Field label="Target Price (Optional)">
            <input type="number" min="0" value={form.targetPrice} onChange={up("targetPrice")} placeholder="Enter target price (₱)" className={inputCls} />
          </Field>
          <Field label="Additional Notes (Optional)">
            <textarea rows={3} value={form.notes} onChange={up("notes")} placeholder="Preferred quality, delivery time, etc." className={inputCls} />
          </Field>
          {error && <p className="text-[12.5px] text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className={primaryBtn + " w-full"} style={primaryStyle}>
            {busy ? "Submitting..." : "Submit Requirement"}
          </button>
          <p className="rounded-xl bg-blue-50 p-3 text-[12px] text-blue-800">
            Your requirement will be visible to approved farmers/sellers and matched based on availability.
          </p>
        </form>
      </div>
    </div>
  );
}