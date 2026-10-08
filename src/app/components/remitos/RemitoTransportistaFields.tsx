"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Truck } from "lucide-react";
import { COLOR } from "@/theme/theme";
import { remitoFormStyles as styles } from "./remitoFormStyles";

export type TransportistaForm = {
  nombre: string;
  domicilio: string;
  cuit: string;
};

export const TRANSPORTISTA_VACIO: TransportistaForm = { nombre: "", domicilio: "", cuit: "" };

/** `null` cuando no se cargó ningún dato del transportista. */
export function transportistaPayload(form: TransportistaForm) {
  const nombre = form.nombre.trim();
  const domicilio = form.domicilio.trim();
  const cuit = form.cuit.replace(/\D/g, "");
  if (!nombre && !domicilio && !cuit) return null;
  return { nombre, domicilio: domicilio || null, cuit: cuit || null };
}

type Props = {
  value: TransportistaForm;
  onChange: (next: TransportistaForm) => void;
  disabled?: boolean;
};

export default function RemitoTransportistaFields({ value, onChange, disabled = false }: Props) {
  const [open, setOpen] = useState(() => Boolean(value.nombre || value.domicilio || value.cuit));
  const patch = (changes: Partial<TransportistaForm>) => onChange({ ...value, ...changes });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        style={toggleStyle}
        disabled={disabled}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <Truck size={16} color={COLOR.ICON.MUTED} />
        {open ? "Transportista" : "Agregar transportista"}
        <span style={styles.hint}>(opcional)</span>
      </button>
      {open ? (
        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="remito-transportista-nombre">Nombre / Razón social</label>
            <input
              id="remito-transportista-nombre"
              maxLength={200}
              disabled={disabled}
              value={value.nombre}
              onChange={(event) => patch({ nombre: event.target.value })}
              style={styles.input}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="remito-transportista-domicilio">Domicilio</label>
            <input
              id="remito-transportista-domicilio"
              maxLength={300}
              disabled={disabled}
              value={value.domicilio}
              onChange={(event) => patch({ domicilio: event.target.value })}
              style={styles.input}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="remito-transportista-cuit">CUIT</label>
            <input
              id="remito-transportista-cuit"
              inputMode="numeric"
              maxLength={13}
              disabled={disabled}
              value={value.cuit}
              onChange={(event) => patch({ cuit: event.target.value })}
              style={styles.input}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

const toggleStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  alignSelf: "flex-start",
  padding: 0,
  border: "none",
  background: "transparent",
  color: COLOR.TEXT.PRIMARY,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
} as const;
