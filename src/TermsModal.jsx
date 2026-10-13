import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ShieldCheck } from "lucide-react";

/* =====================================================================
   Terms and Conditions popup for the Sign Up page.
   Every section describes something FarmLink really does, so update this
   text whenever the security features change.
   ===================================================================== */

const LAST_UPDATED = "September 30, 2026";

const SECTIONS = [
  {
    title: "1. Acceptance of these terms",
    body: [
      "By creating a FarmLink account you agree to these Terms and Conditions and the privacy information below. If you do not agree, please do not sign up.",
      "FarmLink connects farmers, buyers, and administrators. Please give accurate information and keep your login details to yourself.",
    ],
  },
  {
    title: "2. Input validation",
    body: [
      "We check everything you send us, in your browser and again on our server, and we reject anything invalid or unsafe.",
    ],
    list: [
      "Name: letters, spaces, hyphens, and apostrophes only, up to 100 characters.",
      "Email: must be a valid Gmail address (@gmail.com).",
      "Password: at least 8 characters with an uppercase letter, a lowercase letter, a number, and a special character.",
      "Requests are size-limited, and special database characters (such as $ and .) in field names are removed to block injection attacks.",
    ],
  },
  {
    title: "3. Authentication and multi-factor verification",
    body: [
      "You prove your identity with your Gmail address and password. Login errors are intentionally generic (\"Incorrect email or password\") so nobody can find out which emails have accounts.",
    ],
    list: [
      "Account lockout: after 5 failed login attempts, your account is locked for 1 minute. Each further lockout doubles the wait, up to 60 minutes.",
      "Rate limiting: repeated login, signup, and OTP requests from one source are slowed down or blocked.",
      "One-time password (OTP): a 6-digit code is required to reset a forgotten password. It expires, allows at most 5 wrong entries, and is deleted after use.",
      "Additional multi-factor verification at login may be added in a future version.",
    ],
  },
  {
    title: "4. Authorization and access control",
    body: [
      "What you can see and do depends on your role. The server enforces this on every protected request, not only in the screens you see.",
    ],
    list: [
      "Farmer: manages their own dashboard, orders, deliveries, reports, and product listings.",
      "Buyer: browses the marketplace and manages their own orders. Buyers cannot create products.",
      "Administrator: manages the platform. Admin accounts cannot be created through public signup.",
      "Any attempt to use a function outside your role is refused.",
    ],
  },
  {
    title: "5. Error handling",
    body: [
      "If something goes wrong, you see a short, plain message. Technical details such as stack traces and database messages are logged privately on our server and are never shown to users. The system is built to keep running instead of crashing when a request fails.",
    ],
  },
  {
    title: "6. Data protection",
    list: [
      "Passwords are never stored as plain text. They are hashed with bcrypt, and the hash is never sent back to your browser.",
      "Your login session is a token kept in an httpOnly cookie, so page scripts cannot read it.",
      "In production, the cookie is sent over HTTPS only and uses SameSite protection.",
      "Secrets such as database credentials and signing keys are kept in server environment settings, not in the code.",
    ],
  },
  {
    title: "7. Privacy and consent",
    body: [
      "We follow data minimization and purpose limitation: we collect only what we need and use it only for the reasons stated here.",
    ],
    list: [
      "What we collect: your name, Gmail address, account role, and the date and time you gave consent.",
      "Why we collect it: to create and secure your account, sign you in, and show the right tools for your role.",
      "If you tick Remember Me, your email address (never your password) is saved in your own browser so it is filled in next time. Unticking Remember Me removes it.",
      "We do not sell your data or share it with third parties.",
      "Your consent is required to sign up, is checked on the server, and is recorded with a timestamp.",
      "You may contact us to ask about, correct, or request deletion of your data.",
    ],
  },
  {
    title: "8. Session and account security",
    list: [
      "By default, your session ends when you close your browser and expires automatically after 2 hours.",
      "If you tick Remember Me, you stay logged in on that device for up to 7 days. Only a secure, expiring login token is kept. Your password is never saved by FarmLink.",
      "Logging out asks you to confirm, then immediately clears your session cookie. Do not use Remember Me on shared devices.",
      "Resetting your password also clears any lockout on your account.",
      "You are responsible for activity under your account. Log out on shared devices and tell us if you suspect unauthorized access.",
    ],
  },
  {
    title: "9. Acceptable use",
    body: [
      "Do not try to break, probe, or overload FarmLink, access another user's account or data, or post false or misleading product information. We may suspend accounts that break these rules.",
    ],
  },
  {
    title: "10. Changes to these terms",
    body: [
      "We may update these terms as FarmLink grows. When we make important changes, we will ask you to review them. Continuing to use FarmLink after that means you accept the updated terms.",
    ],
  },
];

export default function TermsModal({ open, onClose, onAgree }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  // Rendered through a portal because the sign-up card uses backdrop-filter
  // and overflow-hidden, which would trap and clip a fixed-position popup.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-title"
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        {/* green accent bar, same as the auth card */}
        <div
          className="h-1.5 w-full shrink-0"
          style={{ background: "linear-gradient(90deg, #8BC34A, #4CAF50, #2E7D32)" }}
        />

        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#DCE7DC] px-6 py-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-[#2E7D32]" />
            <div>
              <h2
                id="terms-title"
                className="text-lg font-semibold text-[#1B5E20]"
                style={{ fontFamily: "Fraunces, Georgia, serif" }}
              >
                Terms and Conditions
              </h2>
              <p className="text-xs text-gray-500">Last updated {LAST_UPDATED}</p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close terms and conditions"
            className="rounded-full p-1.5 text-gray-500 hover:bg-[#F4F7F3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="space-y-5 overflow-y-auto px-6 py-5 text-[13.5px] leading-relaxed text-gray-700">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h3 className="mb-1.5 font-semibold text-[#1B5E20]">{s.title}</h3>
              {s.body?.map((p, i) => (
                <p key={i} className="mb-2">
                  {p}
                </p>
              ))}
              {s.list && (
                <ul className="list-disc space-y-1 pl-5 marker:text-[#4CAF50]">
                  {s.list.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#DCE7DC] px-6 py-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#DCE7DC] px-5 py-2 text-[13px] font-semibold text-gray-700 hover:bg-[#F4F7F3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50]"
          >
            Close
          </button>
          {onAgree && (
            <button
              type="button"
              onClick={() => {
                onAgree();
                onClose();
              }}
              className="rounded-full px-5 py-2 text-[13px] font-bold text-white hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2"
              style={{ background: "linear-gradient(90deg, #4CAF50, #2E7D32)" }}
            >
              I agree
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}