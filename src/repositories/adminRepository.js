import { apiClient } from "../services/api/apiClient";

export const adminRepository = {
  getStats() {
    return apiClient.get("/admin/stats");
  },
};
