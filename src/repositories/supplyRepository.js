import { apiClient } from "../services/api/apiClient";

/* Hides the endpoint URLs from the rest of the app. */
export const supplyRepository = {
  async listMine() {
    return (await apiClient.get("/supplies/mine")).supplies;
  },
  async listAvailable() {
    return (await apiClient.get("/supplies/available")).supplies;
  },
  async getById(id) {
    return (await apiClient.get(`/supplies/${encodeURIComponent(id)}`)).supply;
  },
  async create(payload) {
    return (await apiClient.post("/supplies", payload)).supply;
  },
  async update(id, payload) {
    return (await apiClient.patch(`/supplies/${encodeURIComponent(id)}`, payload)).supply;
  },
  async cancel(id) {
    return (await apiClient.post(`/supplies/${encodeURIComponent(id)}/cancel`)).supply;
  },
};
