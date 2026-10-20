import { useState } from "react";
import { Menu, ArrowLeft } from "lucide-react";
import Sidebar, { MENU } from "./Sidebar.jsx";

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

// Only the Dashboard title is fixed here. Every other page title
// comes from the sidebar menu label, so the two always match.
const PAGE_TITLES = {
  dashboard: "Dashboard",
};

const BACK_STYLE = {
  background: "linear-gradient(90deg, #4CAF50, #2E7D32)",
  boxShadow: "0 4px 12px rgba(46,125,50,0.28)",
};

export default function Layout({ user, active, onNavigate, onLogout, headerActions, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const role = user?.role || "buyer";

  const current =
    PAGE_TITLES[active] ||
    (MENU[role] || []).find((m) => m.id === active)?.label ||
    active.charAt(0).toUpperCase() + active.slice(1);

  const showBack = active !== "dashboard";

  return (
      <div
        className="flex h-screen w-full overflow-hidden bg-[#F5F8F3]"
        style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
      >
        {/* The sidebar loads its own red numbers for each menu item. */}
        <Sidebar
          role={role}
          active={active}
          onNavigate={onNavigate}
          onLogout={onLogout}
          user={user}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
        />

        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[28vh] min-h-[180px]"
            style={{
              background:
                "linear-gradient(to bottom, rgba(76,175,80,0.30) 0%, rgba(167,227,160,0.16) 55%, rgba(245,248,243,0) 100%)",
            }}
          />
          <div
            className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(76,175,80,0.45) 0%, transparent 70%)",
              filter: "blur(28px)",
            }}
          />
          <div
            className="pointer-events-none absolute left-1/3 -top-28 h-64 w-80 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(139,195,74,0.38) 0%, transparent 70%)",
              filter: "blur(30px)",
            }}
          />
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(46,125,50,0.30) 0%, transparent 70%)",
              filter: "blur(30px)",
            }}
          />
          <div
            className="pointer-events-none absolute bottom-0 left-1/4 h-72 w-72 rounded-full"
            style={{
              background: "radial-gradient(circle, #E4F2DE 0%, transparent 70%)",
              opacity: 0.5,
              filter: "blur(10px)",
            }}
          />

          <header className="relative z-10 flex h-16 shrink-0 items-center gap-3 border-b border-white/40 bg-white/25 px-4 backdrop-blur-md lg:px-7">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="text-[#16301F]/70 hover:text-[#16301F] lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>

            {showBack && (
              <button
                type="button"
                onClick={() => onNavigate?.("dashboard")}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2 active:scale-[0.98]"
                style={BACK_STYLE}
              >
                <ArrowLeft size={15} strokeWidth={2.6} />
                Back
              </button>
            )}

            <h1 className="min-w-0 truncate text-[17px] font-semibold tracking-tight text-[#16301F]">
              {current}
            </h1>

            {headerActions && (
              <div className="ml-auto flex shrink-0 items-center gap-3">
                {headerActions}
              </div>
            )}
          </header>

          <main className="relative z-10 flex-1 overflow-y-auto p-5 lg:p-7">
            {children}
          </main>
        </div>
      </div>
  );
}