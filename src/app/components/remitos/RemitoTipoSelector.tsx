"use client";

import { Info } from "lucide-react";
import {
  REMITO_SUGERENCIA_NORMATIVA,
  REMITO_TIPO_INFO,
  type RemitoClase,
  type RemitoPreflight,
} from "@/lib/remitos/types";
import { COLOR } from "@/theme/theme";
import { RemitoClaseBadge } from "./RemitoListItem";

type Props = {
  value: RemitoClase | null;
  onChange: (clase: RemitoClase) => void;
  tipos?: RemitoPreflight["tipos"];
};

const CLASES: RemitoClase[] = ["R", "X"];

/**
 * Selector libre de R o X: sin selección inicial y sin deshabilitar opciones.
 * La sugerencia normativa es solo informativa; el sistema nunca cambia la elección.
 */
export default function RemitoTipoSelector({ value, onChange, tipos }: Props) {
  return (
    <div style={styles.container}>
      <div role="radiogroup" aria-label="Tipo de remito" style={styles.options}>
        {CLASES.map((clase) => {
          const selected = value === clase;
          const proximo = tipos?.[clase]?.proximoNumeroVisible;
          return (
            <button
              key={clase}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(clase)}
              style={{ ...styles.option, ...(selected ? styles.optionSelected : {}) }}
              data-testid={`remito-tipo-${clase}`}
            >
              <RemitoClaseBadge clase={clase} size={40} />
              <span style={styles.optionBody}>
                <strong style={styles.optionTitle}>{REMITO_TIPO_INFO[clase].titulo}</strong>
                <span style={styles.optionDescription}>{REMITO_TIPO_INFO[clase].descripcion}</span>
                {proximo ? <span style={styles.optionNext}>Próximo número: {proximo}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
      <p style={styles.notice} role="note">
        <Info size={16} color={COLOR.ACCENT.PRIMARY} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>{REMITO_SUGERENCIA_NORMATIVA}</span>
      </p>
    </div>
  );
}

const styles = {
  container: { display: "flex", flexDirection: "column" as const, gap: 10 },
  options: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 },
  option: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    textAlign: "left" as const,
    padding: 14,
    borderRadius: 10,
    border: `2px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SECONDARY,
    color: COLOR.TEXT.PRIMARY,
    cursor: "pointer",
  },
  optionSelected: {
    borderColor: COLOR.ACCENT.PRIMARY,
    background: COLOR.BACKGROUND.INFO_TINT,
  },
  optionBody: { display: "flex", flexDirection: "column" as const, gap: 4 },
  optionTitle: { fontSize: 15 },
  optionDescription: { fontSize: 13, color: COLOR.TEXT.SECONDARY },
  optionNext: { fontSize: 12, color: COLOR.TEXT.TERTIARY, fontFamily: "monospace" },
  notice: {
    display: "flex",
    gap: 8,
    margin: 0,
    padding: "10px 12px",
    borderRadius: 8,
    background: COLOR.BACKGROUND.INFO_TINT,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
  },
} as const;
