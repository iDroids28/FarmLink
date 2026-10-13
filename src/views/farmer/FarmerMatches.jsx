import { useEffect, useState } from "react";
import MatchesTable from "../../components/MatchesTable.jsx";
import MatchDetailsModal from "../../components/MatchDetailsModal.jsx";
import { LoadNote } from "../../components/DemoBits.jsx";
import { Notice } from "../../components/FormBits.jsx";
import useMatchViewModel from "../../viewmodels/useMatchViewModel";

export default function FarmerMatches() {
  const vm = useMatchViewModel();
  const { load } = vm;
  const [detailId, setDetailId] = useState(null);
  const selected = vm.matches.find((m) => m.id === detailId) || null;

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <LoadNote loading={vm.loading && vm.matches.length === 0} error="" />
      <Notice type="error">{vm.error}</Notice>
      <Notice type="success">{vm.success}</Notice>
      <MatchesTable
        rows={vm.matches}
        dateKey="neededDate"
        dateLabel="Needed By"
        subtitle="Buyer requests matched with your supply. Open View Details to review the business and the request before you confirm or decline."
        onViewDetails={setDetailId}
      />

      {detailId && (
        <MatchDetailsModal
          matchId={detailId}
          row={selected}
          busy={vm.submitting}
          error={vm.error}
          success={vm.success}
          onConfirm={vm.confirm}
          onDecline={vm.decline}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}
