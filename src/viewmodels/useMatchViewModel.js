import { useCallback, useRef, useState } from "react";
import { getUserMessage } from "../AuthShared";
import { matchRepository } from "../repositories/matchRepository";

export default function useMatchViewModel() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const busy = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setMatches(await matchRepository.listMine());
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
    let ok = true;
    try {
      await action();
      setSuccess(okMessage);
    } catch (err) {
      setError(getUserMessage(err));
      ok = false;
    }
    try {
      setMatches(await matchRepository.listMine());
    } catch {
      /* list refreshes on next load */
    }
    busy.current = false;
    setSubmitting(false);
    return ok;
  }

  const confirm = (id) => mutate(() => matchRepository.confirm(id), "Match accepted.");
  const decline = (id) => mutate(() => matchRepository.decline(id), "Match declined.");
  const cancel = (id) => mutate(() => matchRepository.cancel(id), "Match cancelled.");

  return { matches, loading, submitting, error, success, load, confirm, decline, cancel };
}