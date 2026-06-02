"use client";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmDialog({
  open, title, message, confirmLabel = "確定", cancelLabel = "取消",
  onConfirm, onCancel, danger = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-8">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      {/* Dialog */}
      <div className="relative w-full max-w-sm bg-white rounded-ds-xl p-5 space-y-4" style={{ boxShadow: "0 8px 32px rgba(30,35,64,0.16)" }}>
        <div>
          <p className="font-semibold text-[#1A1D2E] text-[17px]">{title}</p>
          <p className="text-[#8A90B0] text-[15px] mt-1">{message}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onCancel}
            className="py-3 rounded-full border border-[#E8E9F3] text-[#8A90B0] font-semibold text-[15px]">
            {cancelLabel}
          </button>
          <button onClick={onConfirm}
            className={`py-3 rounded-full font-semibold text-[15px] text-white ${danger ? "bg-[#FF4B6E]" : "bg-[#2c698d]"}`}
            style={{ boxShadow: danger ? "0 4px 12px rgba(255,75,110,0.3)" : "0 4px 12px #e3f6f5" }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
