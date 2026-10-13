import { useState } from "react";
import GlassCard from "../../components/GlassCard.jsx";
import { Field, inputCls, primaryBtn, primaryStyle } from "../../components/DemoBits.jsx";
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
  cleanMobile,
  cleanName,
  isValidMobile,
  isValidName,
  isValidOther,
} from "../../components/applicationInputs.js";

function FarmerForm({ user, reload }) {
  const [f, setF] = useState({
    fullName: user?.name || "",
    email: user?.email || "",
    mobile: "",
    address: "",
    farmLocation: "",
    farmingType: "",
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
  // Typing/pasting: only digits (and a leading "+") are kept.
  const upMobile = (e) => setF((s) => ({ ...s, mobile: cleanMobile(e.target.value) }));
  // Choosing any status other than "Other" clears the custom text.
  const pickStatus = (e) => setF((s) => ({ ...s, farmerStatus: e.target.value, farmerStatusCustom: "" }));

  function validate() {
    if (!isValidName(f.fullName)) {
      return f.fullName.trim().length < 2
        ? "Please enter your full name."
        : "Full name can only contain letters, spaces, hyphens, and apostrophes.";
    }
    if (!EMAIL_RE.test(f.email.trim())) return "Please enter a valid email address.";
    if (!isValidMobile(f.mobile)) return "Please enter a valid mobile number (09XXXXXXXXX or +639XXXXXXXXX).";
    if (f.address.trim().length < 5) return "Please enter your address.";
    if (f.farmLocation.trim().length < 3) return "Please enter your farm location.";
    if (f.farmingType.trim().length < 2) return "Please enter your type of farming.";
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
    <form onSubmit={submit} noValidate className="space-y-6">
      <GlassCard>
        <h3 className="text-[15px] font-semibold text-[#16301F]">Farmer details</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Full Name" required>
            <input value={f.fullName} onChange={upName} maxLength={100} autoComplete="name" className={inputCls} />
          </Field>
          <Field label="Email" required>
            <input type="email" value={f.email} onChange={up("email")} maxLength={120} className={inputCls} />
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
          <Field label="Address" required>
            <input value={f.address} onChange={up("address")} maxLength={200} className={inputCls} />
          </Field>
          <Field label="Farm Location" required>
            <input value={f.farmLocation} onChange={up("farmLocation")} placeholder="e.g. Urdaneta, Pangasinan" maxLength={200} className={inputCls} />
          </Field>
          <Field label="Type of Farming" required>
            <input value={f.farmingType} onChange={up("farmingType")} placeholder="e.g. Rice, vegetables, poultry" maxLength={100} className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Main Agricultural Products/Crops" required>
              <input value={f.products} onChange={up("products")} placeholder="e.g. Rice, tomatoes, eggplant" maxLength={200} className={inputCls} />
            </Field>
          </div>
          <div>
            <Field label="Farmer Status" required>
              <select value={f.farmerStatus} onChange={pickStatus} className={inputCls}>
                <option value="">Select status</option>
                {FARMER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            {f.farmerStatus === "Other" && (
              <div className="mt-3">
                <Field label="Please specify farmer status" required>
                  <input
                    value={f.farmerStatusCustom}
                    onChange={up("farmerStatusCustom")}
                    maxLength={60}
                    className={inputCls}
                  />
                </Field>
              </div>
            )}
          </div>
        </div>
        <p className="mt-3 text-[12px] text-gray-500">You do not need to own land to apply.</p>
      </GlassCard>

      <GlassCard>
        <h3 className="text-[15px] font-semibold text-[#16301F]">Verification documents</h3>
        <div className="mt-4 space-y-5">
          <div>
            <p className="mb-2 text-[12.5px] font-semibold text-[#16301F]">Farmer Photo *</p>
            <PhotoPicker file={photo} onChange={setPhoto} />
          </div>
          <div>
            <p className="mb-2 text-[12.5px] font-semibold text-[#16301F]">Government ID *</p>
            <DocRow label="Government ID" types={GOV_ID_TYPES} item={govId} onChange={setGovId} />
          </div>
          <div>
            <p className="mb-1 text-[12.5px] font-semibold text-[#16301F]">Proof of Farming Activity * (at least one)</p>
            <p className="mb-2 text-[11.5px] text-gray-500">Add up to 5 files. Only submit the documents that apply to you.</p>
            <MultiDocPicker label="Proof" types={PROOF_TYPES} items={proofs} onChange={setProofs} />
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