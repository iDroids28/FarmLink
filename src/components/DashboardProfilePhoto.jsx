import { UserRound } from "lucide-react";
import { useProfile } from "./ProfileParts.jsx";

function firstPhoto(...values) {
  return values.find((value) => typeof value === "string" && value.trim()) || "";
}

export default function DashboardProfilePhoto({ user }) {
  const profileState = useProfile();
  const data = profileState.data;
  const photo = firstPhoto(
    data?.photo,
    data?.profilePhoto,
    data?.profilePicture,
    data?.photoUrl,
    data?.avatar,
    data?.profile?.photo,
    data?.profile?.profilePhoto,
    data?.profile?.profilePicture,
    data?.user?.photo,
    data?.user?.profilePhoto,
    data?.data?.photo,
    data?.data?.profilePhoto,
    data?.data?.profile?.photo,
    user?.photo,
    user?.profilePhoto,
    user?.profilePicture,
    user?.avatar,
  );

  if (photo) {
    return (
      <img
        src={photo}
        alt={`${user?.name || "Your"} profile`}
        className="h-full w-full rounded-[30px] object-cover"
      />
    );
  }

  return <UserRound size={58} strokeWidth={1.6} className="text-[#32833A]" aria-label="Profile photo not set" />;
}
