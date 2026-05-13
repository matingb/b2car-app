"use client";

import React, { createContext, useContext } from "react";

type Kind = "servicios" | "repuestos";
type Mode = "add" | "edit";
type Validation = { ok: true } | { ok: false; message?: string | null };

export type InlineEditorContextValue = {
  kind: Kind;
  mode: Mode;
  submitting: boolean;
  interactionEnabled: boolean;
  validation: Validation;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

const InlineEditorContext = createContext<InlineEditorContextValue | null>(null);

export function useInlineEditorContext(): InlineEditorContextValue {
  const ctx = useContext(InlineEditorContext);
  if (!ctx) {
    throw new Error("useInlineEditorContext must be used inside <InlineEditorProvider>");
  }
  return ctx;
}

type ProviderProps = InlineEditorContextValue & { children: React.ReactNode };

export function InlineEditorProvider({ children, ...value }: ProviderProps) {
  return <InlineEditorContext.Provider value={value}>{children}</InlineEditorContext.Provider>;
}
