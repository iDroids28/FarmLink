import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import Login from "./login.js";
import Signup from "./Signup.js";
import Forgot from "./Forgot.js";
import Layout from "./components/Layout.jsx";
import GlassCard from "./components/GlassCard.jsx";
import { API_URL, safeFetchJson } from "./AuthShared";
import Home from "./pages/home.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AdminFarmers from "./pages/AdminFarmers.jsx";
import AdminBuyers from "./pages/AdminBuyers.jsx";
import AdminSupply from "./pages/AdminSupply.jsx";
import AdminRequirements from "./pages/AdminRequirements.jsx";
import AdminMatchings from "./pages/AdminMatchings.jsx";
import AdminNotifications from "./pages/AdminNotifications.jsx";
import AdminSettings from "./pages/AdminSettings.jsx";
import AdminProfile from "./pages/AdminProfile.jsx"; // NEW
import BuyerDashboard from "./views/buyer/BuyerDashboard.jsx";
import MyDemands from "./views/buyer/MyDemands.jsx";
import AvailableSupply from "./views/buyer/AvailableSupply.jsx";
import BusinessRequests from "./views/farmer/BusinessRequests.jsx";
import BuyerMatches from "./views/buyer/BuyerMatches.jsx";
import Notifications from "./views/buyer/Notifications.jsx";
import Settings from "./views/buyer/Settings.jsx";
import Profile from "./views/buyer/Profile.jsx";
import MySupply from "./views/farmer/MySupply.jsx";
import UserDashboard from "./views/user/UserDashboard.jsx";
import ApplyFarmer from "./views/user/ApplyFarmer.jsx";
import ApplyBuyer from "./views/user/ApplyBuyer.jsx";
import FarmerDashboard from "./views/farmer/FarmerDashboard.jsx";
import FarmerMatches from "./views/farmer/FarmerMatches.jsx";
import FarmerProfile from "./views/farmer/FarmerProfile.jsx"; // NEW

const BUYER_PAGES = {
  dashboard: BuyerDashboard,
  demands: MyDemands,
  available: AvailableSupply,
  matches: BuyerMatches,
  notifications: Notifications,
  settings: Settings,
  profile: Profile, // buyer profile
};
const FARMER_PAGES = {
  dashboard: FarmerDashboard,
  supply: MySupply,
  "business-requests": BusinessRequests,
  matches: FarmerMatches,
  notifications: Notifications,
  settings: Settings,
  profile: FarmerProfile, // CHANGED: farmer has its own profile
};
// Only the `user` role can open the application pages. Farmer / buyer / admin
// do not have these keys, so they can never reach them.
const USER_PAGES = {
  dashboard: UserDashboard,
  "apply-farmer": ApplyFarmer,
  "apply-buyer": ApplyBuyer,
};
const ADMIN_PAGES = {
  dashboard: AdminDashboard,
  farmers: AdminFarmers,
  buyers: AdminBuyers,
  supply: AdminSupply,
  requirements: AdminRequirements,
  matchings: AdminMatchings,
  notifications: AdminNotifications,
  settings: AdminSettings,
  profile: AdminProfile, // NEW: admin profile
};
const PAGES = {
  user: USER_PAGES,
  farmer: FARMER_PAGES,
  buyer: BUYER_PAGES,
  admin: ADMIN_PAGES,
};
function normalizeRole(account) {
  const role = String(account?.role || "user").toLowerCase();
  return ["user", "farmer", "buyer", "admin"].includes(role) ? role : "user";
}
export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [pageMode, setPageMode] = useState(null);
  const [authScreen, setAuthScreen] = useState("home");
  const [checkingSession, setCheckingSession] = useState(true);
  useEffect(() => {
    safeFetchJson(`${API_URL}/me`)
      .then((data) => handleLogin(data))
      .catch(() => {})
      .finally(() => setCheckingSession(false));
  }, []);
  useEffect(() => {
    if (user?.role !== "user") return undefined;
    const onFocus = () => {
      refreshUser().catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user?.role]);
  function handleLogin(userData) {
    const account = userData?.user || userData || {};
    setUser({ ...account, role: normalizeRole(account) });
    setPage("dashboard");
    setPageMode(null);
  }
  function refreshUser() {
    return safeFetchJson(`${API_URL}/me`).then((data) => {
      const account = data?.user || data || {};
      setUser((u) => ({ ...u, ...account, role: normalizeRole(account) }));
    });
  }
  function navigate(nextPage, mode = null) {
    setPage(nextPage);
    setPageMode(mode);
  }
  function handleLogout() {
    safeFetchJson(`${API_URL}/logout`, { method: "POST" }).catch(() => {});
    setUser(null);
    setPage("dashboard");
    setPageMode(null);
    setAuthScreen("home");
  }
  if (checkingSession) {
    return null;
  }
  if (!user) {
    if (authScreen === "home") {
      return (
        <Home
          onGoToLogin={() => setAuthScreen("login")}
          onGoToSignup={() => setAuthScreen("signup")}
        />
      );
    }
    if (authScreen === "signup") {
      return <Signup onGoToLogin={() => setAuthScreen("login")} />;
    }
    if (authScreen === "forgot") {
      return <Forgot onGoToLogin={() => setAuthScreen("login")} />;
    }
    return (
      <Login
        onLogin={handleLogin}
        onGoToSignup={() => setAuthScreen("signup")}
        onGoToForgot={() => setAuthScreen("forgot")}
        onGoToHome={() => setAuthScreen("home")}
      />
    );
  }
  const roleMenu = PAGES[user.role] || PAGES.user;
  // If the current page does not exist for this role (for example right after an
  // admin approves the account and the role changes from user to farmer), fall
  // back to that role's dashboard instead of showing a "no page" message.
  const activePage = roleMenu[page] ? page : "dashboard";
  const PageComponent = roleMenu[activePage];
  const showPlus =
    user.role !== "admin" &&
    (activePage === "demands" || (activePage === "supply" && user.role === "farmer"));
  const plusLabel = activePage === "supply" ? "Add Supply" : "Create New Requirement";
  const headerActions = showPlus ? (
    <button
      type="button"
      onClick={() => navigate(activePage, "create")}
      aria-label={plusLabel}
      title={plusLabel}
      className="flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2 active:scale-95"
      style={{
        background: "linear-gradient(90deg, #4CAF50, #2E7D32)",
        boxShadow: "0 4px 12px rgba(46,125,50,0.28)",
      }}
    >
      <Plus size={18} strokeWidth={2.6} />
    </button>
  ) : null;
  return (
    <Layout
      user={user}
      active={activePage}
      onNavigate={navigate}
      onLogout={handleLogout}
      headerActions={headerActions}
    >
      {PageComponent ? (
        <PageComponent
          user={user}
          intent={pageMode}
          mode={pageMode}
          onNavigate={navigate}
          onRefreshUser={refreshUser}
          onLogout={handleLogout} // NEW: used by the Log Out buttons on the profile pages
        />
      ) : (
        <ComingSoon page={activePage} role={user.role} />
      )}
    </Layout>
  );
}
function ComingSoon({ page, role }) {
  return (
    <GlassCard className="p-8">
      <p className="text-[15px] text-[#16301F]">
        No page yet for <span className="font-semibold">{page}</span> under the{" "}
        <span className="font-semibold">{role}</span> role.
      </p>
      <p className="mt-2 text-[13.5px] text-gray-500">
        Create a component, import it into App.jsx, then add it to the PAGES object.
      </p>
    </GlassCard>
  );
}