import { RoleApplication } from "./roleApplicationModel.js";

// Whitelist only. Application documents (IDs, permits, proofs and stored file
// names) are never selected or returned by this helper.
const SAFE_FIELDS =
  "user businessName businessType businessTypeCustom businessAddress representative businessEmail mobile";

const clean = (value) => (typeof value === "string" ? value.trim() : "");

function typeLabel(application) {
  const type = clean(application.businessType);
  return /^other$/i.test(type) && clean(application.businessTypeCustom)
    ? clean(application.businessTypeCustom)
    : type;
}

// Returns the newest approved Buyer application for each user.
async function approvedBuyerApps(buyerIds) {
  const ids = [...new Set(buyerIds.filter(Boolean).map(String))];
  const result = new Map();
  if (!ids.length) return result;

  const rows = await RoleApplication.find({
    user: { $in: ids },
    type: "buyer",
    status: "approved",
  })
    .select(SAFE_FIELDS)
    .sort({ reviewedAt: -1, createdAt: -1 })
    .lean();

  for (const application of rows) {
    const key = String(application.user);
    if (!result.has(key)) result.set(key, application);
  }

  return result;
}

// Map of buyer user ID -> approved business name for the Farmer Matches list.
export async function businessNamesFor(buyerIds) {
  const applications = await approvedBuyerApps(buyerIds);
  const result = new Map();
  for (const [userId, application] of applications) {
    result.set(userId, clean(application.businessName));
  }
  return result;
}

// Full safe profile for one approved Buyer, or null when none exists.
export async function businessProfileFor(buyerId) {
  const applications = await approvedBuyerApps([buyerId]);
  const application = applications.get(String(buyerId));
  if (!application) return null;

  return {
    businessName: clean(application.businessName),
    businessType: typeLabel(application),
    businessAddress: clean(application.businessAddress),
    representative: clean(application.representative),
    businessEmail: clean(application.businessEmail),
    mobile: clean(application.mobile),
  };
}
