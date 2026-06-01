"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={cn(
          "relative bg-white rounded-t-3xl w-full max-w-md mx-auto",
          "max-h-[90vh] overflow-y-auto"
        )}
      >
        <div className="sticky top-0 bg-white pt-4 pb-2 px-4 flex items-center justify-between border-b border-gray-100">
          <div className="w-10 h-1 bg-gray-300 rounded-full absolute left-1/2 -translate-x-1/2 top-2" />
          {title && <h2 className="font-semibold text-gray-900 mt-2">{title}</h2>}
          <button onClick={onClose} className="ml-auto mt-1 p-1 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4 pb-safe">{children}</div>
      </div>
    </div>
  );
}
