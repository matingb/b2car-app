"use client";

import React from "react";
import { css } from "@emotion/react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import Can from "@/app/components/auth/Can";
import { Permission } from "@/lib/permissions";
import NumberInput from "@/app/components/ui/NumberInput";
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
  const handleHorasFacturadasChange = (value: number) => {
    if (mode === "add" && (draft.horasTrabajadas === draft.horasFacturadas || draft.horasTrabajadas === 1)) {
      onDraftChange({ horasFacturadas: value, horasTrabajadas: value });
    } else {
      onDraftChange({ horasFacturadas: value });
    }
  };

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

      {/* Fila de inputs numéricos compactos */}
      <div css={styles.numRow}>
        {/* Campo Horas */}
        <div css={styles.numField("64px")}>
          <span css={styles.prefixLabel}>Hrs</span>
          <NumberInput
            minValue={0}
            allowDecimals
            id="job-hours-input"
            aria-label="Horas facturadas"
            title="Horas facturadas al cliente"
            disabled={!canInteract}
            value={draft.horasFacturadas}
            onValueChange={handleHorasFacturadasChange}
            style={styles.fieldNumberInput(canInteract)}
          />
        </div>

        {/* Campo Cantidad */}
        <div css={styles.numField("68px")}>
          <span css={styles.prefixLabel}>Cant</span>
          <NumberInput
            id="job-quantity-input"
            aria-label="Cantidad"
            title="Cantidad de servicios"
            minValue={1}
            allowDecimals={false}
            disabled={!canInteract}
            value={Number(draft.cantidad) || 1}
            onValueChange={(val) => onDraftChange({ cantidad: String(val) })}
            style={styles.fieldNumberInput(canInteract)}
          />
        </div>

        {/* Campo Precio Unitario */}
        <Can permission={Permission.ArreglosPreciosEdit}>
          <div css={styles.numField("94px")}>
            <span css={styles.prefixLabel}>$</span>
            <NumberInput
              id="job-unit-price-input"
              aria-label="Precio venta"
              title="Precio unitario por hora/servicio"
              minValue={0}
              allowDecimals
              step="0.01"
              disabled={!canInteract}
              value={Number(draft.precioHoraFacturada) || 0}
              onValueChange={(val) => onDraftChange({ precioHoraFacturada: String(val) })}
              placeholder="0.00"
              style={styles.fieldNumberInput(canInteract)}
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
    fontSize: 13,
    fontWeight: 400,
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
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
      flexWrap: "nowrap",
      justifyContent: "flex-end",
    },
  }),
  numField: (width: string) =>
    css({
      position: "relative",
      flex: 1,
      [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
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
    fontWeight: 500,
    color: COLOR.TEXT.SECONDARY,
    pointerEvents: "none",
  }),
  fieldNumberInput: (canInteract: boolean) => ({
    width: "100%",
    paddingLeft: 30,
    paddingRight: 8,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    backgroundColor: canInteract ? "#ffffff" : COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
    fontWeight: 400,
    textAlign: "right" as const,
    boxSizing: "border-box" as const,
    outline: "none",
    cursor: canInteract ? "text" : "not-allowed",
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
    fontWeight: 400,
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
