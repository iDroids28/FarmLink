import { apiClient } from "../services/api/apiClient";

export const matchRepository = {
  async listMine() {
    return (await apiClient.get("/matches/mine")).matches;
  },
  // Farmers: one match + its demand progress + safe business profile.
  async getDetails(id) {
    return (await apiClient.get(`/matches/${encodeURIComponent(id)}/details`)).details;
  },
  // Farmer or buyer: a short summary of one of their own matches (Notifications pop-up).
  async getSummary(id) {
    return (await apiClient.get(`/matches/${encodeURIComponent(id)}/summary`)).summary;
  },
  // Farmer accepts (confirm) or declines a pending match.
  async confirm(id) {
    return (await apiClient.post(`/matches/${encodeURIComponent(id)}/confirm`)).match;
  },
  async decline(id) {
    return (await apiClient.post(`/matches/${encodeURIComponent(id)}/decline`)).match;
  },
  // Buyer cancels a match that is still waiting for the farmer.
  async cancel(id) {
    return (await apiClient.post(`/matches/${encodeURIComponent(id)}/cancel`)).match;
  },
};