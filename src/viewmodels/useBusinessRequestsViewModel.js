import { useCallback, useState } from "react";
import { getUserMessage } from "../AuthShared";
import { demandRepository } from "../repositories/demandRepository";

export default function useBusinessRequestsViewModel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await demandRepository.listForFarmers());
    } catch (err) {
      setError(getUserMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return { items, loading, error, load };
}