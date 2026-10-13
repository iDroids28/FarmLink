import { Settings as SettingsIcon } from "lucide-react";
import EmptyState from "../../components/EmptyState.jsx";

export default function Settings() {
  return (
    <div className="space-y-6">
      <h2 className="text-[20px] font-semibold text-[#16301F]">Settings</h2>
      <EmptyState
        icon={SettingsIcon}
        title="Settings"
        message="Account settings will go here."
      />
    </div>
  );
}