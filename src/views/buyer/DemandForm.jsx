import { useState } from "react";
import GlassCard from "../../components/GlassCard.jsx";
import { Field, Notice, ActionButton, FIELD_CLASS } from "../../components/FormBits.jsx";
import { UNITS, todayISO } from "../../models/common";

export default function DemandForm({ initial, editing, submitting, error, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    onSubmit(form);
  }

  return (
    <GlassCard opacity={0.85} padding="p-6" className="max-w-2xl">
      <h2 className="text-[18px] font-semibold text-[#16301F]">{editing ? "Edit Product Request" : "Request Product"}</h2>
      <p className="mt-1 text-[13px] text-gray-500">
        Tell farmers what you need. FarmLink compares requests with available supply.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-5">
        <fieldset disabled={submitting} className="space-y-4">
          <Field label="Product / Crop needed" htmlFor="dm-product">
            <input id="dm-product" className={FIELD_CLASS} value={form.product} onChange={set("product")} maxLength={60} placeholder="e.g. Potato" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity needed" htmlFor="dm-qty">
              <input id="dm-qty" className={FIELD_CLASS} type="number" inputMode="decimal" min="0" step="any" value={form.quantity} onChange={set("quantity")} placeholder="e.g. 200" />
            </Field>
            <Field label="Unit" htmlFor="dm-unit">
              <select id="dm-unit" className={FIELD_CLASS} value={form.unit} onChange={set("unit")}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Needed date" htmlFor="dm-date">
            <input id="dm-date" className={FIELD_CLASS} type="date" min={todayISO()} value={form.neededDate} onChange={set("neededDate")} />
          </Field>

          <Field label="Location" htmlFor="dm-loc">
            <input id="dm-loc" className={FIELD_CLASS} value={form.location} onChange={set("location")} maxLength={100} placeholder="e.g. Pangasinan" />
          </Field>
        </fieldset>

        <div className="mt-4 space-y-3">
          <Notice>{error}</Notice>
          <div className="flex flex-wrap gap-2">
            <ActionButton type="submit" disabled={submitting}>
              {submitting ? "Saving..." : editing ? "Save changes" : "Submit Request"}
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
