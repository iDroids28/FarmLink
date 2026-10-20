import { API_URL } from "../AuthShared";

// Same /api prefix as the other APIs + "/requests" (see server.js).
const BASE = API_URL.replace(/\/auth\/?$/, "") + "/requests";

async function call(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach the server. Please check your connection.");
  }
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Something went wrong. Please try again.");
  return data;
}

export const matchOrderApi = {
  // Buyer: matches with supply details and the order made from each one
  mine: () => call("/matches/mine"),
  // Buyer: pre-order a confirmed match (Pick Up or Delivery)
  preorder: (matchId, body) => call(`/matches/${matchId}/preorder`, { method: "POST", body }),
  // Farmer: matches on my supply, with the buyer's details
  farmerMatches: () => call("/matches/incoming"),
  // Farmer: attach a photo of the products ({ image } or { useListing: true })
  savePhoto: (matchId, body) => call(`/matches/${matchId}/photo`, { method: "POST", body }),
  // Buyer / farmer: the photo attached to a match
  photo: (matchId) => call(`/matches/${matchId}/photo`),
};