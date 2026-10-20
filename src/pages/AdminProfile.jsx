import {
  CheckCircle2,
  KeyRound,
  Settings,
  ShieldCheck,
  User,
} from "lucide-react";
import GlassCard from "../components/GlassCard.jsx";
import {
  EditableSection,
  GREEN,
  InfoRow,
  PasswordForm,
  PhotoBlock,
  ProfileShell,
  StatusPill,
  formatDate,
  useProfile,
} from "../components/ProfileParts.jsx";

const PERMISSIONS = [
  { title: "User Management", text: "Add, edit, and manage user accounts" },
  { title: "Farmer / Seller Approval", text: "Review and approve farmer applications" },
  { title: "Supply & Request Management", text: "Monitor supply, demand, and matching" },
  { title: "Reports & Analytics", text: "View system reports and data insights" },
  { title: "System Settings", text: "Configure system preferences" },
];

function Panel({ icon: Icon, title, subtitle, children }) {
  return (
    <GlassCard className="p-5">
      <h3 className="flex items-center gap-2 text-[16px] font-semibold" style={{ color: GREEN }}>
        <Icon size={19} />
        {title}
      </h3>
      {subtitle && <p className="mb-3 ml-7 text-[12.5px] text-gray-500">{subtitle}</p>}
      <div className={subtitle ? "" : "mt-3"}>{children}</div>
    </GlassCard>
  );
}

export default function AdminProfile({ onRefreshUser }) {
  const state = useProfile();
  const { data, save } = state;

  if (!data) {
    return (
      <ProfileShell
        title="Admin Profile"
        subtitle="Manage your account information and system access."
        icon={ShieldCheck}
        state={state}
      />
    );
  }

  const { user, profile, account } = data;

  return (
    <ProfileShell
      title="Admin Profile"
      subtitle="Manage your account information and system access."
      icon={ShieldCheck}
      state={state}
    >
      <EditableSection
        icon={User}
        title="Personal Information"
        editLabel="Edit Profile"
        media={<PhotoBlock photo={profile.photo} onChange={(photo) => save({ photo })} />}
        fields={[
          { key: "name", label: "Full Name" },
          { key: "email", label: "Email Address", readOnly: true },
          { key: "address", label: "Address" },
        ]}
        values={{ name: user.name, email: user.email, address: profile.address }}
        onSave={async (d) => {
          await save({ name: d.name, address: d.address });
          onRefreshUser?.();
        }}
      />

      <GlassCard className="p-5">
        <h3 className="mb-3 flex items-center gap-2 text-[16.5px] font-semibold" style={{ color: GREEN }}>
          <ShieldCheck size={19} />
          Account & Role Information
        </h3>
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div>
            <InfoRow label="Account ID">{account.accountId}</InfoRow>
            <InfoRow label="Role">Administrator</InfoRow>
            <InfoRow label="Account Created">{formatDate(account.createdAt)}</InfoRow>
            <InfoRow label="Status">
              <StatusPill tone={account.status === "Active" ? "green" : "amber"}>{account.status}</StatusPill>
            </InfoRow>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-[#E3F2E9] p-4">
            <ShieldCheck size={30} className="shrink-0" style={{ color: GREEN }} />
            <div>
              <p className="text-[14.5px] font-semibold text-[#0F3D2E]">Admin Access</p>
              <p className="mt-1 text-[13px] text-gray-600">You have full access to all system features and settings.</p>
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel icon={Settings} title="System Access & Permissions">
          <ul className="space-y-3">
            {PERMISSIONS.map((p) => (
              <li key={p.title} className="flex items-start gap-2.5">
                <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[#2E9E5B]" />
                <div>
                  <p className="text-[14px] font-medium text-[#16301F]">{p.title}</p>
                  <p className="text-[12.5px] text-gray-500">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel icon={KeyRound} title="Change Password" subtitle="Keep your account secure.">
          <PasswordForm />
        </Panel>
      </div>
    </ProfileShell>
  );
}