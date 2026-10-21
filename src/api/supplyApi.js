import { API_URL } from "../AuthShared";

// ADJUST if your supply router is mounted somewhere else (check server.js).
// Default: same /api prefix as the admin API + "/supplies".
const BASE = API_URL.replace(/\/auth\/?$/, "") + "/supplies";

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

export const supplyApi = {
  // Sidebar red numbers
  counts: () => call("/counts"),
  // Farmer
  mine: () => call("/mine"),
  create: (b) => call("/", { method: "POST", body: b }),
  update: (id, b) => call(`/${id}`, { method: "PATCH", body: b }),
  cancel: (id) => call(`/${id}/cancel`, { method: "POST" }),
  // Buyer / Admin: approved products from all farmers, with photos and ratings (sold-out ones too)
  available: () => call("/available"),
  // Buyer / Admin: the farmer who owns a supply: personal information, farm name, all products
  farmer: (supplyId) => call(`/farmer/${supplyId}`),
  // Product and farmer account reviews (buyers' names, profile photos, stars and messages)
  reviews: (supplyId) => call(`/${supplyId}/reviews`),
  farmerReviews: (farmerId) => call(`/farmer-account/${farmerId}/reviews`),
  // Buyer: pre-order (pick up or delivery), tracker, and rating a completed order
  createOrder: (b) => call("/orders", { method: "POST", body: b }),
  myOrders: () => call("/orders/mine"),
  rateOrder: (id, ratings, message) => call(`/orders/${id}/review`, {
    method: "POST",
    body: ratings && typeof ratings === "object" ? ratings : { rating: ratings, message },
  }),
  // Buyer: Pick Up / Delivery choice of a requirement
  saveDemandDelivery: (b) => call("/demand-delivery", { method: "POST", body: b }),
  demandDelivery: () => call("/demand-delivery"),
  // Farmer: Order Management
  incomingOrders: () => call("/orders/incoming"),
  setOrderStatus: (id, status) => call(`/orders/${id}/status`, { method: "POST", body: { status } }),
  // Admin
  adminPending: () => call("/admin/pending"),
  adminManaged: () => call("/admin/managed"),
  approve: (id) => call(`/admin/${id}/approve`, { method: "POST" }),
  reject: (id, reason) => call(`/admin/${id}/reject`, { method: "POST", body: { reason } }),
  remove: (id) => call(`/admin/${id}/remove`, { method: "POST" }),
};

// Shrinks a chosen photo in the browser (max 900px, JPEG) so the upload stays small.
export function fileToDataUrl(file, max = 720) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error("Use a JPG, PNG or WEBP image."));
    if (file.size > 5 * 1024 * 1024) return reject(new Error("Image is too large (max 5 MB)."));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read that image.")); };
    img.src = url;
  });
}