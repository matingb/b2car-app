"use client";

import type { RemitoClase } from "@/lib/remitos/types";
import Dropdown from "@/app/components/ui/Dropdown";

type Props = {
  value: RemitoClase | null;
  onChange: (clase: RemitoClase) => void;
};

const CLASES: RemitoClase[] = ["R", "X"];
const OPTIONS = CLASES.map((clase) => ({
  value: clase,
  label: `Remito ${clase}`,
  selectedLabel: `Remito ${clase}`,
}));

/** Selector libre de R o X, sin sugerencias ni información de numeración previa. */
export default function RemitoTipoSelector({ value, onChange }: Props) {
  return (
    <Dropdown
      id="remito-tipo"
      ariaLabel="Tipo de remito"
      placeholder="Seleccioná un tipo"
      value={value ?? ""}
      options={OPTIONS}
      onChange={(selected) => {
        const clase = CLASES.find((candidate) => candidate === selected);
        if (clase) onChange(clase);
      }}
      style={styles.dropdown}
      dataTestId="remito-tipo"
    />
  );
}

const styles = {
  dropdown: { width: "100%", height: 42, fontSize: 14 },
} as const;
