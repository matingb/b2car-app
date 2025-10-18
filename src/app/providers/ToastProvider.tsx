"use client";

import * as Toast from "@radix-ui/react-toast";
import React, { useEffect, useMemo, useState } from "react";
import { COLOR } from "@/theme/theme";

export type AppToast = {
  kind: "success" | "error" | "info";
  title: string;
  description?: string;
  durationMs?: number;
};

type Listener = (t: AppToast) => void;
const listeners = new Set<Listener>();

export function emitToast(toast: AppToast) {
  listeners.forEach((l) => l(toast));
}

export default function ToastProvider() {
  const [openIds, setOpenIds] = useState<number[]>([]);
  const [items, setItems] = useState<(AppToast & { id: number })[]>([]);
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    const listener: Listener = (t) => {
      setCounter((c) => c + 1);
      const id = counter + 1;
      const it = { ...t, id };
      setItems((prev) => [...prev, it]);
      setOpenIds((prev) => [...prev, id]);
      const duration = t.durationMs ?? 3500;
      window.setTimeout(() => close(id), duration);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [counter]);

  const close = (id: number) => {
    setOpenIds((prev) => prev.filter((x) => x !== id));
    window.setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 200);
  };

  const styleByKind: Record<string, React.CSSProperties> = useMemo(
    () => ({
      success: { borderLeft: `4px solid ${COLOR.ACCENT.PRIMARY}` },
      error: { borderLeft: `4px solid ${COLOR.ICON.DANGER}` },
      info: { borderLeft: `4px solid ${COLOR.BORDER.WEAK}` },
    }),
    []
  );

  return (
    <Toast.Provider swipeDirection="right">
      <div style={styles.viewportWrap}>
        <Toast.Viewport style={styles.viewport} />
      </div>

      {items.map((t) => (
        <Toast.Root key={t.id} open={openIds.includes(t.id)} onOpenChange={(o) => !o && close(t.id)} style={{ ...styles.toast, ...styleByKind[t.kind] }}>
          <Toast.Title style={styles.title}>{t.title}</Toast.Title>
          {t.description ? <Toast.Description style={styles.description}>{t.description}</Toast.Description> : null}
        </Toast.Root>
      ))}
    </Toast.Provider>
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


