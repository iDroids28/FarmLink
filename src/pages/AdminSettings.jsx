import { UserCheck, Link2, Megaphone } from "lucide-react";
import SettingsPage from "../components/SettingsPage.jsx";

/* ADMIN settings. Admins have no Privacy card. Edit this file to change only the admin Settings page. */
const CONFIG = {
  roleLabel: "Admin",
  privacy: false,
  notifications: [
    { key: "applications", icon: UserCheck, label: "New Applications", desc: "Get notified when a farmer or business submits an application." },
    { key: "matches", icon: Link2, label: "Match Activity", desc: "Get notified about new matches between farmers and buyers." },
    { key: "system", icon: Megaphone, label: "System Announcements", desc: "Receive important news and system updates." },
  ],
  faq: [
    { q: "How do I review an application?", a: "Open Farmers or Buyers from the menu, pick a pending application and approve or reject it. The user's role updates right away." },
    { q: "How do I change my password?", a: "Go to Account & Security above and click Change Password. Your other devices will be logged out for safety." },
    { q: "I forgot my password.", a: "Log out, choose Forgot Password on the login page and follow the steps to get a code and set a new password." },
  ],
};

export default function AdminSettings({ user, onRefreshUser, onLogout }) {
  return <SettingsPage config={CONFIG} user={user} onRefreshUser={onRefreshUser} onLogout={onLogout} />;
}