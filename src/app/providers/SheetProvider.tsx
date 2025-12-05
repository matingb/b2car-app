"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type SheetContextValue = {
  openSheet: (options: {
    title?: string;
    description?: string;
    content: React.ReactNode;
    side?: "top" | "right" | "bottom" | "left";
  }) => void;
  closeSheet: () => void;
};

const SheetContext = createContext<SheetContextValue | null>(null);

export const useSheet = () => {
  const ctx = useContext(SheetContext);
  if (!ctx) {
    throw new Error("useSheet debe usarse dentro de SheetProvider");
  }
  return ctx;
};

export function SheetProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<React.ReactNode>(null);
  const [title, setTitle] = useState<string | undefined>();
  const [description, setDescription] = useState<string | undefined>();
  const [side, setSide] = useState<"top" | "right" | "bottom" | "left">(
    "left"
  );

  const value = useMemo<SheetContextValue>(
    () => ({
      openSheet: ({ title, description, content, side = "left" }) => {
        setTitle(title);
        setDescription(description);
        setContent(content);
        setSide(side);
        setOpen(true);
      },
      closeSheet: () => setOpen(false),
    }),
    []
  );

  return (
    <SheetContext.Provider value={value}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side={side}>
          <SheetHeader>
            {(!title) && (<SheetTitle>{''}</SheetTitle> )}
            {(title) && (<SheetTitle>{title}</SheetTitle> )}
            {(description) && (<SheetDescription>{description}</SheetDescription>)}
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
      {children}
    </SheetContext.Provider>
  );
}
