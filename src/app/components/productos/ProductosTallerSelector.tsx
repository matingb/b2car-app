"use client";

import React from "react";
import Dropdown from "@/app/components/ui/Dropdown";
import type { Taller } from "@/model/types";

type Props = {
  talleres: Taller[];
  value: string;
  onChange: (tallerId: string) => void;
};

export default function ProductosTallerSelector({ talleres, value, onChange }: Props) {
  return (
    <Dropdown
      style={styles.dropdown}
      options={[
        { value: "", label: "Vista general" },
        ...talleres.map((taller) => ({ value: taller.id, label: taller.nombre })),
      ]}
      value={value}
      onChange={onChange}
    />
  );
}

const styles = {
  dropdown: {
    position: "relative" as const,
    height: "35px",
    width: "190px",
  },
} as const;
