import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Sprout,
  Link2,
  LogOut,
  X,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ClipboardCheck,
  PackageSearch,
  PackageCheck,
  Send,
  ShoppingBag,
  Handshake,
  Bell,
  Settings,
  User,
  Store,
  Package,
  Lock,
  Inbox,
} from "lucide-react";
import ConfirmDialog from "./ConfirmDialog.jsx";
import { supplyApi } from "../api/supplyApi.js";
import { roleApplicationApi } from "../api/roleApplicationApi.js";

// Buyer menu: Find Supply, My Requests and My Pre Orders (order tracker).
const BUYER_MENU = [
  { id: "dashboard",     label: "Dashboard",       icon: LayoutDashboard },
  { id: "demands",       label: "My Demand",       icon: ClipboardList },
  { id: "available",     label: "Find Supply",     icon: PackageSearch },
  { id: "matches",       label: "Matches",         icon: Handshake },
  { id: "my-requests",   label: "My Requests",     icon: Send },
  { id: "my-preorders",  label: "My Pre Orders",   icon: ShoppingBag },
  { id: "notifications", label: "Notification",    icon: Bell },
  { id: "profile",       label: "Profile",         icon: User },
  { id: "settings",      label: "Settings",        icon: Settings },
];

// Farmer menu: Requests (accept / decline) then Order Management (order steps).
const FARMER_MENU = [
  { id: "dashboard",         label: "Dashboard",         icon: LayoutDashboard },
  { id: "supply",            label: "My Supply",         icon: Sprout },
  { id: "business-requests", label: "Business Requests", icon: Store },
  { id: "matches",           label: "Matches",           icon: Handshake },
  { id: "requests",          label: "Requests",          icon: Inbox },
  { id: "orders",            label: "Order Management",  icon: PackageCheck },
  { id: "notifications",     label: "Notification",      icon: Bell },
  { id: "profile",           label: "Profile",           icon: User },
  { id: "settings",          label: "Settings",          icon: Settings },
];

// Plain registered account: only Dashboard is navigable. Logout is handled below.
const USER_MENU = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export const MENU = {
  user: USER_MENU,
  buyer: BUYER_MENU,
  farmer: FARMER_MENU,
  admin: [
    { id: "dashboard",         label: "Dashboard",          icon: LayoutDashboard },
    { id: "farmers",           label: "Farmers",            icon: Sprout },
    { id: "buyers",            label: "Buyers",             icon: Store },
    { id: "supply-approvals",  label: "Supply Approvals",   icon: ClipboardCheck },
    { id: "supply-management", label: "Supply Management",  icon: Package },
    { id: "requirements",      label: "Business Demand",    icon: ClipboardList },
    { id: "matchings",         label: "Matchings",          icon: Link2 },
    { id: "notifications",     label: "Notifications",      icon: Bell },
    { id: "profile",           label: "Profile",            icon: User },
    { id: "settings",          label: "Settings",           icon: Settings },
  ],
};

/* Red numbers per menu item. A missing item or 0 shows nothing. Re-read on open,
   every 10 seconds, when the tab regains focus, and every time another page opens. */
