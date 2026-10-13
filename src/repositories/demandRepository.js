import { apiClient } from "../services/api/apiClient";

export const demandRepository = {
  async listMine() {
    return (await apiClient.get("/demands/mine")).demands;
  },
  // Farmers: all active business requests with progress + contributing farmers.
  async listForFarmers() {
    return (await apiClient.get("/demands/for-farmers")).demands;
  },
  // Get the safe Business/Buyer profile for a farmer's request details modal.
  async getBusiness(id) {
    return (
      await apiClient.get(`/demands/${encodeURIComponent(id)}/business`)
    ).business;
  },
  async getById(id) {
    return (await apiClient.get(`/demands/${encodeURIComponent(id)}`)).demand;
  },
  async create(payload) {
    return (await apiClient.post("/demands", payload)).demand;
  },
  async update(id, payload) {
    return (await apiClient.patch(`/demands/${encodeURIComponent(id)}`, payload)).demand;
  },
  async cancel(id) {
    return (await apiClient.post(`/demands/${encodeURIComponent(id)}/cancel`)).demand;
  },
  // Farmer: offer supply for one specific request.
  async offerSupply(id, payload) {
    return (await apiClient.post(`/demands/${encodeURIComponent(id)}/offer`, payload)).offer;
  },
};
