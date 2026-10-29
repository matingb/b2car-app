import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { css } from "@emotion/react";
import Card from "@/app/components/ui/Card";
import CardRightInfo from "@/app/components/ui/CardRightInfo";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { ROUTES } from "@/routing/routes";
import type { Operacion } from "@/model/types";
import type { StockItem } from "@/model/stock";
import { formatDateTimeLabel } from "@/lib/fechas";
import { formatArs } from "@/lib/format";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import {
  getOperacionTitle,
  useOperacionDetalle,
} from "./useOperacionDetalle";
import OperacionMeta from "./OperacionMeta";
import OperacionActions from "./OperacionActions";
import OperacionExpandedDetail from "./OperacionExpandedDetail";
import OperacionPagoBadge from "./OperacionPagoBadge";
import OperacionStockBadge from "./OperacionStockBadge";
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
  onClick?: (operacion: Operacion) => void;
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
  onClick,
  onDelete,
  onEdit,
  onInvoice,
  onRemito,
  showDocumentos = false,
  onPagoSuccess,
  onStockSuccess,
}: Props) {
  const router = useRouter();
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

  const isComercial = operacion.tipo === "VENTA" || operacion.tipo === "COMPRA";

  const priceColor = isSinCargo
    ? COLOR.TEXT.SECONDARY
    : operacion.tipo === "VENTA" || operacion.tipo === "COBRO_ARREGLO" || operacion.tipo === "INGRESO"
    ? COLOR.SEMANTIC.SUCCESS
    : operacion.tipo === "COMPRA" || operacion.tipo === "GASTO"
    ? COLOR.SEMANTIC.DANGER
    : operacion.tipo === "AJUSTE"
    ? COLOR.SEMANTIC.WARNING
    : COLOR.ACCENT.PRIMARY;

  const priceText = isSinCargo
    ? "Sin cargo"
    : formatArs(totalMonto, { maxDecimals: 0, minDecimals: 0 });

  const toggleLabel = expanded
    ? "Ocultar detalle"
    : isMovimientoFinanciero
    ? "Ver detalle del movimiento"
    : "Ver detalle";

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

  const handleCardClick = () => {
    if (onClick) {
      onClick(operacion);
      return;
    }
    if (detalleHref) {
      router.push(detalleHref);
    }
  };

  return (
    <Card style={styles.card} onClick={handleCardClick} data-testid={`operacion-card-${operacion.id}`}>
      <div css={styles.cardBody} style={styles.cardBodyStyle}>
        <div css={styles.mainInfoSection} style={styles.mainInfoSectionStyle}>
          <div css={styles.topRow} style={styles.topRowStyle}>
            <div
              css={[
                styles.iconWrap,
                { background: tipoBg, color: tipoColor },
              ]}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                background: tipoBg,
                color: tipoColor,
              }}
            >
              {tipoIcon}
            </div>
            <h4
              css={styles.mainTitle}
              style={styles.mainTitleStyle}
              title={title}
            >
              {title}
            </h4>
          </div>

          <div css={styles.metaRow}>
            <OperacionMeta
              metaBadge={metaBadge}
              accountOrWorkshop={
                accountOrWorkshop?.icon === Building2 ? null : accountOrWorkshop
              }
              tipo={operacion.tipo}
              clienteNombre={operacion.cliente_nombre}
              proveedorNombre={operacion.proveedor_nombre}
            />
          </div>

          {operacion.observaciones && operacion.observaciones.trim() ? (
            <div style={styles.observacionesContainer}>
              <FileText
                size={15}
                color={COLOR.ICON.MUTED}
                style={{ flexShrink: 0, marginTop: 2 }}
              />
              <span style={styles.observacionesText}>
                &quot;{operacion.observaciones.trim()}&quot;
              </span>
            </div>
          ) : null}
        </div>

        <CardRightInfo
          price={priceText}
          priceColor={priceColor}
          date={formatDateTimeLabel(operacion.fecha)}
          taller={tallerLabel}
        />
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

      <div css={styles.footerRow} data-isolate-hover="true">
        <div css={styles.footerLeft}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            css={styles.toggleButton}
            data-testid={`operacion-toggle-btn-${operacion.id}`}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            <span>{toggleLabel}</span>
          </button>

          {(isComercial || operacion.tipo === "GASTO") && !isSinCargo ? (
            <OperacionPagoBadge
              operacion={operacion}
              estado={operacion.estado_pago}
              saldoPendiente={operacion.saldo_pendiente}
              montoTotal={totalMonto}
              tipo={operacion.tipo}
              size="sm"
              onPagoUpdated={onPagoSuccess}
              dataTestId="operacion-pago-badge"
            />
          ) : null}

          {isComercial ? (
            <OperacionStockBadge
              operacion={operacion}
              estadoStock={operacion.estado_stock}
              tipo={operacion.tipo}
              size="sm"
              onStockUpdated={onStockSuccess}
              dataTestId="operacion-estado-stock-badge"
            />
          ) : null}
        </div>

        <div css={styles.footerRight}>
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
    </Card>
  );
}

