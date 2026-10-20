import { Handshake, Package, Store, UserCheck, Megaphone } from "lucide-react";
import SettingsPage from "../../components/SettingsPage.jsx";

/* FARMER settings. Edit this file to change only the farmer's Settings page. */
const CONFIG = {
  roleLabel: "Farmer",
  privacy: true,
  activityText: "Allow others to see your activity (e.g., supply posts).",
  notifications: [
    { key: "match", icon: Handshake, label: "Match Requests", desc: "Get notified when a buyer is matched with your supply." },
    { key: "supply", icon: Package, label: "Supply Updates", desc: "Get notified about changes to the supply you posted." },
    { key: "businessRequests", icon: Store, label: "Business Requests", desc: "Get notified when a business needs a product you grow." },
    { key: "application", icon: UserCheck, label: "Application Status", desc: "Get notified about your farmer application status and admin messages." },
    { key: "system", icon: Megaphone, label: "System Announcements", desc: "Receive important news and system updates." },
  ],
  faq: [
    { q: "How do I post my supply?", a: "Open My Supply and click the + button (or Post Supply on the dashboard), then enter the product, quantity and whether it is on-hand or expected." },
    { q: "How do I answer a match request?", a: "Open Matches. Requests waiting for you are marked as pending; confirm or decline each one there." },
    { q: "How do I change my password?", a: "Go to Account & Security above and click Change Password. Your other devices will be logged out for safety." },
    { q: "I forgot my password.", a: "Log out, choose Forgot Password on the login page and follow the steps to get a code and set a new password." },
  ],
};

export default function FarmerSettings({ user, onRefreshUser, onLogout }) {
  return <SettingsPage config={CONFIG} user={user} onRefreshUser={onRefreshUser} onLogout={onLogout} />;
}