import { useState } from "react";
import { Field, Notice, ActionButton, FIELD_CLASS, formatQty } from "./FormBits.jsx";
import { SUPPLY_TYPES } from "../models/supply/Supply";
import { todayISO } from "../models/common";
import { demandProgress } from "../models/demand/progress";
import useOfferSupplyViewModel from "../viewmodels/useOfferSupplyViewModel";

const FieldError = ({ message }) =>
  message ? <p className="mt-1 text-[12px] text-red-600">{message}</p> : null;

export default function OfferSupplyForm({ demand, onOffered }) {
  const vm = useOfferSupplyViewModel(demand, onOffered);
  const [form, setForm] = useState({ quantity: "", supplyType: "onhand", availabilityDate: "" });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const { remaining } = demandProgress(demand);
  const expected = form.supplyType === "expected";
  const closed = !["open", "potential_match", "partially_matched"].includes(demand.status);

  let blocked = "";
  if (closed) blocked = "This request is closed and no longer accepts offers.";
  else if (demand.hasActiveOffer) blocked = "You already have an offer on this request. Review it on your Matches page.";
  else if (remaining <= 0) blocked = "This request is already fully covered.";

  return (
    <section className="border-t border-black/5 pt-4">
      <p className="mb-2 text-[12.5px] font-semibold uppercase tracking-wide text-gray-500">
        Offer Supply for This Request
      </p>

      {vm.submitted ? (
        <Notice type="success">{vm.success}</Notice>
      ) : blocked ? (
        <p className="rounded-lg bg-[#F4F7F3] p-2.5 text-[12.5px] text-gray-600">{blocked}</p>
      ) : (
        <form
          noValidate
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            vm.submit(form);
          }}
        >
          <fieldset disabled={vm.submitting} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Product (from this request)" htmlFor="of-product">
                <input id="of-product" className={FIELD_CLASS} value={demand.product} readOnly />
              </Field>
              <Field label="Unit (from this request)" htmlFor="of-unit">
                <input id="of-unit" className={FIELD_CLASS} value={demand.unit} readOnly />
              </Field>
            </div>

            <Field label="Fulfilment location (from this request)" htmlFor="of-loc">
              <input id="of-loc" className={FIELD_CLASS} value={demand.location} readOnly />
            </Field>

            <div role="radiogroup" aria-label="Supply type" className="grid grid-cols-2 gap-2">
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
                      "rounded-xl border px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] " +
                      (on ? "border-[#4CAF50] bg-[#F4F7F3]" : "border-[#DCE7DC] bg-white hover:bg-[#F4F7F3]")
                    }
                  >
                    <span className="block text-[13px] font-semibold text-[#1B5E20]">{t.label}</span>
                    <span className="mt-0.5 block text-[11.5px] text-gray-500">{t.hint}</span>
                  </button>
                );
              })}
            </div>
            <FieldError message={vm.fieldErrors.supplyType} />

            <Field
              label={`${expected ? "Estimated quantity" : "Quantity you can provide"} (${demand.unit})`}
              htmlFor="of-qty"
              hint={`Up to ${formatQty(remaining)} ${demand.unit} is still needed.`}
            >
              <input
                id="of-qty"
                className={FIELD_CLASS + (vm.fieldErrors.quantity ? " !border-red-400" : "")}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={form.quantity}
                onChange={set("quantity")}
              />
              <FieldError message={vm.fieldErrors.quantity} />
            </Field>

            <Field label={expected ? "Expected harvest date" : "Available since"} htmlFor="of-date">
              <input
                id="of-date"
                className={FIELD_CLASS + (vm.fieldErrors.availabilityDate ? " !border-red-400" : "")}
                type="date"
                min={expected ? todayISO() : undefined}
                max={String(demand.neededDate).slice(0, 10)}
                value={form.availabilityDate}
                onChange={set("availabilityDate")}
              />
              <FieldError message={vm.fieldErrors.availabilityDate} />
            </Field>
          </fieldset>

          <p className="rounded-lg bg-[#F4F7F3] p-2.5 text-[12px] text-gray-600">
            A pending offer reserves this quantity until you confirm or decline it on your Matches page.
            Other farmers see it as covered meanwhile.
          </p>

          <Notice>{vm.error}</Notice>
          <ActionButton type="submit" disabled={vm.submitting}>
            {vm.submitting ? "Submitting..." : "Submit Offer"}
          </ActionButton>
        </form>
      )}
    </section>
  );
}
