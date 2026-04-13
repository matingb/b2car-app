"use client";

import React from "react";
import Autocomplete, { type AutocompleteOption } from "./Autocomplete";
import { COLOR } from "@/theme/theme";

export const PAISES_REGION: AutocompleteOption[] = [
  { value: "54",  label: "🇦🇷 +54" },
  { value: "598", label: "🇺🇾 +598" },
  { value: "56",  label: "🇨🇱 +56" },
  { value: "595", label: "🇵🇾 +595" },
  { value: "55",  label: "🇧🇷 +55" },
  { value: "591", label: "🇧🇴 +591" },
  { value: "51",  label: "🇵🇪 +51" },
];

type Props = {
  codigoPais: string;
  telefono: string;
  onChange: (patch: { codigoPais?: string; telefono?: string }) => void;
  style?: React.CSSProperties;
};

export default function PhoneInput({ codigoPais, telefono, onChange, style }: Props) {
  return (
    <div style={{ display: "flex", gap: 8, ...style }}>
      <div style={{ flex: "0 0 120px" }}>
        <label style={styles.label}>País</label>
        <Autocomplete
          value={codigoPais}
          options={PAISES_REGION}
          onChange={(v) => onChange({ codigoPais: v ?? "54" })}
          hideClearButton
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <label style={styles.label}>Teléfono</label>
        <input
          style={styles.input}
          placeholder="3511234567"
          value={telefono}
          onChange={(e) => onChange({ telefono: e.target.value })}
          type="number"
        />
      </div>
    </div>
  );
}

const styles = {
  label: {
    display: "block",
    fontSize: 13,
    marginBottom: 6,
    color: COLOR.TEXT.SECONDARY,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    color: COLOR.TEXT.PRIMARY,
  },
} as const;
