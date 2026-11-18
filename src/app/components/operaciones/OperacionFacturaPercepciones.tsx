"use client";

import React, { useMemo, useState } from "react";
import { css } from "@emotion/react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import Autocomplete from "@/app/components/ui/Autocomplete";
import Button from "@/app/components/ui/Button";
import IconButton from "@/app/components/ui/IconButton";
import {
  MAX_LINEAS_COMPROBANTE,
  PERCEPCIONES_SUGERIDAS,
  sumarImportes,
} from "@/lib/comprobantesRecibidos/types";
import { formatArs } from "@/lib/format";
import { COLOR } from "@/theme/theme";
import { useOperacionForm } from "./OperacionFormContext";
import { importePercepcion, type PercepcionDraft } from "./useFacturaCompraDraft";

const PERCEPCION_GRID_TEMPLATE = "minmax(220px, 1fr) 160px 44px";

const PERCEPCION_OPTIONS = PERCEPCIONES_SUGERIDAS.map((sugerida) => ({ value: sugerida.codigo, label: sugerida.label }));

/**
 * Percepciones de la factura recibida (selector abierto: sugeridas o texto libre). Los conceptos
 * de la factura salen del detalle de la operación; acá solo se suman los importes informados.
 */
export default function OperacionFacturaPercepciones() {
  const { factura, conceptosFactura, isSubmitting } = useOperacionForm();
  const { draft, addPercepcion, updatePercepcion, removePercepcion } = factura;
  return (
    <OperacionPercepcionesEditor
      contexto="factura"
      percepciones={draft.percepciones}
      montoBase={sumarImportes(conceptosFactura.map((concepto) => concepto.importe))}
      limite={MAX_LINEAS_COMPROBANTE - conceptosFactura.length}
      disabled={isSubmitting}
      addPercepcion={addPercepcion}
      updatePercepcion={updatePercepcion}
      removePercepcion={removePercepcion}
    />
  );
}

type PercepcionesEditorProps = {
  contexto: "factura" | "compra";
  percepciones: PercepcionDraft[];
  montoBase: number;
  limite?: number;
  disabled: boolean;
  addPercepcion: () => string;
  updatePercepcion: (key: string, patch: Partial<Omit<PercepcionDraft, "key">>) => void;
  removePercepcion: (key: string) => void;
};

