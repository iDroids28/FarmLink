import { Send } from "lucide-react";
import EmptyState from "../../components/EmptyState.jsx";

export default function BuyerRequests() {
  return (
    <div className="space-y-6">
      <h2 className="text-[20px] font-semibold text-[#16301F]">My Request</h2>
      <EmptyState
        icon={Send}
        title="No requests yet"
        message="Your supply requests will show up here."
      />
    </div>
  );
}