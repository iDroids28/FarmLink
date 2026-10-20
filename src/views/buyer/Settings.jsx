import { Handshake, ClipboardList, Package, UserCheck, Megaphone } from "lucide-react";
import SettingsPage from "../../components/SettingsPage.jsx";

/* BUYER settings. Edit this file to change only the buyer's Settings page. */
const CONFIG = {
  roleLabel: "Buyer",
  privacy: true,
  activityText: "Allow others to see your activity (e.g., requirements).",
  notifications: [
    { key: "match", icon: Handshake, label: "Match Updates", desc: "Get notified when there are new matches or updates to your matches." },
    { key: "requirement", icon: ClipboardList, label: "Requirement Updates", desc: "Get notified about changes to your requirements." },
    { key: "supply", icon: Package, label: "Supply Updates", desc: "Get notified when farmers post new supply." },
    { key: "application", icon: UserCheck, label: "Application Status", desc: "Get notified about your business application status and admin messages." },
    { key: "system", icon: Megaphone, label: "System Announcements", desc: "Receive important news and system updates." },
  ],
  faq: [
    { q: "How do I post a requirement?", a: "Open My Requirements and click the + button (or Request Product on the dashboard), then fill in the product, quantity, location and date needed." },
    { q: "How does matching work?", a: "When a farmer's supply fits your requirement, FarmLink suggests a match. The farmer confirms it, and you can follow the progress on the Matches page." },
    { q: "How do I change my password?", a: "Go to Account & Security above and click Change Password. Your other devices will be logged out for safety." },
    { q: "I forgot my password.", a: "Log out, choose Forgot Password on the login page and follow the steps to get a code and set a new password." },
  ],
};

export default function BuyerSettings({ user, onRefreshUser, onLogout }) {
  return <SettingsPage config={CONFIG} user={user} onRefreshUser={onRefreshUser} onLogout={onLogout} />;
}