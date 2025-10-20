"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import ModalMessage from "@/app/components/ui/ModalMessage";

type ModalOptions = {
  title?: string;
  message?: React.ReactNode;
  acceptLabel?: string;
  cancelLabel?: string;
  oneButton?: boolean;
};

type Resolver = ((value?: unknown) => void) | null;

type ModalContextType = {
  alert: (opts: ModalOptions) => Promise<void>;
  confirm: (opts: ModalOptions) => Promise<boolean>;
  isOpen: boolean;
};

const ModalMessageContext = createContext<ModalContextType | undefined>(undefined);

export function ModalMessageProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ModalOptions>({});
  const resolverRef = useRef<Resolver>(null);

  const close = useCallback(() => setOpen(false), []);

  const alert = useCallback((opts: ModalOptions) => {
    return new Promise<void>((resolve) => {
      resolverRef.current = () => resolve();
      setOptions({ ...opts, oneButton: true, acceptLabel: opts.acceptLabel || "Aceptar" });
      setOpen(true);
    });
  }, []);

  const confirm = useCallback((opts: ModalOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = (value?: unknown) => resolve(Boolean(value));
      setOptions({ ...opts, oneButton: false, acceptLabel: opts.acceptLabel || "Aceptar", cancelLabel: opts.cancelLabel || "Cancelar" });
      setOpen(true);
    });
  }, []);

  const onAccept = useCallback(() => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    close();
    resolver?.(true);
  }, [close]);

  const onCancel = useCallback(() => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    close();
    resolver?.(false);
  }, [close]);

  const value = useMemo<ModalContextType>(() => ({ alert, confirm, isOpen: open }), [alert, confirm, open]);

  return (
    <ModalMessageContext.Provider value={value}>
      {children}
      <ModalMessage
        open={open}
        title={options.title}
        message={options.message}
        oneButton={options.oneButton}
        acceptLabel={options.acceptLabel}
        cancelLabel={options.cancelLabel}
        onAccept={onAccept}
        onCancel={onCancel}
      />
    </ModalMessageContext.Provider>
  );
}

export function useModalMessage() {
  const ctx = useContext(ModalMessageContext);
  if (!ctx) throw new Error("useModalMessage debe usarse dentro de ModalMessageProvider");
  return ctx;
}
