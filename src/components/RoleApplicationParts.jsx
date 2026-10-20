import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, ImagePlus, Upload, X } from "lucide-react";
import GlassCard from "./GlassCard.jsx";
import { PageHeader, StatusBadge, LoadNote } from "./DemoBits.jsx";
import { roleApplicationApi, useMyApplications, errorMessage } from "../api/roleApplicationApi.js";

/* Keep these lists in sync with roleApplicationRoutes.js */
export const GOV_ID_TYPES = ["National ID", "Driver's License", "Passport", "Other"];
export const PROOF_TYPES = [
  "RSBSA Registration",
  "Barangay Farmer Certification",
  "Proof of Land Ownership",
  "Lease/Tenancy Document",
  "Agriculture Office Certification",
  "Other",
];
export const FARMER_STATUSES = ["Farm Owner", "Tenant", "Lessee", "Farm Worker", "Other"];
export const BUSINESS_TYPES = ["Sole Proprietorship", "Partnership", "Corporation", "Cooperative", "Other"];
export const PERMIT_TYPES = ["DTI", "SEC", "CDA", "BIR", "Business/Mayor's Permit", "Other"];
export const MAX_MULTI = 5;

const MB = 1024 * 1024;
const IMG_EXT = /\.(jpe?g|png|webp)$/i;
const DOC_EXT = /\.(jpe?g|png|webp|pdf)$/i;
const IMG_MIME = ["image/jpeg", "image/png", "image/webp"];
const DOC_MIME = [...IMG_MIME, "application/pdf"];
const DOC_ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf";

// Friendly first-pass check only. The server checks the real file signature.
export function checkPhoto(file) {
  if (!IMG_MIME.includes(file.type) && !IMG_EXT.test(file.name)) return "Photo must be a JPG, PNG, or WebP image.";
  if (file.size > 2 * MB) return "Photo must be 2 MB or smaller.";
  return "";
}
export function checkDoc(file) {
  if (!DOC_MIME.includes(file.type) && !DOC_EXT.test(file.name)) return "Use a JPG, PNG, WebP, or PDF file.";
  if (file.size > 5 * MB) return "File must be 5 MB or smaller.";
  return "";
}

const smallBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#D8E7D7] bg-white px-3 py-2 text-[13.5px] font-semibold text-[#2E7D32] shadow-sm transition hover:border-[#B9D8B8] hover:bg-[#F4FAF2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] disabled:cursor-not-allowed disabled:opacity-50";
const fieldCls =
  "w-full min-h-[48px] rounded-xl border border-[#DCE7DC] bg-white px-4 py-3 text-[14.5px] text-[#16301F] outline-none shadow-sm transition hover:border-[#B8D4BA] focus:border-[#4CAF50] focus:bg-white focus:ring-2 focus:ring-[#4CAF50]/20";

