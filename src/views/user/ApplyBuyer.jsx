import { useState } from "react";
import { ArrowRight, Building2, FileCheck2, LoaderCircle, ShieldCheck, Store } from "lucide-react";
import GlassCard from "../../components/GlassCard.jsx";
import { Field, inputCls, primaryStyle } from "../../components/DemoBits.jsx";
import {
  ApplyGate,
  DocRow,
  MultiDocPicker,
  newDocRow,
  checkDocRows,
  GOV_ID_TYPES,
  PERMIT_TYPES,
  BUSINESS_TYPES,
} from "../../components/RoleApplicationParts.jsx";
import { roleApplicationApi, errorMessage } from "../../api/roleApplicationApi.js";
import { EMAIL_RE, isValidOther } from "../../components/applicationInputs.js";


function BuyerForm({ reload }) {
  const [f, setF] = useState({
    businessName: "",
    businessType: "",
    businessTypeCustom: "",
    representative: "",
    businessAddress: "",
    businessEmail: "",
  });
  const [govId, setGovId] = useState(newDocRow());
  const [permits, setPermits] = useState([newDocRow()]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const up = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  // Choosing any type other than "Other" clears the custom text.
  const pickBusinessType = (e) => setF((s) => ({ ...s, businessType: e.target.value, businessTypeCustom: "" }));

  function validate() {
    if (f.businessName.trim().length < 2) return "Please enter your business name.";
    if (!f.businessType) return "Please select a business type.";
    if (f.businessType === "Other" && !isValidOther(f.businessTypeCustom)) return "Please specify your business type.";
    if (f.representative.trim().length < 2) return "Please enter the authorized representative.";
    if (f.businessAddress.trim().length < 5) return "Please enter your business address.";
    if (!EMAIL_RE.test(f.businessEmail.trim())) return "Please enter a valid business email.";
    const g = checkDocRows([govId], "representative government ID");
    if (g) return g;
    return checkDocRows(permits, "business registration or permit");
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const msg = validate();
    setError(msg);
    if (msg) return;

    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => fd.append(k, v.trim()));
    fd.append("govIdType", govId.type);
    fd.append("govIdCustom", govId.custom.trim());
    fd.append("govId", govId.file);
    const filled = permits.filter((p) => p.file);
    filled.forEach((p) => fd.append("permits", p.file));
    fd.append("permitMeta", JSON.stringify(filled.map((p) => ({ type: p.type, custom: p.custom.trim() }))));

    setBusy(true);
    try {
      await roleApplicationApi.submitBuyer(fd);
      await reload(); // the page now shows the Pending status
    } catch (err) {
      setError(errorMessage(err));
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="relative isolate overflow-hidden rounded-2xl border border-[#D9EAD8] bg-gradient-to-br from-[#EAF7E9] via-white to-[#F8FBF6] p-5 shadow-[0_8px_25px_rgba(22,48,31,0.06)] sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-[#BDE5BB]/45 blur-2xl" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#DDF1DC] text-[#287A35] shadow-sm ring-1 ring-white/80">
            <Store size={27} strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#2E7D32]">Business / buyer application</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#D8E9D7] bg-white/85 px-2.5 py-1 text-[10.5px] font-semibold text-[#3F6944]"><ShieldCheck size={12} /> Admin reviewed</span>
            </div>
            <h2 className="mt-1.5 text-[19px] font-bold tracking-tight text-[#16301F] sm:text-[22px]">Represent your business on FarmLink</h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#5D6F60]">Share your business information and attach the relevant documents to request buyer access.</p>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            ["01", "Business details", "Contact and representative"],
            ["02", "Verification", "ID and applicable permits"],
            ["03", "Admin review", "Submit for approval"],
          ].map(([number, title, detail]) => (
            <div key={number} className="flex items-center gap-3 rounded-xl border border-white/90 bg-white/75 px-3 py-2.5 shadow-[0_2px_8px_rgba(22,48,31,0.03)]">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E4F3E2] text-[11px] font-bold text-[#2E7D32]">{number}</span>
              <div className="min-w-0"><p className="text-[12px] font-semibold text-[#1D3B24]">{title}</p><p className="text-[10.5px] leading-4 text-[#718071]">{detail}</p></div>
            </div>
          ))}
        </div>
      </div>

      <GlassCard opacity={0.94} padding="p-5 sm:p-6" className="space-y-0">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF6E9] text-[#2E7D32]"><Building2 size={19} /></span>
          <div className="min-w-0 flex-1"><h3 className="text-[15px] font-bold text-[#16301F]">Business details</h3><p className="mt-0.5 text-[12px] text-gray-500">Tell us about your organization and its representative.</p></div>
          <span className="hidden rounded-full bg-[#F3F8F1] px-2.5 py-1 text-[10.5px] font-medium text-[#68806A] sm:inline-flex">Fields marked <b className="ml-1 text-red-500">*</b> are required</span>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <Field label="Business Name" required><input value={f.businessName} onChange={up("businessName")} maxLength={120} className={inputCls + " min-h-[44px] shadow-sm transition hover:border-[#B8D4BA]"} /></Field>
          <div>
            <Field label="Business Type" required>
              <select value={f.businessType} onChange={pickBusinessType} className={inputCls + " min-h-[44px] shadow-sm transition hover:border-[#B8D4BA]"}>
                <option value="">Select type</option>
                {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            {f.businessType === "Other" && <div className="mt-3"><Field label="Please specify business type" required><input value={f.businessTypeCustom} onChange={up("businessTypeCustom")} maxLength={60} className={inputCls + " min-h-[44px] shadow-sm transition hover:border-[#B8D4BA]"} /></Field></div>}
          </div>
          <Field label="Authorized Representative" required><input value={f.representative} onChange={up("representative")} maxLength={100} className={inputCls + " min-h-[44px] shadow-sm transition hover:border-[#B8D4BA]"} /></Field>
          <Field label="Business Address" required><input value={f.businessAddress} onChange={up("businessAddress")} maxLength={200} className={inputCls + " min-h-[44px] shadow-sm transition hover:border-[#B8D4BA]"} /></Field>
          <Field label="Business Email" required><input type="email" value={f.businessEmail} onChange={up("businessEmail")} maxLength={120} className={inputCls + " min-h-[44px] shadow-sm transition hover:border-[#B8D4BA]"} /></Field>
        </div>
      </GlassCard>

      <GlassCard opacity={0.94} padding="p-5 sm:p-6" className="space-y-0">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF6E9] text-[#2E7D32]"><FileCheck2 size={19} /></span>
          <div className="min-w-0 flex-1"><h3 className="text-[15px] font-bold text-[#16301F]">Verification documents</h3><p className="mt-0.5 text-[12px] text-gray-500">Submit a representative ID and only the business documents that apply.</p></div>
          <span className="hidden items-center gap-1 rounded-full bg-[#F3F8F1] px-2.5 py-1 text-[10.5px] font-medium text-[#68806A] sm:inline-flex"><ShieldCheck size={12} /> Required</span>
        </div>
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-[#E1ECE0] bg-[#FBFDFB] p-4">
            <div className="mb-3"><p className="text-[13px] font-semibold text-[#16301F]">Authorized representative government ID <span className="text-red-500">*</span></p><p className="mt-0.5 text-[11.5px] text-gray-500">Select the ID type and attach a readable copy.</p></div>
            <DocRow label="Government ID" types={GOV_ID_TYPES} item={govId} onChange={setGovId} />
          </div>
          <div className="rounded-2xl border border-[#E1ECE0] bg-[#FBFDFB] p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><p className="text-[13px] font-semibold text-[#16301F]">Business registration / permit <span className="text-red-500">*</span></p><p className="mt-0.5 text-[11.5px] text-gray-500">At least one required. Upload only the documents that apply to your business.</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[10.5px] font-medium text-gray-500 ring-1 ring-[#E4ECE3]">Applicable documents only</span></div>
            <MultiDocPicker label="Document" types={PERMIT_TYPES} items={permits} onChange={setPermits} />
          </div>
        </div>
      </GlassCard>

      {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3.5 text-[13px] text-red-700"><span className="font-bold">!</span><span>{error}</span></p>}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#DCE9DA] bg-white/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <p className="text-[12px] leading-5 text-gray-500">Review your details and required documents before submitting.</p>
        <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-[13.5px] font-bold text-white shadow-[0_8px_18px_rgba(46,125,50,0.2)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" style={primaryStyle}>
          {busy ? <><LoaderCircle size={16} className="animate-spin" /> Submitting...</> : <>Submit Application <ArrowRight size={16} /></>}
        </button>
      </div>
    </form>
  );
}

export default function ApplyBuyer({ user, onNavigate }) {
  return (
    <ApplyGate
      user={user}
      onNavigate={onNavigate}
      title="Apply as Business / Buyer"
      subtitle="Submit your business details and verification documents. An admin will review your application."
    >
      {({ reload }) => <BuyerForm reload={reload} />}
    </ApplyGate>
  );
}