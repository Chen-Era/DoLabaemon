"use client";

import { useEffect, useRef } from "react";
import { AlertIcon } from "@/components/common/app-icons";
import { useLocale } from "@/components/common/locale-provider";

type ConfirmDialogProps = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "确认删除",
  cancelLabel = "取消",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { localize } = useLocale();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={localize("关闭对话框", "Close dialog")}
        className="absolute inset-0 cursor-default bg-slate-900/45"
        onClick={busy ? undefined : onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--danger-bg)] text-[var(--danger)]">
            <AlertIcon className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {description ? <p className="mt-1.5 text-sm leading-6 text-slate-500">{description}</p> : null}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelRef} type="button" className="button-secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className="button-danger" onClick={onConfirm} disabled={busy}>
            {busy ? localize("处理中...", "Working...") : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
