import { useCallback, useRef, useState } from "react";
import { getUserMessage } from "../AuthShared";
import { demandRepository } from "../repositories/demandRepository";
import { validateDemandInput, toDemandPayload } from "../models/demand/Demand";

export default function useDemandViewModel() {
  const [demands, setDemands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const busy = useRef(false);

  const clearMessages = useCallback(() => {
    setError("");
    setSuccess("");
  }, []);

  const loadDemands = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDemands(await demandRepository.listMine());
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
      setDemands(await demandRepository.listMine());
    } catch {
      /* saved; list refreshes on next load */
    }
    busy.current = false;
    setSubmitting(false);
    return true;
  }

  async function createDemand(form) {
    const problem = validateDemandInput(form);
    if (problem) {
      setSuccess("");
      setError(problem);
      return false;
    }
    return mutate(() => demandRepository.create(toDemandPayload(form)), "Demand submitted successfully.");
  }

  async function updateDemand(id, form) {
    const problem = validateDemandInput(form);
    if (problem) {
      setSuccess("");
      setError(problem);
      return false;
    }
    return mutate(() => demandRepository.update(id, toDemandPayload(form)), "Demand updated successfully.");
  }

  function cancelDemand(id) {
    return mutate(() => demandRepository.cancel(id), "Product request cancelled.");
  }

  return {
    demands, loading, submitting, error, success,
    loadDemands, refreshDemands: loadDemands,
    createDemand, updateDemand, cancelDemand, clearMessages,
  };
}
