import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import GlassCard from "../../components/GlassCard.jsx";
import { Field, inputCls, primaryBtn, primaryStyle } from "../../components/DemoBits.jsx";

// Shared screen for "Apply as Farmer" and "Apply as Business / Buyer".
// Only a plain `user` account can reach it (App.jsx only registers it in USER_PAGES).
// It makes no API calls. Submitting is not connected yet, so the button stays disabled.
export default function ApplicationScreen({ user, onNavigate, title, intro, fields }) {
  const [values, setValues] = useState({});

  // Safety net: farmer / buyer / admin accounts never see this screen.
  if (user?.role !== "user") return null;

  const up = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => onNavigate?.("dashboard")}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#2E7D32] hover:underline"
      >
        <ArrowLeft size={15} />
        Back to dashboard
      </button>

      <GlassCard opacity={0.85} padding="p-6">
        <h2 className="text-[19px] font-bold text-[#16301F]">{title}</h2>
        <p className="mt-1 max-w-2xl text-[13.5px] text-gray-600">{intro}</p>

        <form onSubmit={(e) => e.preventDefault()} className="mt-5 grid gap-3 sm:grid-cols-2" noValidate>
          {fields.map((f) => (
            <div key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
              <Field label={f.label} required={f.required}>
                {f.multiline ? (
                  <textarea rows={3} value={values[f.key] || ""} onChange={up(f.key)} className={inputCls} />
                ) : (
                  <input value={values[f.key] || ""} onChange={up(f.key)} className={inputCls} />
                )}
              </Field>
            </div>
          ))}

          <div className="sm:col-span-2">
            <button type="submit" disabled className={primaryBtn} style={primaryStyle}>
              Submit application
            </button>
            <p className="mt-2 text-[12.5px] text-gray-500">
              Submitting is not connected yet. Your account stays a regular account until an
              administrator approves an application.
            </p>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}