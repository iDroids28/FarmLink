import { API_URL } from "../AuthShared";

// Same /api prefix as the other APIs + "/order-photos" (see server.js).
const BASE = API_URL.replace(/\/auth\/?$/, "") + "/order-photos";

async function call(path) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { credentials: "include" });
  } catch {
    throw new Error("Cannot reach the server. Please check your connection.");
  }
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Something went wrong. Please try again.");
  return data;
}

export const orderPhotoApi = {
  // Ids of my orders that have the farmer's photo of the products
  mine: () => call("/mine"),
  // The farmer's photo of one order
  get: (orderId) => call(`/${orderId}`),
};