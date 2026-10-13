import { useRef, useState } from "react";
import { getUserMessage } from "../AuthShared";
import { demandRepository } from "../repositories/demandRepository";
import { checkQuantity, checkDate } from "../models/common";
import { SUPPLY_TYPES } from "../models/supply/Supply";
import { demandProgress } from "../models/demand/progress";

const SUCCESS_MESSAGE =
  "Offer submitted. Please review it and confirm or decline it from your Matches page.";

/* State + validation for the Offer Supply form. The server re-checks everything. */
export default function useOfferSupplyViewModel(demand, onOffered) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const busy = useRef(false); // blocks double-clicks; the DB index blocks real duplicates

  function validate(form) {
    const e = {};
    const expected = form.supplyType === "expected";

    if (!SUPPLY_TYPES.some((t) => t.id === form.supplyType)) {
      e.supplyType = "Please choose a supply type.";
    }

    const quantityError = checkQuantity(form.quantity);
    if (quantityError) {
      e.quantity = quantityError;
    } else {
      const { remaining } = demandProgress(demand);
      if (Number(form.quantity) > remaining) {
        e.quantity = `Only ${remaining} ${demand.unit} is still needed for this request.`;
      }
    }

    const dateError = checkDate(
      form.availabilityDate,
      expected ? "the expected harvest date" : "the availability date",
      expected
    );
    if (dateError) {
      e.availabilityDate = dateError;
    } else if (
      form.availabilityDate > String(demand.neededDate).slice(0, 10)
    ) {
      e.availabilityDate = "The availability date must be on or before the needed date.";
    }

    return e;
  }

  async function submit(form) {
    if (busy.current || submitted) return false;

    const errors = validate(form);
    setFieldErrors(errors);
    setError("");
    setSuccess("");
    if (Object.keys(errors).length) return false;

    busy.current = true;
    setSubmitting(true);

    try {
      await demandRepository.offerSupply(demand.id, {
        product: demand.product,
        unit: demand.unit,
        quantity: Number(form.quantity),
        supplyType: form.supplyType,
        availabilityDate: form.availabilityDate,
      });
      setSubmitted(true);
      setSuccess(SUCCESS_MESSAGE);
      try {
        await onOffered?.(); // refresh request totals from actual Match records
      } catch {
        // The offer itself was saved; the page can refresh on its normal poll.
      }
      return true;
    } catch (err) {
      setError(getUserMessage(err));
      return false;
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }

  return { submitting, submitted, error, success, fieldErrors, submit };
}
