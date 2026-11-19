"use client";

import React, { useEffect, useMemo, useState } from "react";
import { css } from "@emotion/react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import Autocomplete from "@/app/components/ui/Autocomplete";
import Button from "@/app/components/ui/Button";
import IconButton from "@/app/components/ui/IconButton";
import Dropdown from "@/app/components/ui/Dropdown";
import {
  MAX_LINEAS_COMPROBANTE,
  PERCEPCIONES_SUGERIDAS,
  sumarImportes,
} from "@/lib/comprobantesRecibidos/types";
import { formatArs } from "@/lib/format";
import { ALICUOTAS_IVA_ARCA } from "@/lib/facturacion/types";
import { calcularFacturaADesdeBases } from "@/lib/comprobantesRecibidos/iva";
import { COLOR } from "@/theme/theme";
import { useOperacionForm } from "./OperacionFormContext";
import { importePercepcion, type PercepcionDraft } from "./useFacturaCompraDraft";

const PERCEPCION_GRID_TEMPLATE = "minmax(220px, 1fr) 160px 44px";

const PERCEPCION_OPTIONS = PERCEPCIONES_SUGERIDAS.map((sugerida) => ({ value: sugerida.codigo, label: sugerida.label }));

/**
 * Percepciones de la factura recibida (selector abierto: sugeridas o texto libre). Los conceptos
 * de la factura salen del detalle de la operación; el IVA de A se deriva de sus tasas y se resume por alícuota.
 */
