import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { LogOut } from "lucide-react";

/* Small confirmation popup.
   Example (logout):
     <ConfirmDialog
       open={confirmOpen}
       title="Are you sure you want to log out?"
       confirmLabel="Logout"
       onConfirm={() => { setConfirmOpen(false); onLogout(); }}
       onCancel={() => setConfirmOpen(false)}
     />
   Cancel is focused by default, so pressing Enter by accident does not log
   the user out. Esc or a click outside also cancels. */
export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div
          className="h-1.5 w-full"
          style={{ background: "linear-gradient(90deg, #8BC34A, #4CAF50, #2E7D32)" }}
        />
        <div className="flex flex-col items-center px-6 pb-5 pt-6 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#F4F7F3]">
            <LogOut className="h-5 w-5 text-[#2E7D32]" />
          </div>
          <h2 id="confirm-title" className="text-base font-semibold text-[#1B5E20]">
            {title}
          </h2>
          {message && <p className="mt-1.5 text-[13px] text-gray-500">{message}</p>}

          <div className="mt-5 flex w-full gap-2">
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-full border border-[#DCE7DC] py-2.5 text-[13px] font-semibold text-gray-700 hover:bg-[#F4F7F3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50]"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 rounded-full py-2.5 text-[13px] font-bold text-white hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2"
              style={{ background: "linear-gradient(90deg, #4CAF50, #2E7D32)" }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}