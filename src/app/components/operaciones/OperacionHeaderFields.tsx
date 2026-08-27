"use client";

import React from "react";
import { css } from "@emotion/react";
import { COLOR } from "@/theme/theme";
import Autocomplete from "@/app/components/ui/Autocomplete";
import CuentaFinancieraFormFields from "@/app/components/finanzas/CuentaFinancieraFormFields";
import CuentaFinancieraAutocomplete, {
  CREATE_CUENTA_VALUE,
} from "@/app/components/finanzas/CuentaFinancieraAutocomplete";
import { TIPOS_UI } from "./operacionModalTypes";
import { useOperacionForm } from "./OperacionFormContext";

export { CREATE_CUENTA_VALUE };

export default function OperacionHeaderFields() {
  const {
    talleres,
    tallerId,
    setTallerId,
    fecha,
    setFecha,
    cuentaFinancieraId,
    setCuentaFinancieraId,
    cuentaDraft,
    setCuentaDraft,
    tipo,
    setTipo,
    isContextualStock,
  } = useOperacionForm();

  const isCreatingCuenta = cuentaFinancieraId === CREATE_CUENTA_VALUE;
  const hasManyTalleres = talleres.length > 1;

  return (
    <>
      <div css={styles.headerRow} data-testid="operaciones-datos-principales">
        {tipo !== "GASTO" && hasManyTalleres && !isContextualStock ? (
          <div style={styles.headerLeft}>
            <label style={styles.label}>Taller</label>
            <Autocomplete
              value={tallerId || ""}
              onChange={setTallerId}
              options={talleres.map((t) => ({ value: t.id, label: t.nombre }))}
              placeholder="Seleccionar taller"
              dataTestId="operaciones-create-taller"
              style={{ height: 44, fontSize: 14 }}
              hideClearButton
            />
          </div>
        ) : null}

        <div style={styles.headerLeft}>
          <label style={styles.label}>Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            data-testid="operaciones-create-fecha"
            style={styles.dateInput}
          />
        </div>

        <div style={styles.headerLeft}>
          <label style={styles.label}>Cuenta financiera</label>
          <CuentaFinancieraAutocomplete
            value={cuentaFinancieraId}
            onChange={setCuentaFinancieraId}
            dataTestId="operaciones-create-cuenta-financiera"
            hideClearButton
            style={{ height: 44, fontSize: 14 }}
          />
        </div>

        <div style={styles.headerRight}>
          <label style={styles.label}>Tipo de operación</label>
          <div css={styles.tipoRow}>
            {(isContextualStock ? TIPOS_UI.filter((t) => t.tipo === "VENTA" || t.tipo === "COMPRA") : TIPOS_UI).map((t) => {
              const isSelected = tipo === t.tipo;
              const isDisabled = Boolean(t.disabled);
              return (
                <span key={t.tipo} css={styles.tooltipWrap}>
                  <button
                    type="button"
                    onClick={() => !isDisabled && setTipo(t.tipo)}
                    disabled={isDisabled}
                    data-testid={`operaciones-create-tipo-${t.tipo}`}
                    css={[
                      styles.tipoChip,
                      isSelected && styles.tipoChipSelected,
                      isDisabled && styles.tipoChipDisabled,
                    ]}
                  >
                    {t.icon ? (
                      <span style={{ display: "flex" }}>{t.icon}</span>
                    ) : null}
                    <span>{t.label}</span>
                  </button>
                  {isDisabled ? (
                    <span
                      css={styles.tooltip}
                      className="operaciones-tooltip"
                    >
                      En construcción
                    </span>
                  ) : null}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {isCreatingCuenta && (
        <CuentaFinancieraFormFields
          values={cuentaDraft}
          onChange={(patch) => setCuentaDraft({ ...cuentaDraft, ...patch })}
          showSaldoInicial={false}
          showActivo={false}
          compact
          dataTestIdPrefix="operaciones-cuenta"
        />
      )}
    </>
  );
}

const styles = {
  headerRow: css({
    display: "flex",
    gap: 12,
    alignItems: "flex-end",
    flexWrap: "wrap",
    marginBottom: 12,
    "@media (max-width: 680px)": {
      flexDirection: "column",
      alignItems: "stretch",
    },
  }),
  headerLeft: {
    flex: "1 1 0",
    minWidth: 0,
  } as const,
  headerRight: {
    flex: "1 0 100%",
    display: "flex",
    flexDirection: "column",
  } as const,
  label: {
    display: "block",
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    marginBottom: 6,
  },
  dateInput: {
    height: 44,
    width: "100%",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    color: COLOR.TEXT.PRIMARY,
    backgroundColor: COLOR.INPUT.PRIMARY.BACKGROUND,
    outline: "none",
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
  } as const,
  tipoRow: css({
    display: "flex",
    alignItems: "stretch",
    gap: 8,
    flexWrap: "nowrap",
    paddingBottom: 2,
  }),
  tooltipWrap: css({
    position: "relative",
    display: "inline-flex",
    "&:hover .operaciones-tooltip, &:focus-within .operaciones-tooltip": {
      opacity: 1,
    },
  }),
  tooltip: css({
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: "calc(100% + 8px)",
    backgroundColor: "rgba(20, 20, 20, 0.95)",
    color: "white",
    padding: "6px 8px",
    borderRadius: 8,
    fontSize: 12,
    whiteSpace: "nowrap",
    opacity: 0,
    pointerEvents: "none",
    transition: "opacity 120ms ease",
    zIndex: 10,
    "::after": {
      content: '""',
      position: "absolute",
      top: "100%",
      left: "50%",
      transform: "translateX(-50%)",
      border: "6px solid transparent",
      borderTopColor: "rgba(20, 20, 20, 0.95)",
    },
  }),
  tipoChip: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.PRIMARY,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    whiteSpace: "nowrap",
    transition: "all 120ms ease",
    ":hover": {
      borderColor: COLOR.ACCENT.PRIMARY,
    },
  }),
  tipoChipSelected: css({
    backgroundColor: COLOR.ACCENT.PRIMARY,
    color: COLOR.TEXT.CONTRAST,
    borderColor: COLOR.ACCENT.PRIMARY,
    boxShadow: "0 0 0 2px rgba(0, 121, 149, 0.18)",
  }),
  tipoChipDisabled: css({
    opacity: 0.6,
    cursor: "default",
  }),
  inlineForm: css({
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: "100%",
    marginBottom: 12,
  }),
} as const;
