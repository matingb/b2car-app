"use client";

import { emitToast } from "@/app/providers/ToastProvider";

export function useAppToast() {
  return {
    success: (title: string, description?: string) =>
      emitToast({ kind: "success", title, description }),
    error: (title: string, description?: string) =>
      emitToast({ kind: "error", title, description, durationMs: 5000 }),
    info: (title: string, description?: string) =>
      emitToast({ kind: "info", title, description }),
  } as const;
}