export default function OperacionFacturaPercepciones() {
  const { factura, conceptosFactura, isSubmitting, tipo } = useOperacionForm();
  const { draft, addPercepcion, updatePercepcion, removePercepcion } = factura;
  const calculoIva = useMemo(() => {
    if ((tipo !== "COMPRA" && tipo !== "GASTO") || draft.clase !== "A") return null;
    const conceptos = conceptosFactura.map((concepto) => ({
      key: concepto.key,
      importe: concepto.importe,
      ivaAlicuotaId: concepto.ivaAlicuotaId ?? 5,
    }));
    return calcularFacturaADesdeBases(conceptos);
  }, [tipo, draft.clase, conceptosFactura]);
  const montoConceptosCalculado = calculoIva
    ? sumarImportes(calculoIva.conceptos.map((concepto) => concepto.total))
    : sumarImportes(conceptosFactura.map((concepto) => concepto.importe));
  const montoConceptosFactura = draft.clase === "B"
    ? sumarImportes(conceptosFactura.map((concepto) => concepto.importe))
    : montoConceptosCalculado;
  const totalConceptos = sumarImportes(conceptosFactura.map((concepto) => concepto.importe));
  const totalIva = calculoIva
    ? sumarImportes(calculoIva.desgloseIva.map((item) => item.iva))
    : null;
  const totalPercepciones = sumarImportes(draft.percepciones.map((item) => importePercepcion(item.importe)));
  const totalFactura = sumarImportes([montoConceptosFactura, totalPercepciones]);

  return (
    <>
      <OperacionPercepcionesEditor
        contexto="factura"
        percepciones={draft.percepciones}
        montoBase={montoConceptosFactura}
        showTotals={false}
        limite={MAX_LINEAS_COMPROBANTE - conceptosFactura.length}
        disabled={isSubmitting}
        addPercepcion={addPercepcion}
        updatePercepcion={updatePercepcion}
        removePercepcion={removePercepcion}
      />
      {calculoIva && calculoIva.desgloseIva.length > 0 ? (
        <div css={styles.ivaRateList} role="group" aria-label="Totales de IVA por alícuota" data-testid="operacion-iva-desglose">
          {tipo === "GASTO" ? (
            <div css={styles.ivaGastoRate}>
              <label htmlFor="operacion-gasto-iva-alicuota">Alícuota del concepto</label>
              <Dropdown
                id="operacion-gasto-iva-alicuota"
                ariaLabel="Alícuota IVA del gasto"
                value={String(draft.ivaAlicuotaGasto ?? 5)}
                onChange={(value) => factura.update({ ivaAlicuotaGasto: Number(value) })}
                disabled={isSubmitting}
                options={ALICUOTAS_IVA_ARCA.map((rate) => ({ value: String(rate.id), label: rate.label }))}
                dataTestId="operacion-gasto-iva-alicuota"
              />
            </div>
          ) : null}
          <div css={styles.ivaRateTotals}>
            {calculoIva.desgloseIva.map((item) => (
              <div
                key={item.ivaAlicuotaId}
                css={styles.ivaRateTotal}
                data-testid={`operacion-iva-alicuota-${item.ivaAlicuotaId}`}
              >
                <span>Total IVA {ALICUOTAS_IVA_ARCA.find((rate) => rate.id === item.ivaAlicuotaId)?.label}</span>
                <strong>{formatArs(item.iva)}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : draft.clase === "B" ? (
        <section css={styles.ivaSummary} aria-label="IVA contenido de factura B" data-testid="operacion-iva-contenido">
          <h3 css={styles.ivaTitle}>IVA contenido informado (opcional)</h3>
          <p css={styles.ivaHint}>La factura B conserva sus importes finales. Este dato es informativo y no se usa como IVA discriminado.</p>
          <input
            css={styles.ivaInput}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            aria-label="IVA contenido informado"
            value={draft.ivaContenido}
            disabled={isSubmitting}
            onChange={(event) => factura.update({ ivaContenido: event.target.value })}
          />
        </section>
      ) : null}
      <div css={styles.facturaTotals} data-testid="operacion-factura-totales">
        <span>Conceptos: <strong>{formatArs(totalConceptos)}</strong></span>
        <span>IVA: <strong>{totalIva == null ? "No discriminado" : formatArs(totalIva)}</strong></span>
        <span>Percepciones: <strong>{formatArs(totalPercepciones)}</strong></span>
        <span css={styles.facturaTotal}>Total de factura: <strong>{formatArs(totalFactura)}</strong></span>
      </div>
    </>
  );
}

type PercepcionesEditorProps = {
  contexto: "factura" | "compra";
  percepciones: PercepcionDraft[];
  montoBase: number;
  montoBaseLabel?: string;
  limite?: number;
  showTotals?: boolean;
  disabled: boolean;
  addPercepcion: () => string;
  updatePercepcion: (key: string, patch: Partial<Omit<PercepcionDraft, "key">>) => void;
  removePercepcion: (key: string) => void;
};

export function OperacionPercepcionesEditor({
  contexto,
  percepciones,
  montoBase,
  montoBaseLabel,
  limite = MAX_LINEAS_COMPROBANTE,
  showTotals = true,
  disabled,
  addPercepcion,
  updatePercepcion,
  removePercepcion,
}: PercepcionesEditorProps) {
  const [activePercepcionKey, setActivePercepcionKey] = useState<string | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(max-width: 720px)");
    if (!mediaQuery) return;

    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener?.("change", updateViewport);
    return () => mediaQuery.removeEventListener?.("change", updateViewport);
  }, []);

  useEffect(() => {
    if (!isMobileViewport) setActivePercepcionKey(null);
  }, [isMobileViewport]);

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
              const canExpand = activePercepcionKey === null || activePercepcionKey === linea.key;
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
                      css={[
                        styles.mobileSummaryButton,
                        isExpanded && styles.mobileSummaryButtonExpanded,
                        !canExpand && styles.mobileSummaryButtonBlocked,
                      ]}
                      onClick={() => setActivePercepcionKey((current) => current ?? linea.key)}
                      disabled={disabled || isExpanded || !canExpand}
                      aria-expanded={isExpanded}
                      aria-label={
                        isExpanded
                          ? `${label}. Confirmá para cerrar la fila`
                          : `Editar ${label}`
                      }
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

                  <div
                    css={styles.fieldCell}
                    data-mobile-field=""
                    onFocusCapture={() => {
                      if (isMobileViewport) setActivePercepcionKey((current) => current ?? linea.key);
                    }}
                  >
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
                  <div
                    css={styles.fieldCell}
                    data-mobile-field=""
                    onFocusCapture={() => {
                      if (isMobileViewport) setActivePercepcionKey((current) => current ?? linea.key);
                    }}
                  >
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
                  {isExpanded ? (
                    <div css={styles.mobileActions} data-testid={`${testId}-percepcion-${index}-actions`}>
                      <button
                        type="button"
                        css={[styles.mobileActionButton, styles.mobileDeleteButton]}
                        onClick={handleRemove}
                        disabled={disabled}
                        data-testid={`${testId}-percepcion-${index}-delete`}
                      >
                        Eliminar
                      </button>
                      <button
                        type="button"
                        css={[styles.mobileActionButton, styles.mobileConfirmButton]}
                        onClick={() => {
                          if (percepcionValue) setActivePercepcionKey(null);
                        }}
                        disabled={disabled || !percepcionValue}
                        data-testid={`${testId}-percepcion-${index}-confirm`}
                      >
                        Confirmar
                      </button>
                    </div>
                  ) : null}
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
            const nuevaPercepcionKey = addPercepcion();
            if (isMobileViewport) setActivePercepcionKey(nuevaPercepcionKey);
          }}
          disabled={disabled || percepciones.length >= limite || (isMobileViewport && activePercepcionKey !== null)}
          dataTestId={`${testId}-agregar-percepcion`}
          text="Agregar percepción"
          icon={<Plus size={16} />}
          outline
        />
        {showTotals ? (
          <div css={styles.totales} data-testid={`${testId}-totales`}>
            <span>{montoBaseLabel ?? (esFactura ? "Conceptos" : "Mercadería")}: <strong>{formatArs(montoBase)}</strong></span>
            <span>Percepciones: <strong>{formatArs(totalPercepciones)}</strong></span>
            <span>{esFactura ? "Total factura" : "Total compra"}: <strong style={styles.totalStrong}>{formatArs(total)}</strong></span>
          </div>
        ) : null}
      </div>

    </div>
  );
}

