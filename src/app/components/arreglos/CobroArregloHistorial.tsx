"use client";

import React, { useMemo, useState } from "react";
import { css } from "@emotion/react";
import { ChevronDown, Trash2, Wallet } from "lucide-react";
import type { CobroArregloItem } from "@/model/types";
import { COLOR } from "@/theme/theme";
import { formatArs } from "@/lib/format";
import { formatDateLabel } from "@/lib/fechas";

interface CobroArregloHistorialProps {
  cobros: CobroArregloItem[];
  anulandoOpId?: string | null;
  onAnularCobro: (operacionId: string, importe: number) => void;
}

export default function CobroArregloHistorial({
  cobros,
  anulandoOpId,
  onAnularCobro,
}: CobroArregloHistorialProps) {
  const [isOpen, setIsOpen] = useState(false);

  const totalRegistrado = useMemo(() => {
    return cobros?.reduce((acc, item) => acc + (Number(item.importe) || 0), 0) ?? 0;
  }, [cobros]);

  if (!cobros || cobros.length === 0) {
    return null;
  }

  return (
    <div css={styles.historialContainer}>
      <button
        type="button"
        css={styles.headerButton}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        data-testid="cobros-historial-toggle"
      >
        <div css={styles.headerLeft}>
          <span css={styles.sectionTitle}>
            Cobros registrados previamente ({cobros.length})
          </span>
          <span css={styles.totalBadge}>
            {formatArs(totalRegistrado, { maxDecimals: 0 })}
          </span>
        </div>

        <ChevronDown
          size={16}
          css={styles.chevronIcon(isOpen)}
        />
      </button>

      {isOpen ? (
        <div css={styles.cobrosList} data-testid="cobros-historial-list">
          {cobros.map((cobro) => (
            <div key={cobro.operacion_id} css={styles.cobroRow}>
              <div css={styles.cobroInfo}>
                <div css={styles.cobroHeader}>
                  <span css={styles.cobroMonto}>{formatArs(cobro.importe)}</span>
                  <span css={styles.cobroFecha}>{formatDateLabel(cobro.fecha)}</span>
                </div>
                <div css={styles.cobroDetails}>
                  <Wallet size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  {cobro.cuenta_nombre}
                  {cobro.descripcion ? (
                    <span css={styles.cobroDesc}>• {cobro.descripcion}</span>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                css={styles.btnAnular}
                title="Anular este cobro"
                disabled={anulandoOpId === cobro.operacion_id}
                onClick={(e) => {
                  e.stopPropagation();
                  onAnularCobro(cobro.operacion_id, cobro.importe);
                }}
                data-testid={`btn-anular-cobro-${cobro.operacion_id}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  historialContainer: css({
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 8,
    paddingTop: 12,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
  }),
  headerButton: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
    textAlign: "left",
  }),
  headerLeft: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
  }),
  sectionTitle: css({
    fontSize: 13,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
  }),
  totalBadge: css({
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 10,
    backgroundColor: "#eef2f6",
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
  }),
  chevronIcon: (isOpen: boolean) =>
    css({
      color: COLOR.TEXT.PRIMARY,
      transition: "transform 0.2s ease",
      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
    }),
  cobrosList: css({
    display: "flex",
    flexDirection: "column",
    gap: 8,
    maxHeight: 180,
    overflowY: "auto",
  }),
  cobroRow: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
  }),
  cobroInfo: css({
    display: "flex",
    flexDirection: "column",
    gap: 2,
  }),
  cobroHeader: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
  }),
  cobroMonto: css({
    fontSize: 14,
    fontWeight: 700,
    color: COLOR.SEMANTIC.SUCCESS,
  }),
  cobroFecha: css({
    fontSize: 12,
    color: COLOR.TEXT.TERTIARY,
  }),
  cobroDetails: css({
    display: "flex",
    fontSize: 12,
    alignItems: "center",
    color: COLOR.TEXT.SECONDARY,
  }),
  cobroDesc: css({
    marginLeft: 4,
    color: COLOR.TEXT.TERTIARY,
  }),
  btnAnular: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    border: "none",
    borderRadius: 6,
    background: "transparent",
    color: COLOR.TEXT.TERTIARY,
    cursor: "pointer",
    transition: "all 0.15s",
    "&:hover": {
      color: COLOR.SEMANTIC.DANGER,
      background: "rgba(239, 68, 68, 0.1)",
    },
  }),
} as const;
