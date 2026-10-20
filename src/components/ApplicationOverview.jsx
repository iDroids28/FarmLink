import { useState } from "react";
import { FileText, Sprout, Store } from "lucide-react";
import GlassCard from "./GlassCard.jsx";
import { StatusBadge, primaryBtn, primaryStyle } from "./DemoBits.jsx";
import { fmtDate } from "./RoleApplicationParts.jsx";
import { roleApplicationApi, errorMessage } from "../api/roleApplicationApi.js";

const TYPE = {
  farmer: {
    title: "My Farmer Application",
    label: "Farmer",
    icon: Sprout,
    again: "Submit a new Farmer application",
  },
  buyer: {
    title: "My Business / Buyer Application",
    label: "Business / Buyer",
    icon: Store,
    again: "Submit a new Business / Buyer application",
  },
};

const STATUS_NOTE = {
  pending: {
    cls: "bg-blue-50 text-blue-800",
    text: "Your application is pending. An admin will review it. You cannot send another application while this one is pending.",
  },
  approved: {
    cls: "bg-green-50 text-green-800",
    text: "Your application was approved. Your account role has been updated.",
  },
  rejected: {
    cls: "bg-red-50 text-red-700",
    text: "Your application was not approved. You can submit a new application.",
  },
};

const KIND_LABEL = {
  photo: "Farmer photo",
  govId: "Government ID",
  proof: "Proof of farming activity",
  permit: "Business registration / permit",
};
const docTypeLabel = (d) =>
  d.kind === "photo" ? "" : d.docType === "Other" ? `Other: ${d.customType}` : d.docType;

const MB = 1024 * 1024;
const fmtSize = (n) => {
  if (!n) return "";
  return n >= MB ? `${(n / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
};

function InfoItem({ label, value }) {
  return (
    <div className="rounded-xl bg-[#F4F7F3] px-3.5 py-2.5">
      <dt className="text-[11.5px] font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 break-words text-[13.5px] font-medium text-[#16301F]">{value || "—"}</dd>
    </div>
  );
}

function InfoCard({ title, items }) {
  return (
    <GlassCard opacity={0.85} padding="p-6">
      <h3 className="text-[15px] font-semibold text-[#16301F]">{title}</h3>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <InfoItem key={label} label={label} value={value} />
        ))}
      </dl>
    </GlassCard>
  );
}

function sectionsFor(a) {
  if (a.type === "farmer") {
    return [
      {
        title: "Personal information",
        items: [
          ["Full Name", a.fullName],
          ["Email", a.email],
          ["Mobile Number", a.mobile],
          ["Address", a.address],
        ],
      },
      {
        title: "Farm information",
        items: [
          ["Farm Location", a.farmLocation],
          ...(a.farmingType ? [["Type of Farming", a.farmingType]] : []),
          ["Main Agricultural Products/Crops", a.products],
          ["Farmer Status", a.farmerStatus === "Other" && a.farmerStatusCustom ? `Other: ${a.farmerStatusCustom}` : a.farmerStatus],
        ],
      },
    ];
  }
  return [
    {
      title: "Business information",
      items: [
        ["Business Name", a.businessName],
        ["Business Type", a.businessType === "Other" && a.businessTypeCustom ? `Other: ${a.businessTypeCustom}` : a.businessType],
        ["Authorized Representative", a.representative],
        ["Business Address", a.businessAddress],
      ],
    },
    {
      title: "Contact information",
      items: [
        ["Business Email", a.businessEmail],
        ["Mobile Number", a.mobile],
        // No longer collected; shown only for applications submitted earlier.
        ...(a.interestedProducts ? [["Products/Commodities Interested In Buying", a.interestedProducts]] : []),
      ],
    },
  ];
}

export default function ApplicationOverview({ application: a, onReapply }) {
  const [err, setErr] = useState("");
  const meta = TYPE[a.type] || TYPE.farmer;
  const note = STATUS_NOTE[a.status];
  const Icon = meta.icon;

  function view(d) {
    setErr("");
    roleApplicationApi.openDocument(a.id, d.id).catch((e) => setErr(errorMessage(e)));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <GlassCard opacity={0.85} padding="p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
            style={{ background: "linear-gradient(90deg, #4CAF50, #2E7D32)" }}
          >
            <Icon size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[19px] font-bold text-[#16301F]">{meta.title}</h2>
            <p className="text-[12.5px] text-gray-500">Submitted {fmtDate(a.createdAt)}</p>
          </div>
          <StatusBadge status={a.statusLabel} />
        </div>

        {note && <p className={"mt-4 rounded-xl px-4 py-3 text-[13px] " + note.cls}>{note.text}</p>}

        {a.status === "rejected" && a.rejectionReason && (
          <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">
            <span className="font-semibold">Reason:</span> {a.rejectionReason}
          </p>
        )}

        {a.status === "rejected" && onReapply && (
          <button type="button" onClick={onReapply} className={primaryBtn + " mt-4"} style={primaryStyle}>
            {meta.again}
          </button>
        )}
      </GlassCard>

      {/* Summary */}
      <InfoCard
        title="Application summary"
        items={[
          ["Application Type", meta.label],
          ["Application Status", a.statusLabel],
          ["Date Submitted", fmtDate(a.createdAt)],
          ...(a.reviewedAt ? [["Date Reviewed", fmtDate(a.reviewedAt)]] : []),
        ]}
      />

      {/* Personal / business information */}
      {sectionsFor(a).map((s) => (
        <InfoCard key={s.title} title={s.title} items={s.items} />
      ))}

      {/* Documents (private: opened only through the authenticated document route) */}
      <GlassCard opacity={0.85} padding="p-6">
        <h3 className="text-[15px] font-semibold text-[#16301F]">Verification documents</h3>
        {a.documents?.length ? (
          <ul className="mt-4 space-y-2">
            {a.documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-[#F4F7F3] px-3.5 py-2.5">
                <FileText size={18} className="shrink-0 text-[#2E7D32]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[#16301F]">
                    {KIND_LABEL[d.kind] || "Document"}
                    {docTypeLabel(d) && (
                      <span className="font-normal text-gray-600"> ({docTypeLabel(d)})</span>
                    )}
                  </p>
                  <p className="truncate text-[12px] text-gray-500">
                    {d.originalName || "Uploaded file"}
                    {fmtSize(d.size) && ` · ${fmtSize(d.size)}`}
                  </p>
                </div>
                <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11.5px] font-semibold text-green-800">
                  Uploaded
                </span>
                <button
                  type="button"
                  onClick={() => view(d)}
                  className="rounded-md bg-white px-3 py-1.5 text-[12.5px] font-semibold text-gray-700 shadow-sm hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50]"
                >
                  View
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[13px] text-gray-500">No documents on record.</p>
        )}
        {err && <p className="mt-3 text-[12.5px] text-red-600">{err}</p>}
        <p className="mt-3 text-[11.5px] text-gray-500">
          Your documents are private. Only you and FarmLink administrators can open them.
        </p>
      </GlassCard>
    </div>
  );
}