import { useState, useEffect, lazy, Suspense, Component } from "react";
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
import AdminRequirements from "./pages/AdminRequirements.jsx";
import AdminMatchings from "./pages/AdminMatchings.jsx";
import AdminNotifications from "./pages/AdminNotifications.jsx";
import AdminSettings from "./pages/AdminSettings.jsx";
import AdminProfile from "./pages/AdminProfile.jsx";
import BuyerDashboard from "./views/buyer/BuyerDashboard.jsx";
import MyDemands from "./views/buyer/MyDemands.jsx";
import AvailableSupply from "./views/buyer/AvailableSupply.jsx"; // old page, used only as a fallback
import BusinessRequests from "./views/farmer/BusinessRequests.jsx";
import BuyerMatches from "./views/buyer/BuyerMatches.jsx";
import Notifications from "./views/buyer/Notifications.jsx";
import Settings from "./views/buyer/Settings.jsx";
import Profile from "./views/buyer/Profile.jsx";
import UserDashboard from "./views/user/UserDashboard.jsx";
import ApplyFarmer from "./views/user/ApplyFarmer.jsx";
import ApplyBuyer from "./views/user/ApplyBuyer.jsx";
import FarmerDashboard from "./views/farmer/FarmerDashboard.jsx";
import FarmerMatches from "./views/farmer/FarmerMatches.jsx";
import FarmerSettings from "./views/farmer/Settings.jsx";
import FarmerProfile from "./views/farmer/FarmerProfile.jsx";
import { initAppearance } from "./utils/appearance.js";

// These pages are loaded only when opened. If one of them (or a file it imports)
// is missing or wrong, the app still starts and the page shows which file to fix,
// instead of a blank screen with "500 Internal Server Error".
const lazyFiles = import.meta.glob([
  "./pages/AdminSupplyApprovals.jsx",
  "./pages/AdminSupplyManagement.jsx",
  "./views/farmer/MySupply.jsx",
  "./views/farmer/OrderManagement.jsx",
  "./views/buyer/MyPreOrders.jsx",
]);
const lazyPage = (path) =>
  lazy(() =>
    lazyFiles[path]
      ? lazyFiles[path]()
      : Promise.reject(new Error(`The file ${path.replace("./", "src/")} does not exist.`))
  );
const AdminSupplyApprovals = lazyPage("./pages/AdminSupplyApprovals.jsx");
const AdminSupplyManagement = lazyPage("./pages/AdminSupplyManagement.jsx");
const MySupply = lazyPage("./views/farmer/MySupply.jsx");
const OrderManagement = lazyPage("./views/farmer/OrderManagement.jsx");
const MyPreOrders = lazyPage("./views/buyer/MyPreOrders.jsx");

class PageBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <GlassCard className="p-8">
        <p className="text-[15px] font-semibold text-red-700">This page could not be loaded.</p>
        <p className="mt-2 break-words text-[13.5px] text-gray-700">{String(this.state.error?.message || this.state.error)}</p>
        <p className="mt-3 text-[12.5px] text-gray-500">
          Check that the file named above exists in that folder, has the right name, and contains the correct code. Also read the
          terminal where you run <b>npm run dev</b>: it names the exact file.
        </p>
      </GlassCard>
    );
  }
}

initAppearance(); // apply the saved theme/language before the first screen

// These three files are loaded only if they exist, so a missing file
// can never crash the whole app with "Failed to resolve import".
const optionalPages = import.meta.glob(
  [
    "./views/buyer/FindSupply.jsx",
    "./views/buyer/MyRequests.jsx",
    "./views/farmer/IncomingRequests.jsx",
  ],
  { eager: true }
);

function MissingFile({ file }) {
  return (
    <GlassCard className="p-8">
      <p className="text-[15px] font-semibold text-[#16301F]">This page is not created yet.</p>
      <p className="mt-2 text-[13.5px] text-gray-600">
        Create the file <span className="font-semibold">{file}</span> and paste its code, then save.
      </p>
    </GlassCard>
  );
}

const FindSupply =
  optionalPages["./views/buyer/FindSupply.jsx"]?.default || AvailableSupply;
const MyRequests =
  optionalPages["./views/buyer/MyRequests.jsx"]?.default ||
  (() => <MissingFile file="src/views/buyer/MyRequests.jsx" />);
const IncomingRequests =
  optionalPages["./views/farmer/IncomingRequests.jsx"]?.default ||
  (() => <MissingFile file="src/views/farmer/IncomingRequests.jsx" />);

const BUYER_PAGES = {
  dashboard: BuyerDashboard,
  demands: MyDemands,
  available: FindSupply,
  matches: BuyerMatches,
  "my-requests": MyRequests,
  "my-preorders": MyPreOrders,
  notifications: Notifications,
  settings: Settings,
  profile: Profile,
};
const FARMER_PAGES = {
  dashboard: FarmerDashboard,
  supply: MySupply,
  "business-requests": BusinessRequests,
  matches: FarmerMatches,
  requests: IncomingRequests,
  orders: OrderManagement,
  notifications: Notifications,
  settings: FarmerSettings,
  profile: FarmerProfile,
};
// Only the `user` role can open the application pages.
const USER_PAGES = {
  dashboard: UserDashboard,
  "apply-farmer": ApplyFarmer,
  "apply-buyer": ApplyBuyer,
};
const ADMIN_PAGES = {
  dashboard: AdminDashboard,
  farmers: AdminFarmers,
  buyers: AdminBuyers,
  "supply-approvals": AdminSupplyApprovals,
  "supply-management": AdminSupplyManagement,
  requirements: AdminRequirements,
  matchings: AdminMatchings,
  notifications: AdminNotifications,
  settings: AdminSettings,
  profile: AdminProfile,
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
  // If the page does not exist for this role, fall back to that role's dashboard.
  const activePage = roleMenu[page] ? page : "dashboard";
  const PageComponent = roleMenu[activePage];

  const showPlus =
    user.role !== "admin" &&
    (activePage === "demands" || (activePage === "supply" && user.role === "farmer"));
  const plusLabel = activePage === "supply" ? "Add Supply" : "Create a Demand";
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
        <PageBoundary key={activePage}>
          <Suspense fallback={<p className="p-6 text-[13px] text-gray-500">Loading…</p>}>
            <PageComponent
              user={user}
              intent={pageMode}
              mode={pageMode}
              onNavigate={navigate}
              onRefreshUser={refreshUser}
              onLogout={handleLogout}
            />
          </Suspense>
        </PageBoundary>
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