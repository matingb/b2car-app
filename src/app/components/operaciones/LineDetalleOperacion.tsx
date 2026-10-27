import React, { useMemo } from "react";
import Link from "next/link";
import { css } from "@emotion/react";
import Card from "@/app/components/ui/Card";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { ROUTES } from "@/routing/routes";
import type { Operacion } from "@/model/types";
import type { StockItem } from "@/model/stock";
import { formatDateTimeLabel } from "@/lib/fechas";
import {
  getOperacionTitle,
  useOperacionDetalle,
} from "./useOperacionDetalle";
import OperacionMeta from "./OperacionMeta";
import OperacionActions from "./OperacionActions";
import OperacionExpandedDetail from "./OperacionExpandedDetail";
import DocumentosAsociadosList from "@/app/components/documentos/DocumentosAsociadosList";
import { useDocumentosAsociados } from "@/app/components/documentos/useDocumentosAsociados";

export { getOperacionTitle };

type Props = {
  operacion: Operacion;
  tipoLabel: string;
  tipoIcon: React.ReactNode;
  tipoColor: string;
  tipoBg: string;
  tallerLabel: string;
  stocksById: Record<string, StockItem>;
  expanded: boolean;
  onToggle: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onInvoice?: () => void;
  onRemito?: () => void;
  /** Muestra las facturas y remitos de la venta al expandir la línea. */
  showDocumentos?: boolean;
  onPagoSuccess?: () => void;
  onStockSuccess?: () => void;
};

