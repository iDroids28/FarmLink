/*
 * Match labels and tones.
 * Kept local to matching so FormBits.statusTone
 * (which treats everything unknown as amber) is not changed globally.
 */

export const MATCH_STATUS_LABEL = {
  pending_confirmation: "Pending Confirmation",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",

  // Computed display status only. Not a database Match status.
  mixed: "Partly Confirmed",
};

// Tones understood by FormBits.StatusBadge: green | amber | gray.
export const MATCH_STATUS_TONE = {
  pending_confirmation: "amber",
  confirmed: "green",
  declined: "gray",
  cancelled: "gray",

  // Show an amber badge when the farmer has confirmed and pending quantities.
  mixed: "amber",
};

// Only a pending match can still be confirmed or declined.
export const canDecideMatch = (m) =>
  m.status === "pending_confirmation";

// Notification types written by the matching engine -> Layout toast tone.
export const MATCH_NOTICE_TONE = {
  match_created: "warn",
  match_confirmed: "good",
  match_declined: "bad",
  match_cancelled: "info",
};