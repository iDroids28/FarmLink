import { apiClient } from "../services/api/apiClient";

/* All supply calls in one place. The server answers { supplies: [...] }
   or { supply: {...} }, so each function returns the plain data. */
export const supplyRepository = {
  // Farmer: own listings.
  listMine: () => apiClient.get("/supplies/mine").then((d) => d?.supplies || []),

  // Buyer: supply that farmers posted and that is still available.
  listAvailable: () => apiClient.get("/supplies/available").then((d) => d?.supplies || []),

  create: (payload) => apiClient.post("/supplies", payload).then((d) => d?.supply || null),

  update: (id, payload) => {
    const send = apiClient.patch || apiClient.put;
    if (!send) return Promise.reject(new Error("Editing supply is not available."));
    return send.call(apiClient, `/supplies/${id}`, payload).then((d) => d?.supply || null);
  },

  cancel: (id) => apiClient.post(`/supplies/${id}/cancel`).then((d) => d?.supply || null),
};

export default supplyRepository;