import { useCallback, useRef, useState } from "react";
import { getUserMessage } from "../AuthShared";
import { supplyRepository } from "../repositories/supplyRepository";
import { validateSupplyInput, toSupplyPayload } from "../models/supply/Supply";

/* ViewModel for the farmer's own supply: holds the list and the
   loading / submitting / error / success state. Views never call the API. */
export default function useSupplyViewModel() {
  const [supplies, setSupplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const busy = useRef(false); // blocks duplicate submits

  const clearMessages = useCallback(() => {
    setError("");
    setSuccess("");
  }, []);

  const loadSupplies = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSupplies(await supplyRepository.listMine());
    } catch (err) {
      setError(getUserMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  async function mutate(action, okMessage) {
    if (busy.current) return false;
    busy.current = true;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await action();
    } catch (err) {
      setError(getUserMessage(err));
      busy.current = false;
      setSubmitting(false);
      return false;
    }
    setSuccess(okMessage);
    try {
      setSupplies(await supplyRepository.listMine());
    } catch {
      /* the change itself was saved; the list refreshes on the next load */
    }
    busy.current = false;
    setSubmitting(false);
    return true;
  }

  async function createSupply(form) {
    const problem = validateSupplyInput(form);
    if (problem) {
      setSuccess("");
      setError(problem);
      return false;
    }
    return mutate(() => supplyRepository.create(toSupplyPayload(form)), "Supply posted.");
  }

  async function updateSupply(id, form) {
    const problem = validateSupplyInput(form);
    if (problem) {
      setSuccess("");
      setError(problem);
      return false;
    }
    return mutate(() => supplyRepository.update(id, toSupplyPayload(form)), "Supply updated.");
  }

  function cancelSupply(id) {
    return mutate(() => supplyRepository.cancel(id), "Supply cancelled.");
  }

  return {
    supplies, loading, submitting, error, success,
    loadSupplies, refreshSupplies: loadSupplies,
    createSupply, updateSupply, cancelSupply, clearMessages,
  };
}
