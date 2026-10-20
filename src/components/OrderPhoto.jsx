import { useEffect, useState } from "react";
import { Sprout } from "lucide-react";
import { orderPhotoApi } from "../api/orderPhotoApi.js";

// Loads the farmer's photo of an order from the database (only when the order has one).
export function useOrderPhoto(orderId, enabled) {
  const [image, setImage] = useState("");

  useEffect(() => {
    let alive = true;
    setImage("");
    if (enabled) {
      orderPhotoApi
        .get(orderId)
        .then((d) => { if (alive) setImage(d?.image || ""); })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [orderId, enabled]);

  return image;
}

/* Photo at the left of an order: the farmer's photo of the products when there is one
   (green ring), otherwise the product's listing photo. */
export function OrderThumb({ orderId, hasPhoto, fallback, alt, tip = "Photo from the farmer" }) {
  const photo = useOrderPhoto(orderId, hasPhoto);
  const [failed, setFailed] = useState(false);
  const src = photo || fallback;

  return (
    <span
      className={"flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#E8F5E9] text-[#2E7D32] " + (photo ? "ring-2 ring-green-500" : "")}
      title={photo ? tip : undefined}
    >
      {src && !failed ? (
        <img src={src} alt={alt} onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <Sprout size={22} />
      )}
    </span>
  );
}