import { useState } from "react";
import GlassCard from "../../components/GlassCard.jsx";
import { Field, Notice, ActionButton, FIELD_CLASS } from "../../components/FormBits.jsx";
import { UNITS, todayISO } from "../../models/common";
import { SUPPLY_TYPES } from "../../models/supply/Supply";

// Collects input only. Validation and saving happen in the ViewModel.
export default function SupplyForm({ initial, editing, submitting, error, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const expected = form.supplyType === "expected";

  function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    onSubmit(form);
  }

  return (
    <GlassCard opacity={0.85} padding="p-6" className="max-w-2xl">
      <h2 className="text-[18px] font-semibold text-[#16301F]">{editing ? "Edit Supply" : "Post Supply"}</h2>
      <p className="mt-1 text-[13px] text-gray-500">
        Share what you can supply. Buyers will see the product, quantity, date and location, not your name or email.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-5">
        <fieldset disabled={submitting} className="space-y-4">
          <div role="radiogroup" aria-label="Supply type" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SUPPLY_TYPES.map((t) => {
              const on = form.supplyType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setForm((f) => ({ ...f, supplyType: t.id }))}
                  className={
                    "rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] " +
                    (on ? "border-[#4CAF50] bg-[#F4F7F3]" : "border-[#DCE7DC] bg-white hover:bg-[#F4F7F3]")
                  }
                >
                  <span className="block text-[13.5px] font-semibold text-[#1B5E20]">{t.label}</span>
                  <span className="mt-0.5 block text-[12px] text-gray-500">{t.hint}</span>
                </button>
              );
            })}
          </div>

          <Field label="Product / Crop" htmlFor="sp-product">
            <input id="sp-product" className={FIELD_CLASS} value={form.product} onChange={set("product")} maxLength={60} placeholder="e.g. Potato" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={expected ? "Estimated quantity" : "Quantity available"} htmlFor="sp-qty">
              <input id="sp-qty" className={FIELD_CLASS} type="number" inputMode="decimal" min="0" step="any" value={form.quantity} onChange={set("quantity")} placeholder="e.g. 150" />
            </Field>
            <Field label="Unit" htmlFor="sp-unit">
              <select id="sp-unit" className={FIELD_CLASS} value={form.unit} onChange={set("unit")}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            label={expected ? "Expected harvest date" : "Available since"}
            htmlFor="sp-date"
            hint={expected ? "Expected supply is an estimate and is not guaranteed." : undefined}
          >
            <input id="sp-date" className={FIELD_CLASS} type="date" min={expected ? todayISO() : undefined} value={form.availabilityDate} onChange={set("availabilityDate")} />
          </Field>

          <Field label="Location" htmlFor="sp-loc">
            <input id="sp-loc" className={FIELD_CLASS} value={form.location} onChange={set("location")} maxLength={100} placeholder="e.g. Pangasinan" />
          </Field>
        </fieldset>

        <div className="mt-4 space-y-3">
          <Notice>{error}</Notice>
          <div className="flex flex-wrap gap-2">
            <ActionButton type="submit" disabled={submitting}>
              {submitting ? "Saving..." : editing ? "Save changes" : "Post Supply"}
            </ActionButton>
            <ActionButton variant="secondary" onClick={onCancel} disabled={submitting}>
              Back
            </ActionButton>
          </div>
        </div>
      </form>
    </GlassCard>
  );
}
