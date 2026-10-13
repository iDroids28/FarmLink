import { apiClient } from "../services/api/apiClient";

export const matchRepository = {
  async listMine() {
    return (await apiClient.get("/matches/mine")).matches;
  },
  // Farmers: one match + its demand progress + safe business profile.
  async getDetails(id) {
    return (await apiClient.get(`/matches/${encodeURIComponent(id)}/details`)).details;
  },
  async confirm(id) {
    return (await apiClient.post(`/matches/${encodeURIComponent(id)}/confirm`)).match;
  },
  async decline(id) {
    return (await apiClient.post(`/matches/${encodeURIComponent(id)}/decline`)).match;
  },
};