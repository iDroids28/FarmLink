import { useState } from "react";
import { Leaf, Lock, ShieldCheck, User } from "lucide-react";
import {
  EditableSection,
  InfoRow,
  MediaCircle,
  OutlineButton,
  PasswordForm,
  PhotoBlock,
  ProfileCard,
  ProfileShell,
  StatusPill,
  formatDate,
  useProfile,
} from "../../components/ProfileParts.jsx";

export default function FarmerProfile({ onRefreshUser }) {
  const state = useProfile();
  const { data, save } = state;
  const [showPassword, setShowPassword] = useState(false);

  if (!data) {
    return (
      <ProfileShell
        title="Profile"
        subtitle="Manage your account information and farm details."
        icon={Leaf}
        state={state}
      />
    );
  }

  const { user, profile, account } = data;

  return (
    <ProfileShell
      title="Profile"
      subtitle="Manage your account information and farm details."
      icon={Leaf}
      state={state}
    >
      <EditableSection
        icon={User}
        title="Personal Information"
        editLabel="Edit Profile"
        media={<PhotoBlock photo={profile.photo} onChange={(photo) => save({ photo })} />}
        fields={[
          { key: "name", label: "Full Name" },
          { key: "farmName", label: "Farm Name", placeholder: "Your farm name (optional)" },
          { key: "email", label: "Email Address", readOnly: true },
          { key: "address", label: "Address" },
        ]}
        values={{ name: user.name, farmName: profile.farm?.name || "", email: user.email, address: profile.address }}
        onSave={async (d) => {
          await save({
            name: d.name,
            address: d.address,
            farm: { ...(profile.farm || {}), name: d.farmName },
          });
          onRefreshUser?.();
        }}
      />

      <ProfileCard
        icon={ShieldCheck}
        title="Account and Role Information"
        media={<MediaCircle icon={ShieldCheck} />}
        action={
          <OutlineButton icon={Lock} onClick={() => setShowPassword((s) => !s)}>
            {showPassword ? "Hide" : "Change Password"}
          </OutlineButton>
        }
      >
        <InfoRow label="Account ID">{account.accountId}</InfoRow>
        <InfoRow label="Role">Farmer</InfoRow>
        <InfoRow label="Account Type">{account.accountType}</InfoRow>
        <InfoRow label="Account Created">{formatDate(account.createdAt)}</InfoRow>
        <InfoRow label="Status">
          <StatusPill tone={account.status === "Active" ? "green" : "amber"}>{account.status}</StatusPill>
        </InfoRow>
        {showPassword && (
          <div className="mt-4 max-w-sm border-t border-gray-100 pt-4">
            <PasswordForm onDone={() => setShowPassword(false)} />
          </div>
        )}
      </ProfileCard>
    </ProfileShell>
  );
}