export default function LineDetalleOperacion({
  operacion,
  tipoLabel,
  tipoIcon,
  tipoColor,
  tipoBg,
  tallerLabel,
  stocksById,
  expanded,
  onToggle,
  onDelete,
  onEdit,
  onInvoice,
  onRemito,
  showDocumentos = false,
  onPagoSuccess,
  onStockSuccess,
}: Props) {
  const {
    title,
    isGasto,
    isMovimientoFinanciero,
    isSinCargo,
    totalMonto,
    metaBadge,
    accountOrWorkshop,
    deleteTitle,
  } = useOperacionDetalle({
    operacion,
    tipoLabel,
    tallerLabel,
    stocksById,
  });
  // Se consulta al expandir para reflejar facturas o remitos emitidos desde la lista.
  const { documentos, cargando: cargandoDocumentos } = useDocumentosAsociados(
    showDocumentos && expanded ? { tipo: "VENTA", id: operacion.id } : null,
  );

  const detalleHref = useMemo(() => {
    if (operacion.tipo === "ASIGNACION_ARREGLO" || operacion.tipo === "COBRO_ARREGLO") {
      const arregloId = (operacion as unknown as { arreglo_id?: string }).arreglo_id;
      return arregloId ? `${ROUTES.arreglos}/${arregloId}` : null;
    }
    if (operacion.tipo === "TRANSFERENCIA" || operacion.tipo === "INGRESO" || operacion.tipo === "APERTURA_CUENTA") {
      return operacion.cuenta_financiera_id ? `${ROUTES.cuentasFinancieras}/${operacion.cuenta_financiera_id}` : null;
    }
    return `${ROUTES.operaciones}/${operacion.id}`;
  }, [operacion]);

  return (
    <Card style={styles.card} onClick={onToggle}>
      <div css={styles.container}>
        <div css={styles.headerRow}>
          <div css={styles.headerLeft}>
            <div
              css={[
                styles.iconWrap,
                { background: tipoBg, color: tipoColor },
              ]}
            >
              {tipoIcon}
            </div>
            <div css={styles.title}>{title}</div>
          </div>
          <div css={styles.date}>{formatDateTimeLabel(operacion.fecha)}</div>
        </div>

        <div css={[styles.metaRow, !expanded && styles.metaRowCollapsed]}>
          <OperacionMeta
            operacion={operacion}
            metaBadge={metaBadge}
            accountOrWorkshop={accountOrWorkshop}
            totalMonto={totalMonto}
            isSinCargo={isSinCargo}
            estadoPago={operacion.estado_pago}
            estadoStock={operacion.estado_stock}
            saldoPendiente={operacion.saldo_pendiente}
            tipo={operacion.tipo}
            clienteNombre={operacion.cliente_nombre}
            proveedorNombre={operacion.proveedor_nombre}
            onPagoUpdated={onPagoSuccess}
            onStockUpdated={onStockSuccess}
          />
          <OperacionActions
            isGasto={isGasto}
            deleteTitle={deleteTitle}
            onEdit={onEdit}
            onInvoice={onInvoice}
            onRemito={onRemito}
            onDelete={onDelete}
          />
        </div>
      </div>

      <div
        style={{
          ...styles.expandedPanel,
          ...(expanded ? styles.expandedPanelOpen : styles.expandedPanelClosed),
        }}
      >
        <div style={styles.expandedContainer}>
          <div style={styles.expandedHeader}>
            <div style={styles.expandedTitle}>
              {isMovimientoFinanciero
                ? "Detalle del movimiento"
                : "Productos"}
            </div>
            {detalleHref && (
              <Link
                href={detalleHref}
                onClick={(e) => e.stopPropagation()}
                style={styles.detailLink}
                data-testid={`operacion-detail-link-${operacion.id}`}
              >
                {operacion.tipo === "ASIGNACION_ARREGLO" || operacion.tipo === "COBRO_ARREGLO"
                  ? "Ver Arreglo ➔"
                  : operacion.tipo === "TRANSFERENCIA" || operacion.tipo === "INGRESO"
                    ? "Ver Cuenta ➔"
                    : "Ver detalle completo ➔"}
              </Link>
            )}
          </div>
          <OperacionExpandedDetail
            operacion={operacion}
            stocksById={stocksById}
            isMovimientoFinanciero={isMovimientoFinanciero}
          />
          {showDocumentos && (cargandoDocumentos || documentos.length > 0) ? (
            <section style={styles.documentos} aria-label="Documentos asociados">
              <div style={styles.expandedTitle}>Documentos asociados</div>
              <DocumentosAsociadosList documentos={documentos} cargando={cargandoDocumentos} />
            </section>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

const styles = {
  card: {
    cursor: "pointer",
  } as const,
  container: css({
    display: "flex",
    flexDirection: "column",
    gap: 6,
    width: "100%",
    minWidth: 0,
  }),
  headerRow: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  }),
  headerLeft: css({
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  }),
  iconWrap: css({
    height: 44,
    width: 44,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      height: "auto",
      width: "auto",
      borderRadius: 0,
      background: "transparent !important",
      padding: 0,
    },
  }),
  title: css({
    fontSize: 16,
    fontWeight: 600,
    [`@media (min-width: ${BREAKPOINTS.sm + 1}px)`]: {
      fontSize: 18,
    },
  }),
  date: css({
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    whiteSpace: "nowrap",
    flexShrink: 0,
  }),
  metaRow: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
  }),
  metaRowCollapsed: css({
    alignItems: "center",
    flexWrap: "nowrap",
    [`@media (min-width: ${BREAKPOINTS.sm + 1}px)`]: {
      flexWrap: "wrap",
    },
  }),
  expandedContainer: {
    marginTop: 12,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
    paddingTop: 12,
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  expandedPanel: {
    overflow: "hidden",
    transition:
      "max-height 240ms ease, opacity 200ms ease, transform 200ms ease",
    transformOrigin: "top",
  },
  expandedPanelOpen: {
    maxHeight: 1000,
    opacity: 1,
    transform: "translateY(0)",
  },
  expandedPanelClosed: {
    maxHeight: 0,
    opacity: 0,
    transform: "translateY(-4px)",
    pointerEvents: "none",
  },
  expandedHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  documentos: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    marginTop: 8,
    paddingTop: 12,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  expandedTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: COLOR.TEXT.SECONDARY,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  },
  detailLink: {
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.BUTTON.PRIMARY.BACKGROUND,
    textDecoration: "none",
    cursor: "pointer",
  },
} as const;
