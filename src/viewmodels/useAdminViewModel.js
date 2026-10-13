import { useCallback, useState } from "react";
import { getUserMessage } from "../AuthShared";
import { adminRepository } from "../repositories/adminRepository";

export default function useAdminViewModel() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setStats(await adminRepository.getStats());
    } catch (err) {
      setError(getUserMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return { stats, loading, error, load };
}
