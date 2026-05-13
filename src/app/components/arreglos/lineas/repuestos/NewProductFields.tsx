"use client";

import React from "react";
import { css } from "@emotion/react";
import { Package, Tag } from "lucide-react";
import { BREAKPOINTS, COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import IconInput from "@/app/components/ui/IconInput";
import ConflictWarning from "@/app/components/arreglos/lineas/shared/ConflictWarning";

type Props = {
  codigo: string;
  nombre: string;
  conflictMessage?: string | null;
  onCodigoChange: (value: string) => void;
  onNombreChange: (value: string) => void;
  disabled: boolean;
};

export default function NewProductFields({
  codigo,
  nombre,
  conflictMessage,
  onCodigoChange,
  onNombreChange,
  disabled,
}: Props) {
  return (
    <div css={styles.wrap}>
      <div css={styles.fields}>
        <div css={styles.codeField}>
          <label css={styles.label}>
            Código <span aria-hidden="true" css={styles.required}>*</span>
          </label>
          <IconInput
            icon={<Tag size={14} />}
            wrapperStyle={fullWidth}
            value={codigo}
            onChange={(e) => onCodigoChange(e.target.value)}
            placeholder="Ej: FIL-123"
            disabled={disabled}
            aria-label="Código"
            required
          />
        </div>
        <div css={styles.nameField}>
          <label css={styles.label}>
            Nombre <span aria-hidden="true" css={styles.required}>*</span>
          </label>
          <IconInput
            icon={<Package size={14} />}
            wrapperStyle={fullWidth}
            value={nombre}
            onChange={(e) => onNombreChange(e.target.value)}
            placeholder="Ej: Filtro de aceite premium"
            disabled={disabled}
            aria-label="Nombre"
            required
          />
        </div>
      </div>
      {conflictMessage ? <ConflictWarning message={conflictMessage} /> : null}
    </div>
  );
}

const fullWidth: React.CSSProperties = { width: "100%" };

const styles = {
  wrap: css({
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: "100%",
  }),
  fields: css({
    display: "flex",
    gap: 8,
    width: "100%",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      flexDirection: "column",
    },
  }),
  codeField: css({
    flex: "0 0 32%",
    minWidth: 0,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      flex: "1 1 auto",
    },
  }),
  nameField: css({
    flex: 1,
    minWidth: 0,
  }),
  label: css({
    display: "block",
    marginBottom: 4,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
    fontWeight: 700,
  }),
  required: css({
    color: REQUIRED_ICON_COLOR,
    fontWeight: 700,
  }),
} as const;
