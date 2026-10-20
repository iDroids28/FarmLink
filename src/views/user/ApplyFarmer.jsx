import { useState } from "react";
import { ArrowRight, CheckCircle2, FileCheck2, LoaderCircle, ShieldCheck, Sprout, UserRound } from "lucide-react";
import GlassCard from "../../components/GlassCard.jsx";
import { Field, inputCls, primaryStyle } from "../../components/DemoBits.jsx";
import {
  ApplyGate,
  PhotoPicker,
  DocRow,
  MultiDocPicker,
  newDocRow,
  checkDocRows,
  GOV_ID_TYPES,
  PROOF_TYPES,
  FARMER_STATUSES,
} from "../../components/RoleApplicationParts.jsx";
import { roleApplicationApi, errorMessage } from "../../api/roleApplicationApi.js";
import {
  EMAIL_RE,
  cleanName,
  isValidName,
  isValidOther,
} from "../../components/applicationInputs.js";

function FarmerForm({ user, reload }) {
  const [f, setF] = useState({
    fullName: user?.name || "",
    email: user?.email || "",
    address: "",
    farmLocation: "",
    products: "",
    farmerStatus: "",
    farmerStatusCustom: "",
  });
  const [photo, setPhoto] = useState(null);
  const [govId, setGovId] = useState(newDocRow());
  const [proofs, setProofs] = useState([newDocRow()]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const up = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  // Typing/pasting: numbers and symbols a name cannot contain are dropped.
  const upName = (e) => setF((s) => ({ ...s, fullName: cleanName(e.target.value) }));
  // Choosing any status other than "Other" clears the custom text.
  const pickStatus = (e) => setF((s) => ({ ...s, farmerStatus: e.target.value, farmerStatusCustom: "" }));

  function validate() {
    if (!isValidName(f.fullName)) {
      return f.fullName.trim().length < 2
        ? "Please enter your full name."
        : "Full name can only contain letters, spaces, hyphens, and apostrophes.";
    }
    if (!EMAIL_RE.test(f.email.trim())) return "Please enter a valid email address.";
    if (f.address.trim().length < 5) return "Please enter your address.";
    if (f.farmLocation.trim().length < 3) return "Please enter your farm location.";
    if (f.products.trim().length < 2) return "Please enter your main agricultural products/crops.";
    if (!f.farmerStatus) return "Please select your farmer status.";
    if (f.farmerStatus === "Other" && !isValidOther(f.farmerStatusCustom)) return "Please specify your farmer status.";
    if (!photo) return "Please upload your farmer photo.";
    const g = checkDocRows([govId], "Government ID");
    if (g) return g;
    return checkDocRows(proofs, "proof of farming activity");
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const msg = validate();
    setError(msg);
    if (msg) return;

    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => fd.append(k, v.trim()));
    fd.append("photo", photo);
    fd.append("govIdType", govId.type);
    fd.append("govIdCustom", govId.custom.trim());
    fd.append("govId", govId.file);
    const filled = proofs.filter((p) => p.file);
    filled.forEach((p) => fd.append("proofs", p.file));
    fd.append("proofMeta", JSON.stringify(filled.map((p) => ({ type: p.type, custom: p.custom.trim() }))));

    setBusy(true);
    try {
      await roleApplicationApi.submitFarmer(fd);
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
            <Sprout size={27} strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#2E7D32]">Farmer application</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#D8E9D7] bg-white/85 px-2.5 py-1 text-[10.5px] font-semibold text-[#3F6944]">
                <ShieldCheck size={12} /> Admin reviewed
              </span>
            </div>
            <h2 className="mt-1.5 text-[19px] font-bold tracking-tight text-[#16301F] sm:text-[22px]">Tell us about your farm</h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#5D6F60]">
              Complete your contact details and upload the documents needed to verify your farmer account.
            </p>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            ["01", "Your details", "Contact and farm information"],
            ["02", "Verification", "Photo and supporting documents"],
            ["03", "Admin review", "Submit for approval"],
          ].map(([number, title, detail]) => (
            <div key={number} className="flex items-center gap-3 rounded-xl border border-white/90 bg-white/75 px-3 py-2.5 shadow-[0_2px_8px_rgba(22,48,31,0.03)]">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E4F3E2] text-[11px] font-bold text-[#2E7D32]">{number}</span>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-[#1D3B24]">{title}</p>
                <p className="text-[10.5px] leading-4 text-[#718071]">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <GlassCard opacity={0.94} padding="p-5 sm:p-6" className="space-y-0">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF6E9] text-[#2E7D32]"><UserRound size={19} /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold text-[#16301F]">Farmer details</h3>
            <p className="mt-0.5 text-[12px] text-gray-500">Enter your contact and farm information.</p>
          </div>
          <span className="hidden rounded-full bg-[#F3F8F1] px-2.5 py-1 text-[10.5px] font-medium text-[#68806A] sm:inline-flex">Fields marked <b className="ml-1 text-red-500">*</b> are required</span>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <Field label="Full Name" required>
            <input value={f.fullName} onChange={upName} maxLength={100} autoComplete="name" className={inputCls + " min-h-[44px] shadow-sm transition hover:border-[#B8D4BA]"} />
          </Field>
          <Field label="Email" required>
            <input type="email" value={f.email} onChange={up("email")} maxLength={120} className={inputCls + " min-h-[44px] shadow-sm transition hover:border-[#B8D4BA]"} />
          </Field>
          <Field label="Address" required>
            <input value={f.address} onChange={up("address")} maxLength={200} className={inputCls + " min-h-[44px] shadow-sm transition hover:border-[#B8D4BA]"} />
          </Field>
          <Field label="Farm Location" required>
            <input value={f.farmLocation} onChange={up("farmLocation")} placeholder="e.g. Urdaneta, Pangasinan" maxLength={200} className={inputCls + " min-h-[44px] shadow-sm transition hover:border-[#B8D4BA]"} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Main Agricultural Products/Crops" required>
              <input value={f.products} onChange={up("products")} placeholder="e.g. Rice, tomatoes, eggplant" maxLength={200} className={inputCls + " min-h-[44px] shadow-sm transition hover:border-[#B8D4BA]"} />
            </Field>
          </div>
          <div>
            <Field label="Farmer Status" required>
              <select value={f.farmerStatus} onChange={pickStatus} className={inputCls + " min-h-[44px] shadow-sm transition hover:border-[#B8D4BA]"}>
                <option value="">Select status</option>
                {FARMER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            {f.farmerStatus === "Other" && (
              <div className="mt-3">
                <Field label="Please specify farmer status" required>
                  <input value={f.farmerStatusCustom} onChange={up("farmerStatusCustom")} maxLength={60} className={inputCls + " min-h-[44px] shadow-sm transition hover:border-[#B8D4BA]"} />
                </Field>
              </div>
            )}
          </div>
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-[#F5FAF3] px-3.5 py-3 text-[12px] leading-5 text-[#607263]">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#3F9149]" /> You do not need to own land to apply. Farm owner, tenant, lessee, and farm worker applicants are welcome.
        </p>
      </GlassCard>

      <GlassCard opacity={0.94} padding="p-5 sm:p-6" className="space-y-0">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF6E9] text-[#2E7D32]"><FileCheck2 size={19} /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold text-[#16301F]">Verification documents</h3>
            <p className="mt-0.5 text-[12px] text-gray-500">Use clear, readable files so the admin can review your application.</p>
          </div>
          <span className="hidden items-center gap-1 rounded-full bg-[#F3F8F1] px-2.5 py-1 text-[10.5px] font-medium text-[#68806A] sm:inline-flex"><ShieldCheck size={12} /> Required</span>
        </div>
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-[#E1ECE0] bg-[#FBFDFB] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div><p className="text-[13px] font-semibold text-[#16301F]">Farmer photo <span className="text-red-500">*</span></p><p className="mt-0.5 text-[11.5px] text-gray-500">A clear photo helps identify the applicant.</p></div>
              <span className="rounded-full bg-white px-2.5 py-1 text-[10.5px] font-medium text-gray-500 ring-1 ring-[#E4ECE3]">Max 2 MB</span>
            </div>
            <PhotoPicker file={photo} onChange={setPhoto} />
          </div>
          <div className="rounded-2xl border border-[#E1ECE0] bg-[#FBFDFB] p-4">
            <div className="mb-3"><p className="text-[13px] font-semibold text-[#16301F]">Government ID <span className="text-red-500">*</span></p><p className="mt-0.5 text-[11.5px] text-gray-500">Choose the ID type and attach a readable copy.</p></div>
            <DocRow label="Government ID" types={GOV_ID_TYPES} item={govId} onChange={setGovId} />
          </div>
          <div className="rounded-2xl border border-[#E1ECE0] bg-[#FBFDFB] p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div><p className="text-[13px] font-semibold text-[#16301F]">Proof of farming activity <span className="text-red-500">*</span></p><p className="mt-0.5 text-[11.5px] text-gray-500">At least one required. Upload only documents that apply to you.</p></div>
              <span className="rounded-full bg-white px-2.5 py-1 text-[10.5px] font-medium text-gray-500 ring-1 ring-[#E4ECE3]">Up to 5 files</span>
            </div>
            <MultiDocPicker label="Proof" types={PROOF_TYPES} items={proofs} onChange={setProofs} />
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

export default function ApplyFarmer({ user, onNavigate }) {
  return (
    <ApplyGate
      user={user}
      onNavigate={onNavigate}
      title="Apply as Farmer"
      subtitle="Submit your details and verification documents. An admin will review your application."
    >
      {({ reload }) => <FarmerForm user={user} reload={reload} />}
    </ApplyGate>
  );
}