import { useEffect } from "react";
import { Sprout, Store } from "lucide-react";
import GlassCard from "../../components/GlassCard.jsx";
import { LoadNote } from "../../components/DemoBits.jsx";
import ApplicationOverview from "../../components/ApplicationOverview.jsx";
import { useMyApplications } from "../../api/roleApplicationApi.js";

const STEPS = [
  { title: "Register", text: "Create your FarmLink account." },
  { title: "Choose a role", text: "Pick Farmer or Business / Buyer." },
  { title: "Submit verification", text: "Send the details needed for your role." },
  { title: "Admin review", text: "An administrator reviews your application." },
  { title: "Get approved", text: "Your account is given the role you applied for." },
  { title: "Use FarmLink", text: "The features for your role become available." },
];

const BUTTONS = [
  {
    id: "apply-farmer",
    page: "apply-farmer",
    label: "Apply as Farmer",
    note: "Post the agricultural supply you can provide.",
    icon: Sprout,
  },
  {
    id: "apply-buyer",
    page: "apply-buyer",
    label: "Apply as Business / Buyer",
    note: "Post the agricultural products you need.",
    icon: Store,
  },
];

export default function UserDashboard({ user, onNavigate, onRefreshUser }) {
  const canChooseRole = user?.role === "user";
  // The backend is the source of truth. Re-checks every 15s while one is pending.
  const { data, loading, error, reload } = useMyApplications({ pollWhenPending: canChooseRole });
  const latest = data?.latest || null;
  // After a rejection, offer ONE re-apply action for the same application type.
  const reapplyPage = latest?.type === "buyer" ? "apply-buyer" : "apply-farmer";

  // Once an admin approves, reload the account so the new role (and its
  // dashboard / menu) appears without logging out.
  useEffect(() => {
    if (canChooseRole && latest?.status === "approved") {
      Promise.resolve(onRefreshUser?.()).catch(() => {});
    }
  }, [canChooseRole, latest?.id, latest?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <GlassCard opacity={0.85} padding="p-6">
        <h2 className="text-[19px] font-bold text-[#16301F]">What is FarmLink?</h2>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-gray-600">
          FarmLink is an agricultural supply and demand coordination system. It connects
          farmers who have produce to supply with businesses and buyers who need it, so
          both sides can find possible matches and coordinate. FarmLink does not process
          payments.
        </p>
      </GlassCard>

      <GlassCard opacity={0.85} padding="p-6">
        <h2 className="text-[19px] font-bold text-[#16301F]">How FarmLink works</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex items-start gap-3">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
                style={{ background: "linear-gradient(90deg, #4CAF50, #2E7D32)" }}
              >
                {i + 1}
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-[#16301F]">{s.title}</p>
                <p className="text-[12.5px] text-gray-600">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </GlassCard>

      {/* Not loaded yet: show nothing here, so the Apply buttons never flash
          before the saved application is known. */}
      {canChooseRole && !data && <LoadNote loading={loading} error={error} />}
      {canChooseRole && !data && !loading && error && (
        <button
          type="button"
          onClick={reload}
          className="rounded-md bg-gray-100 px-3 py-1.5 text-[12.5px] font-semibold text-gray-700 hover:bg-gray-200"
        >
          Try again
        </button>
      )}

      {/* An application exists: show its details and hide BOTH Apply buttons. */}
      {canChooseRole && latest && (
        <ApplicationOverview application={latest} onReapply={() => onNavigate?.(reapplyPage)} />
      )}

      {/* No application yet: show the two Apply buttons. */}
      {canChooseRole && data && !latest && (
        <GlassCard opacity={0.85} padding="p-6">
          <h2 className="text-[19px] font-bold text-[#16301F]">Choose how you will use FarmLink</h2>
          <p className="mt-1 text-[13.5px] text-gray-600">
            One account has one role. Choose the one that fits you.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {BUTTONS.map(({ id, page, label, note, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate?.(page)}
                className="flex items-start gap-3 rounded-2xl px-5 py-4 text-left text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2 active:scale-[0.99]"
                style={{
                  background: "linear-gradient(90deg, #4CAF50, #2E7D32)",
                  boxShadow: "0 6px 16px rgba(46,125,50,0.25)",
                }}
              >
                <Icon size={22} className="mt-0.5 shrink-0" />
                <span>
                  <span className="block text-[15px] font-bold">{label}</span>
                  <span className="block text-[12.5px] text-white/85">{note}</span>
                </span>
              </button>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}