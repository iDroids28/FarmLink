import { inputCls } from "./DemoBits.jsx";

/* Dagupan City location picker. The city is fixed (Dagupan City, Pangasinan);
   the user only chooses the barangay. The saved text looks like:
   "Bacayao Norte, Dagupan City, Pangasinan" */

export const CITY = "Dagupan City, Pangasinan";

export const BARANGAYS = [
  "Bacayao Norte", "Bacayao Sur", "Barangay I", "Barangay II", "Barangay IV",
  "Bolosan", "Bonuan Binloc", "Bonuan Boquig", "Bonuan Gueset", "Calmay",
  "Carael", "Caranglaan", "Herrero", "Lasip Chico", "Lasip Grande",
  "Lomboy", "Lucao", "Malued", "Mamalingling", "Mangin",
  "Mayombo", "Pantal", "Poblacion Oeste", "Pogo Chico", "Pogo Grande",
  "Pugaro Suit", "Salapingao", "Salisay", "Tambac", "Tapuac", "Tebeng",
];

export const buildLocation = (barangay) => (barangay ? `${barangay}, ${CITY}` : "");

// Reads the barangay back out of a saved location ("" if it is not one of the list).
export function barangayOf(location) {
  const first = String(location || "").split(",")[0].trim().toLowerCase();
  return BARANGAYS.find((b) => b.toLowerCase() === first) || "";
}

export default function LocationPicker({ value, onChange, invalid = false }) {
  const border = invalid ? " !border-red-400" : "";
  return (
    <div className="space-y-2">
      <input
        value={CITY}
        readOnly
        tabIndex={-1}
        aria-label="City"
        className={inputCls + " cursor-not-allowed bg-gray-50 text-gray-600"}
      />
      <select
        value={barangayOf(value)}
        onChange={(e) => onChange(buildLocation(e.target.value))}
        aria-label="Barangay"
        className={inputCls + border}
      >
        <option value="">Select barangay</option>
        {BARANGAYS.map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>
    </div>
  );
}