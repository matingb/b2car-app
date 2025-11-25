"use client";

import * as Toast from "@radix-ui/react-toast";
import React, {
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { COLOR } from "@/theme/theme";

export type AppToast = {
  kind: "success" | "error" | "info";
  title: string;
  description?: string;
  durationMs?: number;
};

type ToastContextValue = {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de ToastProvider");
  }
  return ctx;
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [openIds, setOpenIds] = useState<number[]>([]);
  const [items, setItems] = useState<(AppToast & { id: number })[]>([]);
  const idRef = useRef(0);

  const close = useCallback((id: number) => {
    setOpenIds((prev) => prev.filter((x) => x !== id));
    window.setTimeout(
      () => setItems((prev) => prev.filter((i) => i.id !== id)),
      200
    );
  }, []);

  const pushToast = useCallback(
    (toast: AppToast) => {
      idRef.current += 1;
      const id = idRef.current;
      const duration = toast.durationMs ?? 3500;
      const nextItem = { ...toast, id };

      setItems((prev) => [...prev, nextItem]);
      setOpenIds((prev) => [...prev, id]);
      window.setTimeout(() => close(id), duration);
    },
    [close]
  );

  const value = useMemo(
    () => ({
      success: (title: string, description?: string) =>
        pushToast({ kind: "success", title, description }),
      error: (title: string, description?: string) =>
        pushToast({ kind: "error", title, description, durationMs: 5000 }),
      info: (title: string, description?: string) =>
        pushToast({ kind: "info", title, description }),
    }),
    [pushToast]
  );

  const styleByKind: Record<string, React.CSSProperties> = useMemo(
    () => ({
      success: { borderLeft: `4px solid ${COLOR.ACCENT.PRIMARY}` },
      error: { borderLeft: `4px solid ${COLOR.ICON.DANGER}` },
      info: { borderLeft: `4px solid ${COLOR.BORDER.WEAK}` },
    }),
    []
  );

  return (
    <ToastContext.Provider value={value}>
      <Toast.Provider swipeDirection="right">
        <div style={styles.viewportWrap}>
          <Toast.Viewport style={styles.viewport} />
        </div>

        {items.map((t) => (
          <Toast.Root
            key={t.id}
            open={openIds.includes(t.id)}
            onOpenChange={(o) => !o && close(t.id)}
            style={{ ...styles.toast, ...styleByKind[t.kind] }}
          >
            <Toast.Title style={styles.title}>{t.title}</Toast.Title>
            {t.description ? (
              <Toast.Description style={styles.description}>
                {t.description}
              </Toast.Description>
            ) : null}
          </Toast.Root>
        ))}

        {children}
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

const styles = {
  viewportWrap: {
    position: "fixed" as const,
    top: 16,
    right: 16,
    zIndex: 60,
  },
  viewport: {
    position: "fixed" as const,
    top: 16,
    right: 16,
    width: 360,
    maxWidth: "calc(100vw - 32px)",
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    outline: "none",
  },
  toast: {
    background: COLOR.BACKGROUND.SECONDARY,
    borderRadius: 10,
    padding: "10px 12px",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
  },
  title: {
    fontWeight: 600,
  },
  description: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
  },
} as const;