/* ---------------- Photo picker (preview / replace / remove) ---------------- */
export function PhotoPicker({ file, onChange }) {
  const [preview, setPreview] = useState("");
  const [err, setErr] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const msg = checkPhoto(f);
    setErr(msg);
    if (!msg) onChange(f);
  }

  return (
    <div className="rounded-2xl border border-dashed border-[#B7D7B4] bg-gradient-to-br from-[#F4FBF3] to-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white bg-[#EEF7EC] shadow-sm ring-1 ring-[#DCE9DA]">
          {preview ? (
            <img src={preview} alt="Farmer photo preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1.5 px-2 text-center text-[#739173]">
              <ImagePlus size={27} strokeWidth={1.7} />
              <span className="text-[12px] font-medium">Photo preview</span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold text-[#1C3B24]">Choose a clear farmer photo</p>
          <p className="mt-1 max-w-md text-[13px] leading-5 text-gray-500">Use a recent JPG, PNG, or WebP image. Maximum file size is 2 MB.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={smallBtn} onClick={() => inputRef.current?.click()}><Upload size={14} /> {file ? "Replace photo" : "Choose photo"}</button>
            {file && <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-white px-3 py-2 text-[13.5px] font-semibold text-red-600 transition hover:bg-red-50" onClick={() => { setErr(""); onChange(null); }}><X size={14} /> Remove</button>}
          </div>
          {file && <p className="mt-2 flex items-center gap-1.5 break-all text-[13px] text-[#2E7D32]"><CheckCircle2 size={13} className="shrink-0" /> {file.name}</p>}
        </div>
        <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={pick} />
      </div>
      {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13.5px] text-red-600">{err}</p>}
    </div>
  );
}

/* ---------------- One document row: type + (custom type) + file ---------------- */
let rowKey = 0;
export const newDocRow = () => ({ key: ++rowKey, type: "", custom: "", file: null });

export function DocRow({ types, item, onChange, onRemove, label }) {
  const [err, setErr] = useState("");
  const inputRef = useRef(null);

  function pick(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const msg = checkDoc(f);
    setErr(msg);
    if (!msg) onChange({ ...item, file: f });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[#DCE8DA] bg-gradient-to-br from-white to-[#FBFDFB] p-4 shadow-[0_5px_16px_rgba(22,48,31,0.05)] sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF7EC] text-[#387B3E]"><FileText size={16} /></span>
        <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[#1B3A23]">{label}</p>
        {item.file ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#E9F7E8] px-2 py-1 text-[11.5px] font-semibold text-[#2E7D32]"><CheckCircle2 size={11} /> Selected</span> : <span className="shrink-0 text-[12px] text-gray-400">Required</span>}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <select aria-label={`${label} type`} value={item.type} onChange={(e) => onChange({ ...item, type: e.target.value, custom: "" })} className={fieldCls}>
          <option value="">Select document type</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {item.type === "Other" && <input aria-label={`${label} custom type`} value={item.custom} maxLength={60} onChange={(e) => onChange({ ...item, custom: e.target.value })} placeholder="Specify the document type" className={fieldCls} />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={smallBtn} onClick={() => inputRef.current?.click()}><Upload size={14} /> {item.file ? "Replace file" : "Choose file"}</button>
        {item.file && <><span className="max-w-[260px] truncate text-[13px] text-gray-600" title={item.file.name}>{item.file.name}</span><button type="button" className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[13px] font-semibold text-gray-500 transition hover:bg-red-50 hover:text-red-600" onClick={() => { setErr(""); onChange({ ...item, file: null }); }}><X size={13} /> Clear</button></>}
        {onRemove && <button type="button" onClick={onRemove} className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[13px] font-semibold text-red-600 transition hover:bg-red-50"><X size={13} /> Remove row</button>}
        <input ref={inputRef} type="file" accept={DOC_ACCEPT} className="hidden" onChange={pick} />
      </div>
      <p className="text-[12px] text-gray-400">JPG, PNG, WebP, or PDF · Max 5 MB</p>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13.5px] text-red-600">{err}</p>}
    </div>
  );
}

export function MultiDocPicker({ label, types, items, onChange, max = MAX_MULTI }) {
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <DocRow key={it.key} label={`${label} ${i + 1}`} types={types} item={it}
          onChange={(next) => onChange(items.map((x) => (x.key === it.key ? next : x)))}
          onRemove={items.length > 1 ? () => onChange(items.filter((x) => x.key !== it.key)) : undefined}
        />
      ))}
      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-[#CFE2CD] bg-[#F8FCF7] p-4 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" disabled={items.length >= max} onClick={() => onChange([...items, newDocRow()])} className={smallBtn + " self-start disabled:opacity-50"}><span className="text-[16.5px] leading-none">+</span> Add another file</button>
        <span className="text-[12.5px] text-gray-500">{items.length} of {max} files · JPG, PNG, WebP, or PDF</span>
      </div>
    </div>
  );
}

/* Shared client-side check for a list of document rows. Returns an error string or "". */
export function checkDocRows(rows, label, minCount = 1) {
  const filled = rows.filter((r) => r.type || r.file || r.custom.trim());
  if (filled.length < minCount) return `Please upload at least one ${label}.`;
  for (let i = 0; i < filled.length; i++) {
    const r = filled[i];
    const n = filled.length > 1 ? ` ${i + 1}` : "";
    if (!r.type) return `Please choose the document type for ${label}${n}.`;
    if (r.type === "Other" && r.custom.trim().length < 2) return `Please specify the document type for ${label}${n}.`;
    if (!r.file) return `Please choose a file for ${label}${n}.`;
  }
  return "";
}

/* ---------------- Status + details (applicant and admin) ---------------- */
const KIND_LABEL = {
  photo: "Farmer photo",
  govId: "Government ID",
  proof: "Proof of farming activity",
  permit: "Business registration / permit",
};
const typeLabel = (d) => (d.kind === "photo" ? "" : d.docType === "Other" ? `Other: ${d.customType}` : d.docType);

// "Other" choices show what the applicant typed, e.g. "Other: Food truck".
const withOther = (choice, custom) => (choice === "Other" && custom ? `Other: ${custom}` : choice);

export function detailRows(a) {
  if (a.type === "farmer") {
    return [
      ["Full Name", a.fullName],
      ["Email", a.email],
      ["Mobile Number", a.mobile],
      ["Address", a.address],
      ["Farm Location", a.farmLocation],
      ...(a.farmingType ? [["Type of Farming", a.farmingType]] : []),
      ["Main Products/Crops", a.products],
      ["Farmer Status", withOther(a.farmerStatus, a.farmerStatusCustom)],
    ];
  }
  return [
    ["Business Name", a.businessName],
    ["Business Type", withOther(a.businessType, a.businessTypeCustom)],
    ["Authorized Representative", a.representative],
    ["Business Address", a.businessAddress],
    ["Business Email", a.businessEmail],
    ["Mobile Number", a.mobile],
    // No longer collected; shown only for applications submitted earlier.
    ...(a.interestedProducts ? [["Products Interested In Buying", a.interestedProducts]] : []),
  ];
}

export const fmtDate = (v) =>
  v ? new Date(v).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";

export function ApplicationDetails({ application }) {
  const [err, setErr] = useState("");
  function view(d) {
    setErr("");
    roleApplicationApi.openDocument(application.id, d.id).catch((e) => setErr(errorMessage(e)));
  }
  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {detailRows(application).map(([k, v]) => (
          <div key={k}>
            <dt className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">{k}</dt>
            <dd className="text-[15px] text-[#16301F] break-words">{v || "—"}</dd>
          </div>
        ))}
      </dl>
      <div>
        <h4 className="text-[14.5px] font-semibold text-[#16301F]">Verification documents</h4>
        <ul className="mt-2 space-y-2">
          {application.documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-[#F4F7F3] px-3 py-2">
              <span className="text-[14.5px] font-medium text-[#16301F]">{KIND_LABEL[d.kind] || "Document"}</span>
              {typeLabel(d) && <span className="text-[14px] text-gray-600">({typeLabel(d)})</span>}
              <span className="max-w-[220px] truncate text-[13.5px] text-gray-500">{d.originalName}</span>
              <button type="button" onClick={() => view(d)} className={smallBtn + " ml-auto"}>
                View
              </button>
            </li>
          ))}
        </ul>
        {err && <p className="mt-2 text-[14px] text-red-600">{err}</p>}
      </div>
    </div>
  );
}

const STATUS_TEXT = {
  pending: "Your application is pending. An admin will review it. You cannot send another application while this one is pending.",
  approved: "Your application was approved. Your account role has been updated.",
  rejected: "Your application was not approved. You can submit a new application.",
};
const TYPE_LABEL = { farmer: "Farmer", buyer: "Business / Buyer" };

export function ApplicationStatusCard({ application, compact = false }) {
  return (
    <GlassCard>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[15.5px] font-semibold text-[#16301F]">
          {TYPE_LABEL[application.type]} application
        </span>
        <StatusBadge status={application.statusLabel} />
        <span className="text-[14px] text-gray-500">Submitted {fmtDate(application.createdAt)}</span>
      </div>
      <p className="mt-2 text-[14.5px] text-gray-600">{STATUS_TEXT[application.status]}</p>
      {application.status === "rejected" && application.rejectionReason && (
        <p className="mt-1 text-[14.5px] text-red-600">Reason: {application.rejectionReason}</p>
      )}
      {!compact && (
        <div className="mt-4 border-t border-[#E4EEE4] pt-4">
          <ApplicationDetails application={application} />
        </div>
      )}
    </GlassCard>
  );
}

/* ---------------- Gate used by both application pages ---------------- */
export function ApplyGate({ user, onNavigate, title, subtitle, children }) {
  const { data, loading, error, reload } = useMyApplications();
  const latest = data?.latest || null;
  const back = (
    <button type="button" onClick={() => onNavigate?.("dashboard")} className={smallBtn}>
      Back to Dashboard
    </button>
  );

  let body;
  if (user?.role !== "user") {
    body = (
      <GlassCard>
        <p className="text-[15px] text-gray-700">
          Your account already has its role. Applications are only for new accounts.
        </p>
        <div className="mt-3">{back}</div>
      </GlassCard>
    );
  } else if (loading && !data) {
    body = null;
  } else if (!data) {
    body = null;
  } else if (data.pending && latest) {
    body = (
      <>
        <ApplicationStatusCard application={latest} />
        <div>{back}</div>
      </>
    );
  } else {
    body = (
      <>
        {latest?.status === "rejected" && <ApplicationStatusCard application={latest} compact />}
        {children({ reload })}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} />
      <LoadNote loading={loading && !data} error={error} />
      {body}
    </div>
  );
}