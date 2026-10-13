import { apiClient } from "../services/api/apiClient";
import { API_URL } from "../AuthShared";

// API_URL ends with "/auth"; the photo is loaded by <img>, so it needs a full URL.
const API_ROOT = API_URL.replace(/\/auth\/?$/, "");

export const farmerRepository = {
  async getProfile(id) {
    return (await apiClient.get(`/farmers/${encodeURIComponent(id)}`)).farmer;
  },
  photoUrl(id) {
    return `${API_ROOT}/farmers/${encodeURIComponent(id)}/photo`;
  },
};