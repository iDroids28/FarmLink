import GlassCard from "./GlassCard.jsx";
import { DataTable, PageHeader } from "./DemoBits.jsx";
import { StatusBadge, ActionButton, formatDate, formatQty } from "./FormBits.jsx";
import { MATCH_STATUS_LABEL, MATCH_STATUS_TONE, canDecideMatch } from "../models/match/Match";

/* Shows rows from GET /api/matches/mine:
   { id, product, quantity, unit, location, status, createdAt, neededDate | availabilityDate }
   Confirm / Decline buttons appear only when handlers are passed (Farmer page)
   and only on pending_confirmation rows. */
export default function MatchesTable({
  rows = [],
  dateKey = "neededDate",
  dateLabel = "Needed By",
  subtitle,
  onConfirm,
  onDecline,
  onViewDetails,
  busy = false,
}) {
  const hasActions = Boolean(onViewDetails || onConfirm || onDecline);

  const columns = [
    {
      key: "product",
      label: "Product",
      render: (row) => (
        <div className="min-w-0">
          <p className="font-semibold text-[#16301F]">{row.product}</p>
          {"businessName" in row && (
            <p className="text-[12px] text-gray-600">
              For: <span className="font-medium">{row.businessName || "Business details unavailable"}</span>
            </p>
          )}
        </div>
      ),
    },
    { key: "quantity", label: "Quantity", render: (r) => formatQty(r.quantity) },
    { key: "unit", label: "Unit" },
    { key: dateKey, label: dateLabel, render: (r) => formatDate(r[dateKey]) },
    { key: "location", label: "Location" },
    {
      key: "status",
      label: "Match Status",
      render: (r) => (
        <StatusBadge
          label={MATCH_STATUS_LABEL[r.status] || r.status}
          tone={MATCH_STATUS_TONE[r.status] || "gray"}
        />
      ),
    },
    ...(hasActions
      ? [{
          key: "action",
          label: "Action",
          render: (r) =>
            onViewDetails ? (
              <ActionButton
                variant="secondary"
                onClick={() => onViewDetails(r.id)}
                className="!px-3 !py-1 !text-[12px]"
              >
                View Details
              </ActionButton>
            ) : canDecideMatch(r) ? (
              <div className="flex gap-2">
                <ActionButton
                  onClick={() => onConfirm?.(r.id)}
                  disabled={busy}
                  className="!px-3 !py-1 !text-[12px]"
                >
                  Confirm
                </ActionButton>
                <ActionButton
                  variant="secondary"
                  onClick={() => onDecline?.(r.id)}
                  disabled={busy}
                  className="!px-3 !py-1 !text-[12px]"
                >
                  Decline
                </ActionButton>
              </div>
            ) : "—",
        }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Matches" subtitle={subtitle || "Here are the matched products between buyers and farmers."} />
      <GlassCard padding="p-0">
        <DataTable columns={columns} rows={rows} empty="No matches yet." />
      </GlassCard>
    </div>
  );
}
