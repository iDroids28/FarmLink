import { useEffect, useState } from "react";
import { Bell, Building2, Lock, Save, ShieldCheck, User } from "lucide-react";
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
  Toggle,
  formatDate,
  useProfile,
} from "../../components/ProfileParts.jsx";

export default function Profile({ onRefreshUser }) {
  const state = useProfile();
  const { data, save } = state;

  const [prefs, setPrefs] = useState(null);
  const [prefsBusy, setPrefsBusy] = useState(false);
  const [prefsMsg, setPrefsMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (data) setPrefs(data.profile.notificationPrefs);
  }, [data]);

  if (!data) {
    return <ProfileShell title="Profile" subtitle="Manage your account information and preferences." state={state} />;
  }

  const { user, profile, account } = data;

  async function savePrefs() {
    setPrefsBusy(true);
    setPrefsMsg("");
    try {
      await save({ notificationPrefs: prefs });
      setPrefsMsg("Preferences saved.");
    } catch (err) {
      setPrefsMsg(err?.message || "Could not save your preferences.");
    } finally {
      setPrefsBusy(false);
    }
  }

  return (
    <ProfileShell title="Profile" subtitle="Manage your account information and preferences." state={state}>
      <EditableSection
        icon={User}
        title="Personal Information"
        editLabel="Edit Profile"
        media={<PhotoBlock photo={profile.photo} onChange={(photo) => save({ photo })} />}
        fields={[
          { key: "name", label: "Full Name" },
          { key: "email", label: "Email Address", readOnly: true },
          { key: "phone", label: "Contact Number", type: "tel", placeholder: "0917 123 4567" },
          { key: "address", label: "Address" },
        ]}
        values={{ name: user.name, email: user.email, phone: profile.phone, address: profile.address }}
        onSave={async (d) => {
          await save({ name: d.name, phone: d.phone, address: d.address });
          onRefreshUser?.();
        }}
      />

      <EditableSection
        icon={Building2}
        title="Business / Organization Information"
        media={<MediaCircle icon={Building2} />}
        fields={[
          { key: "name", label: "Business Name" },
          { key: "orgType", label: "Organization Type", placeholder: "Restaurant / Food Business" },
          { key: "address", label: "Business Address" },
          { key: "contactPerson", label: "Contact Person" },
        ]}
        values={profile.business}
        onSave={(d) => save({ business: d })}
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
        <InfoRow label="Role">Buyer</InfoRow>
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

      <ProfileCard icon={Bell} title="Notification Preferences" media={<MediaCircle icon={Bell} />}>
        {prefs && (
          <>
            <Toggle
              label="Email Notifications"
              description="Receive updates about your requests and matches."
              checked={prefs.email}
              onChange={(v) => setPrefs((p) => ({ ...p, email: v }))}
            />
            <Toggle
              label="Request Match Notifications"
              description="Get notified when your request is matched with a farmer."
              checked={prefs.requestMatch}
              onChange={(v) => setPrefs((p) => ({ ...p, requestMatch: v }))}
            />
            <Toggle
              label="Pre-order Updates"
              description="Receive updates on pre-order and harvest schedules."
              checked={prefs.preorder}
              onChange={(v) => setPrefs((p) => ({ ...p, preorder: v }))}
            />
            <Toggle
              label="Marketing & Announcements"
              description="Get the latest news and updates from FarmLink."
              checked={prefs.marketing}
              onChange={(v) => setPrefs((p) => ({ ...p, marketing: v }))}
            />
            <div className="mt-3 flex items-center justify-end gap-3">
              {prefsMsg && <span className="text-[13px] text-gray-600">{prefsMsg}</span>}
              <OutlineButton icon={Save} onClick={savePrefs} disabled={prefsBusy}>
                {prefsBusy ? "Saving…" : "Save Changes"}
              </OutlineButton>
            </div>
          </>
        )}
      </ProfileCard>
    </ProfileShell>
  );
}