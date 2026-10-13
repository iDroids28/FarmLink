import { useEffect } from "react";
import MatchesTable from "../../components/MatchesTable.jsx";
import { LoadNote } from "../../components/DemoBits.jsx";
import { Notice } from "../../components/FormBits.jsx";
import useMatchViewModel from "../../viewmodels/useMatchViewModel";

// Read-only: buyers never confirm or decline (no handlers are passed to the table).
export default function BuyerMatches() {
  const vm = useMatchViewModel();
  const { load } = vm;

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <LoadNote loading={vm.loading && vm.matches.length === 0} error="" />
      <Notice type="error">{vm.error}</Notice>
      <MatchesTable
        rows={vm.matches}
        dateKey="availabilityDate"
        dateLabel="Available From"
        subtitle="Your requirements matched with farmers' supply. Farmers confirm each match."
      />
    </div>
  );
}