export function OperacionPercepcionesEditor({
  contexto,
  percepciones,
  montoBase,
  limite = MAX_LINEAS_COMPROBANTE,
  disabled,
  addPercepcion,
  updatePercepcion,
  removePercepcion,
}: PercepcionesEditorProps) {
  const [activePercepcionKey, setActivePercepcionKey] = useState<string | null>(null);

  const esFactura = contexto === "factura";
  const testId = `operacion-${contexto}`;
  const totalPercepciones = useMemo(
    () => sumarImportes(percepciones.map((linea) => importePercepcion(linea.importe))),
    [percepciones],
  );
  const total = sumarImportes([montoBase, totalPercepciones]);

  return (
    <div data-testid={`${testId}-percepciones`}>
      <div style={styles.sectionHeaderRow}>
        <div style={styles.title}>{esFactura ? "Percepciones de la factura" : "Cargos de la compra"}</div>
      </div>

      <div css={[styles.tableCard, percepciones.length === 0 && styles.emptyTableCard]}>
        <div css={styles.columnsHeader} aria-hidden="true">
          <div>PERCEPCIÓN</div>
          <div style={{ textAlign: "right" }}>IMPORTE</div>
          <div />
        </div>

        <div css={styles.linesList}>
          {percepciones.length === 0 ? (
            <p style={styles.empty}>{esFactura ? "Sin percepciones. Agregalas si la factura las incluye." : "La compra no tiene cargos."}</p>
          ) : (
            percepciones.map((linea, index) => {
              const isExpanded = activePercepcionKey === linea.key;
              const importe = importePercepcion(linea.importe);
              const percepcionValue = linea.percepcion.trim();
              const label =
                PERCEPCION_OPTIONS.find((option) => option.value === percepcionValue)?.label
                ?? (percepcionValue || `Percepción ${index + 1}`);
              const handleRemove = () => {
                removePercepcion(linea.key);
                setActivePercepcionKey((current) => (current === linea.key ? null : current));
              };

              return (
                <div
                  key={linea.key}
                  css={[styles.lineRow, isExpanded && styles.lineRowExpanded]}
                  data-testid={`${testId}-percepcion-${index}`}
                >
                  <div css={styles.mobileHeader} data-mobile-header="">
                    <button
                      type="button"
                      css={styles.mobileSummaryButton}
                      onClick={() =>
                        setActivePercepcionKey((current) => (current === linea.key ? null : linea.key))
                      }
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? "Editando" : "Editar"} ${label}`}
                      data-testid={`${testId}-percepcion-${index}-summary`}
                    >
                      <span css={styles.mobileSummaryTop}>
                        <strong css={styles.mobileSummaryLabel}>{label}</strong>
                        <strong css={styles.mobileSummaryAmount}>{formatArs(importe)}</strong>
                      </span>
                      <span css={styles.mobileSummaryBottom}>
                        <span css={styles.mobileSummaryHint}>Importe: {formatArs(importe)}</span>
                      </span>
                      <ChevronDown
                        size={16}
                        css={[styles.mobileChevron, isExpanded && styles.mobileChevronExpanded]}
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  <div css={styles.fieldCell} data-mobile-field="" onFocusCapture={() => setActivePercepcionKey(linea.key)}>
                    <span css={styles.mobileFieldLabel}>Percepción</span>
                    <Autocomplete
                      options={PERCEPCION_OPTIONS}
                      value={linea.percepcion}
                      onChange={(value) => updatePercepcion(linea.key, { percepcion: value })}
                      allowCustomValue
                      disabled={disabled}
                      placeholder="Elegí o escribí una percepción"
                      aria-label={`Percepción ${index + 1}`}
                      maxLength={200}
                      dataTestId={`${testId}-percepcion-${index}-tipo`}
                      style={{ minWidth: 0 }}
                      inputStyle={{ height: 44 }}
                    />
                  </div>
                  <div css={styles.fieldCell} data-mobile-field="" onFocusCapture={() => setActivePercepcionKey(linea.key)}>
                    <span css={styles.mobileFieldLabel}>Importe</span>
                    <input
                      style={styles.moneyInput}
                      value={linea.importe}
                      disabled={disabled}
                      inputMode="decimal"
                      placeholder="0,00"
                      aria-label={`Importe de la percepción ${index + 1}`}
                      onChange={(event) =>
                        updatePercepcion(linea.key, { importe: event.target.value.replace(/[^0-9.,]/g, "") })
                      }
                      data-testid={`${testId}-percepcion-${index}-importe`}
                    />
                  </div>
                  <div css={styles.removeCell}>
                    <IconButton
                      icon={<Trash2 />}
                      size={16}
                      onClick={handleRemove}
                      disabled={disabled}
                      title="Quitar percepción"
                      ariaLabel={`Quitar percepción ${index + 1}`}
                      data-testid={`${testId}-percepcion-${index}-remove`}
                      style={styles.trashBtn}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div css={styles.footerRow}>
        <Button
          type="button"
          onClick={() => {
            setActivePercepcionKey(addPercepcion());
          }}
          disabled={disabled || percepciones.length >= limite}
          dataTestId={`${testId}-agregar-percepcion`}
          text="Agregar percepción"
          icon={<Plus size={16} />}
          outline
        />
        <div css={styles.totales} data-testid={`${testId}-totales`}>
          <span>{esFactura ? "Conceptos" : "Mercadería"}: <strong>{formatArs(montoBase)}</strong></span>
          <span>Percepciones: <strong>{formatArs(totalPercepciones)}</strong></span>
          <span>{esFactura ? "Total factura" : "Total compra"}: <strong style={styles.totalStrong}>{formatArs(total)}</strong></span>
        </div>
      </div>

    </div>
  );
}

const styles = {
  sectionHeaderRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 8,
  } as const,
  title: {
    fontWeight: 700,
    fontSize: 14,
    color: COLOR.TEXT.PRIMARY,
  } as const,
  tableCard: css({
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    overflow: "hidden",
  }),
  emptyTableCard: css({
    "@media (max-width: 720px)": {
      display: "none",
    },
  }),
  columnsHeader: css({
    display: "grid",
    gridTemplateColumns: PERCEPCION_GRID_TEMPLATE,
    gap: 10,
    alignItems: "center",
    padding: "10px 12px",
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    "@media (max-width: 720px)": {
      display: "none",
    },
  }),
  linesList: css({
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: "10px 12px",
    "@media (max-width: 720px)": {
      gap: 0,
      padding: "0 12px",
    },
  }),
  lineRow: css({
    display: "grid",
    gridTemplateColumns: PERCEPCION_GRID_TEMPLATE,
    gap: 10,
    alignItems: "center",
    "@media (max-width: 720px)": {
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      gap: 0,
      padding: "12px 0",
      position: "relative",
      borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
      "&:last-child": {
        borderBottom: "none",
      },
      "& > [data-mobile-field]": {
        display: "flex",
        flexDirection: "column",
        gap: 5,
        maxHeight: 0,
        marginBottom: 0,
        opacity: 0,
        overflow: "hidden",
        visibility: "hidden",
      },
    },
    "@media (max-width: 720px) and (prefers-reduced-motion: no-preference)": {
      "& > [data-mobile-field]": {
        transition: "max-height 240ms ease, opacity 180ms ease, margin-bottom 180ms ease, visibility 0s linear 240ms",
      },
    },
  }),
  lineRowExpanded: css({
    "@media (max-width: 720px)": {
      "& > [data-mobile-field]": {
        maxHeight: 90,
        marginBottom: 8,
        opacity: 1,
        visibility: "visible",
      },
      "& > [data-mobile-field] > span:first-child": {
        display: "block",
        color: COLOR.TEXT.SECONDARY,
        fontSize: 12,
        fontWeight: 600,
      },
    },
    "@media (max-width: 720px) and (prefers-reduced-motion: no-preference)": {
      "& > [data-mobile-field]": {
        transition: "max-height 240ms ease, opacity 180ms ease, margin-bottom 180ms ease, visibility 0s linear 0s",
      },
    },
  }),
  mobileHeader: css({
    display: "none",
    "@media (max-width: 720px)": {
      display: "flex",
      order: -1,
      alignItems: "center",
      gap: 8,
      width: "100%",
      minHeight: 44,
      paddingRight: 52,
      boxSizing: "border-box",
    },
  }),
  mobileSummaryButton: css({
    display: "none",
    "@media (max-width: 720px)": {
      display: "flex",
    },
    alignItems: "stretch",
    flex: 1,
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
    position: "relative",
    boxSizing: "border-box",
    padding: "0 20px 0 0",
    border: 0,
    background: "transparent",
    color: COLOR.TEXT.PRIMARY,
    textAlign: "left",
    cursor: "pointer",
  }),
  mobileSummaryTop: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    width: "100%",
  }),
  mobileSummaryBottom: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    width: "100%",
  }),
  mobileSummaryLabel: css({
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 14,
    fontWeight: 600,
  }),
  mobileSummaryAmount: css({
    flexShrink: 0,
    fontSize: 14,
    fontWeight: 700,
  }),
  mobileSummaryHint: css({
    color: COLOR.TEXT.TERTIARY,
    fontSize: 11,
    textAlign: "right",
  }),
  mobileChevron: css({
    position: "absolute",
    top: "50%",
    right: 0,
    flexShrink: 0,
    color: COLOR.TEXT.SECONDARY,
    transform: "translateY(-50%)",
    "@media (prefers-reduced-motion: no-preference)": {
      transition: "transform 180ms ease",
    },
  }),
  mobileChevronExpanded: css({
    transform: "translateY(-50%) rotate(180deg)",
  }),
  fieldCell: css({
    minWidth: 0,
    "@media (max-width: 720px)": {
      display: "flex",
      flexDirection: "column",
      gap: 5,
    },
  }),
  mobileFieldLabel: css({
    display: "none",
  }),
  removeCell: css({
    display: "contents",
    "@media (max-width: 720px)": {
      display: "flex",
      justifyContent: "flex-end",
      position: "absolute",
      top: 12,
      right: 0,
    },
  }),
  empty: {
    margin: 0,
    padding: "4px 0",
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
  } as const,
  moneyInput: {
    width: "100%",
    height: 44,
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.INPUT.PRIMARY.BACKGROUND,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 14,
    outline: "none",
    textAlign: "right",
    boxSizing: "border-box",
  } as const,
  trashBtn: {
    height: 44,
    width: 44,
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
  } as React.CSSProperties,
  footerRow: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 10,
    "@media (max-width: 720px)": {
      flexDirection: "column",
      alignItems: "stretch",
      gap: 8,
      "& > button": {
        alignSelf: "stretch",
        width: "100%",
        minWidth: 0,
        height: 44,
        boxSizing: "border-box",
        padding: "12px 14px",
        border: `2px dashed ${COLOR.BORDER.SUBTLE}`,
        borderRadius: 12,
        background: "transparent",
        color: COLOR.TEXT.SECONDARY,
        "&:hover:not(:disabled)": {
          border: `2px dashed ${COLOR.BORDER.SUBTLE}`,
          background: "transparent",
          color: COLOR.TEXT.SECONDARY,
        },
      },
    },
  }),
  totales: css({
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    "@media (max-width: 720px)": {
      width: "100%",
      justifyContent: "center",
      gap: 12,
    },
  }),
  totalStrong: {
    color: COLOR.TEXT.PRIMARY,
  } as const,
} as const;
