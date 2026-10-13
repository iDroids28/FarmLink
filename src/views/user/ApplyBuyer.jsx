import { useState } from "react";
import GlassCard from "../../components/GlassCard.jsx";
import { Field, inputCls, primaryBtn, primaryStyle } from "../../components/DemoBits.jsx";
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
import { EMAIL_RE, cleanMobile, isValidMobile, isValidOther } from "../../components/applicationInputs.js";


function BuyerForm({ reload }) {
  const [f, setF] = useState({
    businessName: "",
    businessType: "",
    businessTypeCustom: "",
    representative: "",
    businessAddress: "",
    businessEmail: "",
    mobile: "",
  });
  const [govId, setGovId] = useState(newDocRow());
  const [permits, setPermits] = useState([newDocRow()]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const up = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  // Choosing any type other than "Other" clears the custom text.
  const pickBusinessType = (e) => setF((s) => ({ ...s, businessType: e.target.value, businessTypeCustom: "" }));
  const upMobile = (e) => setF((s) => ({ ...s, mobile: cleanMobile(e.target.value) }));

  function validate() {
    if (f.businessName.trim().length < 2) return "Please enter your business name.";
    if (!f.businessType) return "Please select a business type.";
    if (f.businessType === "Other" && !isValidOther(f.businessTypeCustom)) return "Please specify your business type.";
    if (f.representative.trim().length < 2) return "Please enter the authorized representative.";
    if (f.businessAddress.trim().length < 5) return "Please enter your business address.";
    if (!EMAIL_RE.test(f.businessEmail.trim())) return "Please enter a valid business email.";
    if (!isValidMobile(f.mobile)) return "Please enter a valid mobile number (09XXXXXXXXX or +639XXXXXXXXX).";
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
    <form onSubmit={submit} noValidate className="space-y-6">
      <GlassCard>
        <h3 className="text-[15px] font-semibold text-[#16301F]">Business details</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Business Name" required>
            <input value={f.businessName} onChange={up("businessName")} maxLength={120} className={inputCls} />
          </Field>
          <div>
            <Field label="Business Type" required>
              <select value={f.businessType} onChange={pickBusinessType} className={inputCls}>
                <option value="">Select type</option>
                {BUSINESS_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            {f.businessType === "Other" && (
              <div className="mt-3">
                <Field label="Please specify business type" required>
                  <input
                    value={f.businessTypeCustom}
                    onChange={up("businessTypeCustom")}
                    maxLength={60}
                    className={inputCls}
                  />
                </Field>
              </div>
            )}
          </div>
          <Field label="Authorized Representative" required>
            <input value={f.representative} onChange={up("representative")} maxLength={100} className={inputCls} />
          </Field>
          <Field label="Business Address" required>
            <input value={f.businessAddress} onChange={up("businessAddress")} maxLength={200} className={inputCls} />
          </Field>
          <Field label="Business Email" required>
            <input type="email" value={f.businessEmail} onChange={up("businessEmail")} maxLength={120} className={inputCls} />
          </Field>
          <Field label="Mobile Number" required>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={f.mobile}
              onChange={upMobile}
              maxLength={13}
              placeholder="09XXXXXXXXX"
              className={inputCls}
            />
          </Field>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-[15px] font-semibold text-[#16301F]">Verification documents</h3>
        <div className="mt-4 space-y-5">
          <div>
            <p className="mb-2 text-[12.5px] font-semibold text-[#16301F]">Authorized Representative Government ID *</p>
            <DocRow label="Government ID" types={GOV_ID_TYPES} item={govId} onChange={setGovId} />
          </div>
          <div>
            <p className="mb-1 text-[12.5px] font-semibold text-[#16301F]">Business Registration / Permit * (at least one)</p>
            <p className="mb-2 text-[11.5px] text-gray-500">
              Upload only the documents that apply to your business. You do not need every type.
            </p>
            <MultiDocPicker label="Document" types={PERMIT_TYPES} items={permits} onChange={setPermits} />
          </div>
        </div>
      </GlassCard>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-[13px] text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={primaryBtn + " w-full sm:w-auto"} style={primaryStyle}>
        {busy ? "Submitting..." : "Submit Application"}
      </button>
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