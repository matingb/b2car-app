"use client";

import React from "react";
import { css } from "@emotion/react";
import { Package, Tag } from "lucide-react";
import { BREAKPOINTS } from "@/theme/theme";
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
          <IconInput
            icon={<Tag size={14} />}
            wrapperStyle={inputWrapStyle}
            value={codigo}
            onChange={(e) => onCodigoChange(e.target.value)}
            placeholder="Código *"
            title="Código del repuesto (requerido)"
            disabled={disabled}
            aria-label="Código"
            required
          />
        </div>
        <div css={styles.nameField}>
          <IconInput
            icon={<Package size={14} />}
            wrapperStyle={inputWrapStyle}
            value={nombre}
            onChange={(e) => onNombreChange(e.target.value)}
            placeholder="Nombre del producto *"
            title="Nombre del repuesto (requerido)"
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

const inputWrapStyle: React.CSSProperties = {
  width: "100%",
  height: 38,
  boxSizing: "border-box",
};

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
    alignItems: "center",
    width: "100%",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      flexDirection: "column",
    },
  }),
  codeField: css({
    flex: "0 0 35%",
    minWidth: 0,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      flex: "1 1 auto",
      width: "100%",
    },
  }),
  nameField: css({
    flex: 1,
    minWidth: 0,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      width: "100%",
    },
  }),
} as const;
