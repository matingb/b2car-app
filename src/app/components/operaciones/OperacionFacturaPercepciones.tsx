"use client";

import React, { useMemo } from "react";
import { css } from "@emotion/react";
import { Plus, Trash2 } from "lucide-react";
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
import { importePercepcion } from "./useFacturaCompraDraft";

const PERCEPCION_GRID_TEMPLATE = "minmax(220px, 1fr) 160px 44px";

const PERCEPCION_OPTIONS = PERCEPCIONES_SUGERIDAS.map((sugerida) => ({ value: sugerida.codigo, label: sugerida.label }));

/**
 * Percepciones de la factura recibida (selector abierto: sugeridas o texto libre). Los conceptos
 * de la factura salen del detalle de la operación; acá solo se suman los importes informados.
 */
export default function OperacionFacturaPercepciones() {
  const { factura, conceptosFactura, isSubmitting } = useOperacionForm();
  const { draft, addPercepcion, updatePercepcion, removePercepcion } = factura;

  const totalConceptos = useMemo(
    () => sumarImportes(conceptosFactura.map((concepto) => concepto.importe)),
    [conceptosFactura],
  );
  const totalPercepciones = useMemo(
    () => sumarImportes(draft.percepciones.map((linea) => importePercepcion(linea.importe))),
    [draft.percepciones],
  );
  const totalFactura = sumarImportes([totalConceptos, totalPercepciones]);
  const limiteAlcanzado = conceptosFactura.length + draft.percepciones.length >= MAX_LINEAS_COMPROBANTE;

  return (
    <div data-testid="operacion-factura-percepciones">
      <div style={styles.sectionHeaderRow}>
        <div style={styles.title}>Percepciones de la factura</div>
      </div>

      <div css={styles.tableCard}>
        <div css={styles.columnsHeader} aria-hidden="true">
          <div>PERCEPCIÓN</div>
          <div style={{ textAlign: "right" }}>IMPORTE</div>
          <div />
        </div>

        <div css={styles.linesList}>
          {draft.percepciones.length === 0 ? (
            <p style={styles.empty}>Sin percepciones. Agregalas si la factura las incluye.</p>
          ) : (
            draft.percepciones.map((linea, index) => (
              <div key={linea.key} css={styles.lineRow} data-testid={`operacion-factura-percepcion-${index}`}>
                <Autocomplete
                  options={PERCEPCION_OPTIONS}
                  value={linea.percepcion}
                  onChange={(value) => updatePercepcion(linea.key, { percepcion: value })}
                  allowCustomValue
                  disabled={isSubmitting}
                  placeholder="Elegí o escribí una percepción"
                  aria-label={`Percepción ${index + 1}`}
                  maxLength={200}
                  dataTestId={`operacion-factura-percepcion-${index}-tipo`}
                  style={{ minWidth: 0 }}
                  inputStyle={{ height: 44 }}
                />
                <input
                  style={styles.moneyInput}
                  value={linea.importe}
                  disabled={isSubmitting}
                  inputMode="decimal"
                  placeholder="0,00"
                  aria-label={`Importe de la percepción ${index + 1}`}
                  onChange={(event) =>
                    updatePercepcion(linea.key, { importe: event.target.value.replace(/[^0-9.,]/g, "") })
                  }
                  data-testid={`operacion-factura-percepcion-${index}-importe`}
                />
                <IconButton
                  icon={<Trash2 />}
                  size={16}
                  onClick={() => removePercepcion(linea.key)}
                  title="Quitar percepción"
                  ariaLabel={`Quitar percepción ${index + 1}`}
                  data-testid={`operacion-factura-percepcion-${index}-remove`}
                  style={styles.trashBtn}
                />
              </div>
            ))
          )}
        </div>
      </div>

      <div style={styles.footerRow}>
        <Button
          type="button"
          onClick={addPercepcion}
          disabled={isSubmitting || limiteAlcanzado}
          dataTestId="operacion-factura-agregar-percepcion"
          text="Agregar percepción"
          icon={<Plus size={16} />}
          outline
        />
        <div style={styles.totales} data-testid="operacion-factura-totales">
          <span>Conceptos: <strong>{formatArs(totalConceptos)}</strong></span>
          <span>Percepciones: <strong>{formatArs(totalPercepciones)}</strong></span>
          <span>Total factura: <strong style={styles.totalStrong}>{formatArs(totalFactura)}</strong></span>
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
  }),
  lineRow: css({
    display: "grid",
    gridTemplateColumns: PERCEPCION_GRID_TEMPLATE,
    gap: 10,
    alignItems: "center",
    "@media (max-width: 720px)": {
      gridTemplateColumns: "1fr 120px 44px",
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
  footerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 10,
  } as const,
  totales: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
  } as const,
  totalStrong: {
    color: COLOR.TEXT.PRIMARY,
  } as const,
} as const;
