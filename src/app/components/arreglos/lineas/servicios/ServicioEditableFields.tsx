"use client";

import React from "react";
import { css } from "@emotion/react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import Can from "@/app/components/auth/Can";
import { Permission } from "@/lib/permissions";
import type { ServicioEditableCardDraft } from "./ServicioEditableCard";

type Props = {
  draft: ServicioEditableCardDraft;
  onDraftChange: (patch: Partial<ServicioEditableCardDraft>) => void;
  canInteract: boolean;
  mode: "add" | "edit";
};

export default function ServicioEditableFields({
  draft,
  onDraftChange,
  canInteract,
  mode,
}: Props) {
  const handleHorasFacturadasChange = (value: string) => {
    if (mode === "add" && (draft.horasTrabajadas === draft.horasFacturadas || draft.horasTrabajadas === "1")) {
      onDraftChange({ horasFacturadas: value, horasTrabajadas: value });
    } else {
      onDraftChange({ horasFacturadas: value });
    }
  };
  const legacyHoursMissing = mode === "edit" && (
    draft.horasFacturadas === "" || draft.horasTrabajadas === ""
  );

  return (
    <div css={styles.container}>
      {/* Input de descripción con autofocus condicional */}
      <div css={styles.descWrap}>
        <input
          type="text"
          id="job-description-input"
          aria-label="Descripción"
          value={draft.descripcion}
          onChange={(e) => onDraftChange({ descripcion: e.target.value })}
          placeholder="Ej: Cambio de aceite y filtros"
          css={styles.descriptionInput}
          autoFocus={mode === "add"}
          disabled={!canInteract}
        />
      </div>

      {legacyHoursMissing && (
        <div role="status" css={styles.legacyNotice}>
          Este detalle no tiene horas históricas registradas. El total anterior se mantiene hasta que ingreses horas.
        </div>
      )}

      {/* Fila de inputs numéricos compactos */}
      <div css={styles.numRow}>
        {/* Campo Horas */}
        <div css={styles.numField("72px")}>
          <span css={styles.prefixLabel}>Hrs</span>
          <input
            type="number"
            id="job-hours-input"
            aria-label="Horas facturadas"
            min="0"
            step="0.01"
            value={draft.horasFacturadas}
            onChange={(e) => handleHorasFacturadasChange(e.target.value)}
            title="Horas facturadas al cliente"
            disabled={!canInteract}
            css={styles.numInput}
          />
        </div>

        {/* Campo Precio Unitario */}
        <Can permission={Permission.ArreglosPreciosEdit}>
          <div css={styles.numField("92px")}>
            <span css={styles.prefixLabel}>$</span>
            <input
              type="number"
              id="job-unit-price-input"
              aria-label="Precio venta"
              min="0"
              step="0.01"
              max="9999999999.99"
              value={draft.precioHoraFacturada}
              onChange={(e) => onDraftChange({ precioHoraFacturada: e.target.value })}
              placeholder="0.00"
              title="Precio unitario por hora/servicio"
              disabled={!canInteract}
              css={styles.numInput}
            />
          </div>
        </Can>
      </div>
    </div>
  );
}

const styles = {
  container: css({
    display: "flex",
    flexDirection: "column",
    gap: 10,
    width: "100%",
    minWidth: 0,
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
      flexDirection: "row",
      alignItems: "center",
    },
  }),
  descWrap: css({
    flex: 1,
    minWidth: 0,
  }),
  descriptionInput: css({
    width: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    backgroundColor: "#ffffff",
    color: COLOR.TEXT.PRIMARY,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    "&:focus": {
      borderColor: COLOR.ACCENT.PRIMARY,
    },
    "&:disabled": {
      backgroundColor: COLOR.BACKGROUND.SUBTLE,
      cursor: "not-allowed",
    },
  }),
  legacyNotice: css({
    padding: "7px 10px",
    borderRadius: 8,
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
  }),
  numRow: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "space-between",
    [`@media (min-width: ${BREAKPOINTS.sm}px)`]: {
      flexWrap: "nowrap",
      justifyContent: "flex-end",
    },
  }),
  numField: (width: string) =>
    css({
      position: "relative",
      flex: 1,
      minWidth: 64,
      [`@media (min-width: ${BREAKPOINTS.sm}px)`]: {
        flex: "none",
        width,
      },
    }),
  prefixLabel: css({
    position: "absolute",
    left: 8,
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 11,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    pointerEvents: "none",
  }),
  numInput: css({
    width: "100%",
    paddingLeft: 30,
    paddingRight: 8,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    backgroundColor: "#ffffff",
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
    fontWeight: 600,
    textAlign: "right",
    outline: "none",
    boxSizing: "border-box",
    "&:focus": {
      borderColor: COLOR.ACCENT.PRIMARY,
    },
    "&:disabled": {
      backgroundColor: COLOR.BACKGROUND.SUBTLE,
      cursor: "not-allowed",
    },
  }),
} as const;