const styles = {
  card: {
    cursor: "pointer",
    boxSizing: "border-box" as const,
    padding: 0,
    overflow: "visible",
    position: "relative" as const,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  cardBodyStyle: {
    minWidth: 0,
    width: "100%",
  },
  mainInfoSectionStyle: {
    minWidth: 0,
    overflow: "hidden",
  },
  topRowStyle: {
    minWidth: 0,
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
  },
  mainTitleStyle: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    minWidth: 0,
    maxWidth: "100%",
    flex: 1,
  },
  cardBody: css({
    display: "flex",
    flexDirection: "column",
    width: "100%",
    minWidth: 0,
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
      flexDirection: "row",
    },
  }),
  mainInfoSection: css({
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 8,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    [`@media (min-width: ${BREAKPOINTS.md}px)`]: {
      borderBottom: "none",
      borderRight: `1px solid ${COLOR.BORDER.SUBTLE}`,
      padding: "16px 20px",
    },
  }),
  topRow: css({
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
    width: "100%",
    overflow: "hidden",
  }),
  iconWrap: css({
    width: 36,
    height: 36,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  }),
  mainTitle: css({
    fontSize: 16,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
    margin: 0,
    lineHeight: 1.3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
    flex: 1,
    [`@media (max-width: ${BREAKPOINTS.md - 1}px)`]: {
      fontSize: 15,
    },
  }),
  metaRow: css({
    display: "flex",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
  }),
  observacionesContainer: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 2,
  },
  observacionesText: {
    fontSize: 13,
    fontStyle: "italic",
    fontWeight: 500,
    color: COLOR.TEXT.SECONDARY,
    lineHeight: 1.4,
  },
  footerRow: css({
    padding: "10px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
  }),
  footerLeft: css({
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  }),
  footerRight: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  }),
  toggleButton: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "transparent",
    border: "none",
    padding: "4px 8px",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    borderRadius: 6,
    transition: "color 0.15s ease, background-color 0.15s ease",
    "&:hover": {
      color: COLOR.TEXT.PRIMARY,
      backgroundColor: COLOR.BACKGROUND.SUBTLE,
    },
  }),
  expandedPanel: {
    overflow: "hidden",
    transition:
      "max-height 240ms ease, opacity 200ms ease, transform 200ms ease",
    transformOrigin: "top",
    backgroundColor: "#ffffff",
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  expandedPanelOpen: {
    maxHeight: 1200,
    opacity: 1,
    transform: "translateY(0)",
  },
  expandedPanelClosed: {
    maxHeight: 0,
    opacity: 0,
    transform: "translateY(-4px)",
    pointerEvents: "none" as const,
  },
  expandedContainer: {
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
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
} as const;