function useBadgeCounts(role, active) {
  const [badges, setBadges] = useState({});

  useEffect(() => {
    if (!["buyer", "farmer", "admin"].includes(role)) {
      setBadges({});
      return undefined;
    }
    let alive = true;

    async function load() {
      const next = {};
      try {
        const c = await supplyApi.counts();
        if (role === "buyer") {
          next.notifications = c.notifications;
          next.matches = c.matches;
          next["my-requests"] = c.requests;
          next["my-preorders"] = c.preorders;
        } else if (role === "farmer") {
          next.notifications = c.notifications;
          next.matches = c.matches;
          next.requests = c.requests;
          next.supply = c.supply;
        } else {
          next.notifications = c.notifications;
          next["supply-approvals"] = c.supplyApprovals;
        }
      } catch {
        /* keep whatever we have */
      }

      if (role === "admin") {
        try {
          const [f, b] = await Promise.all([
            roleApplicationApi.adminList({ type: "farmer", status: "pending" }),
            roleApplicationApi.adminList({ type: "buyer", status: "pending" }),
          ]);
          next.farmers = (f.applications || []).length;
          next.buyers = (b.applications || []).length;
        } catch {
          /* keep whatever we have */
        }
      }

      if (alive) setBadges((old) => ({ ...old, ...next }));
    }

    load();
    const timer = setInterval(load, 10000);
    window.addEventListener("focus", load);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [role, active]);

  return badges;
}

export default function Sidebar({
  role = "user",
  active = "dashboard",
  onNavigate,
  onLogout,
  user,
  open = false,
  onClose,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const badges = useBadgeCounts(role, active);

  const items = MENU[role] || MENU.user;

  function renderItem(item) {
    const isActive = item.id === active;
    const Icon = item.icon;
    const locked = item.sellerOnly && role !== "farmer";
    const count = Number(badges[item.id]) || 0;
    const countText = count > 99 ? "99+" : String(count);
    const isNotificationItem = item.id === "notifications";

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          onNavigate?.(item.id);
          onClose?.();
        }}
        aria-current={isActive ? "page" : undefined}
        aria-label={count > 0 ? `${item.label}, ${countText} new` : item.label}
        title={collapsed ? item.label : locked ? "Apply as a Farmer first" : undefined}
        className={
          "group relative flex w-full items-center gap-3 rounded-xl py-2.5 text-[14px] transition " +
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 " +
          (collapsed ? "justify-center px-0" : "px-3") +
          " " +
          (isActive
            ? "bg-white/15 font-semibold text-white"
            : locked
            ? "text-white/45 hover:bg-white/10 hover:text-white/80"
            : "text-white/70 hover:bg-white/10 hover:text-white")
        }
      >
        <span
          className={
            "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r " +
            (isActive ? "bg-[#7BC96F]" : "bg-transparent")
          }
        />
        <span className="relative shrink-0">
          <Icon size={18} strokeWidth={isActive ? 2.4 : 2} />
          {collapsed && count > 0 && (
            isNotificationItem ? (
              <span aria-hidden="true" className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[#16301F]" />
            ) : (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                {countText}
              </span>
            )
          )}
        </span>
        {!collapsed && <span className="truncate">{item.label}</span>}
        {!collapsed && count > 0 && (
          isNotificationItem ? (
            <span aria-hidden="true" className="ml-auto mr-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 ring-2 ring-[#16301F]" />
          ) : (
            <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-none text-white">
              {countText}
            </span>
          )
        )}
        {!collapsed && locked && <Lock size={13} className="ml-auto shrink-0" />}
      </button>
    );
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-[#16301F] transition-all duration-200 " +
          "lg:static lg:translate-x-0 " +
          (collapsed ? "w-20" : "w-64") +
          " " +
          (open ? "translate-x-0" : "-translate-x-full")
        }
        style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
      >
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={
            "absolute top-1/2 -right-3 z-50 hidden h-7 w-7 -translate-y-1/2 items-center justify-center " +
            "rounded-full border border-white/10 bg-[#16301F] text-white/70 shadow-md transition " +
            "hover:bg-white/10 hover:text-white lg:flex"
          }
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <div className={"flex items-center gap-2.5 pb-5 pt-6 " + (collapsed ? "justify-center px-2" : "px-5")}>
          <img src="/logo.png" alt="" className="h-9 w-9 shrink-0 object-contain" />
          {!collapsed && (
            <span className="truncate text-[17px] font-bold tracking-tight text-white">FarmLink</span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-white/70 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className={"flex-1 space-y-1 overflow-y-auto " + (collapsed ? "px-2" : "px-3")}>
          {items.map(renderItem)}
        </nav>

        <div className={"space-y-1 pb-4 pt-3 " + (collapsed ? "px-2" : "px-3")}>
          <div className="mb-2 h-px bg-white/10" />

          <div
            className={
              "mt-3 flex items-center rounded-xl bg-white/5 py-2.5 " +
              (collapsed ? "justify-center px-0" : "gap-2.5 px-3")
            }
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4CAF50] text-[13px] font-bold text-white">
              {(user?.name || user?.email || "?").charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[12px] font-semibold leading-4 text-white"
                    title={user?.name || user?.email || "FarmLink User"}
                  >
                    {user?.name || user?.email || "FarmLink User"}
                  </p>
                  <p className="truncate text-[11px] leading-4 text-white/60">
                    {{ user: "User", farmer: "Farmer", buyer: "Business / Buyer", admin: "Admin" }[
                      String(role || user?.role || "user").toLowerCase()
                    ] || "User"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmLogoutOpen(true)}
                  className="shrink-0 text-white/60 hover:text-[#FF8A80] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                  aria-label="Log out"
                  title="Log out"
                >
                  <LogOut size={17} />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      <ConfirmDialog
        open={confirmLogoutOpen}
        title="Are you sure you want to log out?"
        cancelLabel="Cancel"
        confirmLabel="Logout"
        onCancel={() => setConfirmLogoutOpen(false)}
        onConfirm={() => {
          setConfirmLogoutOpen(false);
          onClose?.();
          onLogout?.();
        }}
      />
    </>
  );
}