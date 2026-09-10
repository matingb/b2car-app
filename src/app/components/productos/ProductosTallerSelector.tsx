"use client";

import React from "react";
import TallerSelector from "@/app/components/ui/TallerSelector";
import type { Taller } from "@/model/types";

type Props = {
  talleres?: Taller[];
  value: string;
  onChange: (tallerId: string) => void;
};

/**
 * @deprecated Utilizar `TallerSelector` directamente.
 */
export default function ProductosTallerSelector({ value, onChange }: Props) {
  return (
    <TallerSelector
      allOption="Vista general"
      value={value}
      onChange={onChange}
    />
  );
}
