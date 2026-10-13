import { useCallback, useState } from "react";
import { getUserMessage } from "../AuthShared";
import { supplyRepository } from "../repositories/supplyRepository";

export default function useAvailableSupplyViewModel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await supplyRepository.listAvailable());
    } catch (err) {
      setError(getUserMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return { items, loading, error, load };
}
