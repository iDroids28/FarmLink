import { apiClient } from "../services/api/apiClient";

export const requestRepository = {
  create: (body) => apiClient.post("/requests", body),
  mine: () => apiClient.get("/requests/mine"),
  incoming: () => apiClient.get("/requests/incoming"),
  accept: (id) => apiClient.post(`/requests/${id}/accept`),
  decline: (id) => apiClient.post(`/requests/${id}/decline`),
  cancel: (id) => apiClient.post(`/requests/${id}/cancel`),
  // Farmer profile shown when the buyer taps the farmer's picture in Find Supply.
  // NOTE: this route is a guess. If it shows "Not found", the backend uses a different path.
  farmer: (supplyId) => apiClient.get(`/supplies/${supplyId}/farmer`),
};

export const REQUEST_STATUS_LABEL = {
  pending_confirmation: "Pending confirmation",
  confirmed: "Pre-ordered",
  declined: "Declined",
  cancelled: "Cancelled",
};

export const REQUEST_STATUS_TONE = {
  pending_confirmation: "amber",
  confirmed: "green",
  declined: "red",
  cancelled: "gray",
};

// Accepts the whole request object (or just the kind text).
export const requestKindLabel = (r) => {
  const kind = typeof r === "string" ? r : r?.kind;
  return kind === "supply_request" ? "Request Supply" : "Pre-order";
};