const styles = {
  ivaSummary: css({
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 12,
    padding: 14,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
  }),
  ivaGastoRate: css({
    display: "flex",
    flexDirection: "column",
    gap: 5,
    maxWidth: 320,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
    fontWeight: 600,
  }),
  ivaTitle: css({
    margin: 0,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 14,
    fontWeight: 700,
  }),
  ivaHint: css({
    margin: "4px 0 0",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
  }),
  ivaRateList: css({
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 8,
    width: "100%",
    marginTop: 12,
  }),
  ivaRateTotals: css({
    display: "flex",
    flexDirection: "column",
    gap: 6,
    width: "100%",
    maxWidth: 420,
  }),
  ivaRateTotal: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
    "& > strong": { color: COLOR.TEXT.PRIMARY, fontWeight: 700 },
  }),
  facturaTotals: css({
    display: "flex",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: "8px 20px",
    marginTop: 12,
    paddingTop: 10,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
    "& strong": { color: COLOR.TEXT.PRIMARY },
    "@media (max-width: 720px)": {
      justifyContent: "space-between",
    },
  }),
  facturaTotal: css({
    color: COLOR.TEXT.PRIMARY,
    fontWeight: 700,
  }),
  ivaInput: css({
    width: "100%",
    minHeight: 36,
    padding: "6px 9px",
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 7,
    color: COLOR.TEXT.PRIMARY,
    background: COLOR.BACKGROUND.PRIMARY,
    fontSize: 13,
  }),
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
      paddingRight: 0,
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
    width: "100%",
    boxSizing: "border-box",
    padding: "0 20px 0 0",
    border: 0,
    background: "transparent",
    color: COLOR.TEXT.PRIMARY,
    textAlign: "left",
    cursor: "pointer",
  }),
  mobileSummaryButtonExpanded: css({
    cursor: "default",
    "&:disabled": {
      opacity: 1,
    },
  }),
  mobileSummaryButtonBlocked: css({
    cursor: "not-allowed",
    opacity: 0.55,
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
      display: "none",
    },
  }),
  mobileActions: css({
    display: "none",
    "@media (max-width: 720px)": {
      display: "flex",
      justifyContent: "flex-end",
      gap: 8,
      width: "100%",
      boxSizing: "border-box",
      marginTop: 4,
    },
  }),
  mobileActionButton: css({
    minWidth: 100,
    minHeight: 42,
    padding: "10px 14px",
    borderRadius: 8,
    font: "inherit",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    "&:disabled": {
      opacity: 0.5,
      cursor: "not-allowed",
    },
  }),
  mobileConfirmButton: css({
    border: "none",
    background: COLOR.ACCENT.PRIMARY,
    color: COLOR.TEXT.CONTRAST,
    "&:hover:not(:disabled)": {
      background: COLOR.ACCENT.HOVER,
    },
  }),
  mobileDeleteButton: css({
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.PRIMARY,
    "&:hover:not(:disabled)": {
      border: `1px solid ${COLOR.BORDER.DEFAULT}`,
      background: COLOR.BACKGROUND.PRIMARY,
      color: COLOR.TEXT.PRIMARY,
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
