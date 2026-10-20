import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { firstName } from "./FormBits.jsx";
import { useProfile } from "./ProfileParts.jsx";

/** Shared welcome row for Farmer and Buyer dashboards. Uses the photo saved in Profile. */
export default function DashboardWelcome({ user }) {
  const { data } = useProfile();
  const photo = data?.profile?.photo || "";
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    setPhotoFailed(false);
  }, [photo]);

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#E3F2E9] shadow-sm">
        {photo && !photoFailed ? (
          <img
            src={photo}
            alt={`${firstName(user)} profile`}
            onError={() => setPhotoFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <UserRound size={25} className="text-[#2E7D32]" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0">
        <h2 className="text-[24px] font-semibold text-[#16301F]">Welcome back, {firstName(user)}</h2>
        <p className="text-[15px] text-gray-600">What would you like to do today?</p>
      </div>
    </div>
  );
}
