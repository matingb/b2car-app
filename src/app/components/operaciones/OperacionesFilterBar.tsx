"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { css } from "@emotion/react";
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock,
  Receipt,
  RotateCcw,
  Truck,
  WalletCards,
  X,
} from "lucide-react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import Calendar from "@/app/components/ui/Calendar";
import type { PeriodOption } from "@/lib/dashboard/periods";
import { buildRangePeriod } from "@/lib/dashboard/periods";
import { toISODateLocal } from "@/lib/fechas";
import type { EstadoPagoOperacion, EstadoStockOperacion, TipoOperacion } from "@/model/types";
import { TIPOS_OPERACIONES } from "@/model/types";

export interface OperacionesFilterBarProps {
  // Tipo de operación
  selectedTipos: TipoOperacion[];
  onToggleTipo: (tipo: TipoOperacion) => void;
  // Períodos y Fechas
  period: PeriodOption;
  onPeriodChange: (period: PeriodOption) => void;
  fechaDesde: string;
  fechaHasta: string;
  onFechaDesdeChange: (value: string) => void;
  onFechaHastaChange: (value: string) => void;
  // Estados
  estadoPago: EstadoPagoOperacion | "";
  onEstadoPagoChange: (value: EstadoPagoOperacion | "") => void;
  estadoEntrega: EstadoStockOperacion | "";
  onEstadoEntregaChange: (value: EstadoStockOperacion | "") => void;
  // Acciones globales
  onClearAll: () => void;
  hasActiveFilters: boolean;
  isCustomPeriod: boolean;
  onResetPeriod: () => void;
}

const tipoMeta: Record<
  TipoOperacion,
  { label: string; icon: React.ReactNode; color: string }
> = {
  COMPRA: {
    label: "Compra",
    icon: <Truck size={14} />,
    color: COLOR.SEMANTIC.DANGER,
  },
  VENTA: {
    label: "Venta",
    icon: <Receipt size={14} />,
    color: COLOR.SEMANTIC.SUCCESS,
  },
  GASTO: {
    label: "Gasto",
    icon: <WalletCards size={14} />,
    color: COLOR.SEMANTIC.DANGER,
  },
  INGRESO: {
    label: "Ingreso",
    icon: <CircleDollarSign size={14} />,
    color: COLOR.SEMANTIC.SUCCESS,
  },
  ASIGNACION_ARREGLO: {
    label: "Asignación",
    icon: <Receipt size={14} />,
    color: COLOR.SEMANTIC.INFO,
  },
  COBRO_ARREGLO: {
    label: "Cobro",
    icon: <CircleDollarSign size={14} />,
    color: COLOR.SEMANTIC.SUCCESS,
  },
  AJUSTE: {
    label: "Ajuste",
    icon: <Receipt size={14} />,
    color: COLOR.SEMANTIC.WARNING,
  },
  APERTURA_CUENTA: {
    label: "Apertura",
    icon: <WalletCards size={14} />,
    color: COLOR.SEMANTIC.INFO,
  },
  AJUSTE_FINANCIERO: {
    label: "Ajuste fin.",
    icon: <Receipt size={14} />,
    color: COLOR.SEMANTIC.INFO,
  },
  TRANSFERENCIA: {
    label: "Transferencia",
    icon: <Receipt size={14} />,
    color: COLOR.SEMANTIC.DISABLED,
  },
  MOVIMIENTO_CUENTA: {
    label: "Movimiento",
    icon: <WalletCards size={14} />,
    color: COLOR.SEMANTIC.INFO,
  },
};

type ActiveDropdown = "periodo" | "pago" | "entrega" | null;

export default function OperacionesFilterBar({
  selectedTipos,
  onToggleTipo,
  period,
  onPeriodChange,
  fechaDesde,
  fechaHasta,
  onFechaDesdeChange,
  onFechaHastaChange,
  estadoPago,
  onEstadoPagoChange,
  estadoEntrega,
  onEstadoEntregaChange,
  onClearAll,
  hasActiveFilters,
  isCustomPeriod,
  onResetPeriod,
}: OperacionesFilterBarProps) {
  const [activeDropdown, setActiveDropdown] = useState<ActiveDropdown>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const now = useMemo(() => new Date(), []);

  // Cerrar dropdown al hacer clic fuera o presionar Escape
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      if (barRef.current?.contains(target)) return;
      // No cerrar si el clic ocurre dentro del popover del Calendar (que se monta en document.body con portal)
      if (
        target.closest?.('[role="dialog"]') ||
        target.closest?.('[aria-label="Selector de fecha"]') ||
        target.closest?.('[data-testid*="calendar"]')
      ) {
        return;
      }
      setActiveDropdown(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleDesdeChange = (value: string) => {
    onFechaDesdeChange(value);
    const hasta = fechaHasta || toISODateLocal(now);
    if (value && (!fechaHasta || value <= fechaHasta)) {
      const p = buildRangePeriod(value, hasta);
      if (p) onPeriodChange(p);
    }
  };

  const handleHastaChange = (value: string) => {
    onFechaHastaChange(value);
    const desde = fechaDesde || `${now.getFullYear()}-01-01`;
    if (value && (!fechaDesde || fechaDesde <= value)) {
      const p = buildRangePeriod(desde, value);
      if (p) onPeriodChange(p);
    }
  };

  return (
    <div
      ref={barRef}
      css={styles.barContainer}
      data-testid="operaciones-filter-bar"
      role="toolbar"
      aria-label="Barra de filtros de operaciones"
    >
      {/* 1. Chips de tipo de operación */}
      <div css={styles.tiposGroup}>
        {TIPOS_OPERACIONES.map((tipo) => {
          const meta = tipoMeta[tipo];
          const isSelected = selectedTipos.includes(tipo);
          return (
            <button
              key={tipo}
              type="button"
              data-testid={`operaciones-chip-${tipo}`}
              onClick={() => onToggleTipo(tipo)}
              css={[styles.chipPill, isSelected && styles.chipPillSelected]}
            >
              <span css={styles.chipIcon}>{meta.icon}</span>
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>

      <div css={styles.divider} aria-hidden="true" />

      {/* 2. Dropdown de Período */}
      <div css={styles.dropdownAnchor}>
        <button
          type="button"
          data-testid="operaciones-filter-periodo-trigger"
          css={[styles.filterPill, isCustomPeriod && styles.filterPillActiveAccent]}
          onClick={() => setActiveDropdown((prev) => (prev === "periodo" ? null : "periodo"))}
          aria-haspopup="dialog"
          aria-expanded={activeDropdown === "periodo"}
        >
          <CalendarIcon size={14} color={isCustomPeriod ? COLOR.ACCENT.PRIMARY : COLOR.TEXT.SECONDARY} />
          <span css={styles.pillText}>{period.label}</span>
          {isCustomPeriod ? (
            <span
              role="button"
              tabIndex={0}
              css={styles.clearMiniBtn}
              onClick={(e) => {
                e.stopPropagation();
                onResetPeriod();
              }}
              aria-label="Restablecer período"
              title="Restablecer período actual"
            >
              <X size={12} />
            </span>
          ) : (
            <ChevronDown
              size={13}
              css={styles.chevronIcon(activeDropdown === "periodo")}
            />
          )}
        </button>

        {activeDropdown === "periodo" && (
          <div
            css={styles.popoverMenu}
            style={{ width: 340, maxWidth: "calc(100vw - 32px)" }}
            data-testid="operaciones-periodo-popover"
          >
            <div css={styles.popoverHeader}>
              <span css={styles.popoverTitle}>Rango de fechas</span>
              {(isCustomPeriod || fechaDesde || fechaHasta) && (
                <button
                  type="button"
                  css={styles.subClearBtn}
                  onClick={() => {
                    onResetPeriod();
                  }}
                  data-testid="operaciones-filter-reset-periodo"
                >
                  Restablecer
                </button>
              )}
            </div>

            <div css={styles.dateInputsContainer}>
              <div css={styles.dateFieldsRow}>
                <div css={styles.dateFieldCol}>
                  <span css={styles.dateFieldSublabel}>Desde</span>
                  <Calendar
                    value={fechaDesde}
                    onChange={handleDesdeChange}
                    placeholder="dd/mm/aaaa"
                    dataTestId="operaciones-filter-fecha-desde"
                    max={fechaHasta || undefined}
                    style={{
                      padding: "8px 10px",
                      fontSize: 13,
                      height: 38,
                    }}
                  />
                </div>
                <div css={styles.dateFieldCol}>
                  <span css={styles.dateFieldSublabel}>Hasta</span>
                  <Calendar
                    value={fechaHasta}
                    onChange={handleHastaChange}
                    placeholder="dd/mm/aaaa"
                    dataTestId="operaciones-filter-fecha-hasta"
                    min={fechaDesde || undefined}
                    style={{
                      padding: "8px 10px",
                      fontSize: 13,
                      height: 38,
                    }}
                  />
                </div>
              </div>
            </div>

            <div css={styles.popoverFooter}>
              <button
                type="button"
                css={styles.applyDateBtn}
                onClick={() => setActiveDropdown(null)}
                data-testid="operaciones-filter-periodo-apply"
              >
                Listo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Dropdown de Estado de Pago */}
      <div css={styles.dropdownAnchor}>
        <button
          type="button"
          data-testid="operaciones-filter-pago-trigger"
          css={[
            styles.filterPill,
            estadoPago === "PAGADO" && styles.filterPillActiveSuccess,
            estadoPago === "PARCIAL" && styles.filterPillActiveWarning,
            estadoPago === "PENDIENTE" && styles.filterPillActiveDanger,
          ]}
          onClick={() => setActiveDropdown((prev) => (prev === "pago" ? null : "pago"))}
          aria-haspopup="listbox"
          aria-expanded={activeDropdown === "pago"}
        >
          <CircleDollarSign
            size={14}
            color={
              estadoPago === "PAGADO"
                ? COLOR.SEMANTIC.SUCCESS
                : estadoPago === "PARCIAL"
                ? COLOR.SEMANTIC.WARNING
                : estadoPago === "PENDIENTE"
                ? COLOR.SEMANTIC.DANGER
                : COLOR.TEXT.SECONDARY
            }
          />
          <span css={styles.pillText}>
            Pago:{" "}
            <strong>
              {estadoPago === "PAGADO"
                ? "Pagado"
                : estadoPago === "PARCIAL"
                ? "Parcial"
                : estadoPago === "PENDIENTE"
                ? "Pendiente"
                : "Todos"}
            </strong>
          </span>
          {estadoPago ? (
            <span
              role="button"
              tabIndex={0}
              css={styles.clearMiniBtn}
              onClick={(e) => {
                e.stopPropagation();
                onEstadoPagoChange("");
              }}
              aria-label="Limpiar filtro de pago"
            >
              <X size={12} />
            </span>
          ) : (
            <ChevronDown
              size={13}
              css={styles.chevronIcon(activeDropdown === "pago")}
            />
          )}
        </button>

        {activeDropdown === "pago" && (
          <div
            css={styles.dropdownMenu}
            style={{ minWidth: 185, width: "max-content" }}
            role="listbox"
            data-testid="operaciones-pago-menu"
          >
            <button
              type="button"
              data-testid="operaciones-filter-pago-TODOS"
              css={[styles.menuOptionItem, !estadoPago && styles.menuOptionItemSelected]}
              onClick={() => {
                onEstadoPagoChange("");
                setActiveDropdown(null);
              }}
            >
              <span>Todos los pagos</span>
              {!estadoPago && <Check size={14} color={COLOR.ACCENT.PRIMARY} />}
            </button>
            <button
              type="button"
              data-testid="operaciones-filter-pago-PAGADO"
              css={[styles.menuOptionItem, estadoPago === "PAGADO" && styles.menuOptionItemSelected]}
              onClick={() => {
                onEstadoPagoChange("PAGADO");
                setActiveDropdown(null);
              }}
            >
              <div css={styles.menuOptionLeft}>
                <CheckCircle2 size={14} color={COLOR.SEMANTIC.SUCCESS} />
                <span>Pagado</span>
              </div>
              {estadoPago === "PAGADO" && <Check size={14} color={COLOR.SEMANTIC.SUCCESS} />}
            </button>
            <button
              type="button"
              data-testid="operaciones-filter-pago-PARCIAL"
              css={[styles.menuOptionItem, estadoPago === "PARCIAL" && styles.menuOptionItemSelected]}
              onClick={() => {
                onEstadoPagoChange("PARCIAL");
                setActiveDropdown(null);
              }}
            >
              <div css={styles.menuOptionLeft}>
                <Clock size={14} color={COLOR.SEMANTIC.WARNING} />
                <span>Pago parcial</span>
              </div>
              {estadoPago === "PARCIAL" && <Check size={14} color={COLOR.SEMANTIC.WARNING} />}
            </button>
            <button
              type="button"
              data-testid="operaciones-filter-pago-PENDIENTE"
              css={[styles.menuOptionItem, estadoPago === "PENDIENTE" && styles.menuOptionItemSelected]}
              onClick={() => {
                onEstadoPagoChange("PENDIENTE");
                setActiveDropdown(null);
              }}
            >
              <div css={styles.menuOptionLeft}>
                <AlertCircle size={14} color={COLOR.SEMANTIC.DANGER} />
                <span>Pendiente</span>
              </div>
              {estadoPago === "PENDIENTE" && <Check size={14} color={COLOR.SEMANTIC.DANGER} />}
            </button>
          </div>
        )}
      </div>

      {/* 4. Dropdown de Estado de Entrega (Stock) */}
      <div css={styles.dropdownAnchor}>
        <button
          type="button"
          data-testid="operaciones-filter-entrega-trigger"
          css={[
            styles.filterPill,
            estadoEntrega === "ENTREGADO" && styles.filterPillActiveSuccess,
            estadoEntrega === "PARCIAL" && styles.filterPillActiveWarning,
            estadoEntrega === "PENDIENTE" && styles.filterPillActiveDanger,
          ]}
          onClick={() => setActiveDropdown((prev) => (prev === "entrega" ? null : "entrega"))}
          aria-haspopup="listbox"
          aria-expanded={activeDropdown === "entrega"}
        >
          <Truck
            size={14}
            color={
              estadoEntrega === "ENTREGADO"
                ? COLOR.SEMANTIC.SUCCESS
                : estadoEntrega === "PARCIAL"
                ? COLOR.SEMANTIC.WARNING
                : estadoEntrega === "PENDIENTE"
                ? COLOR.SEMANTIC.DANGER
                : COLOR.TEXT.SECONDARY
            }
          />
          <span css={styles.pillText}>
            Entrega:{" "}
            <strong>
              {estadoEntrega === "ENTREGADO"
                ? "Entregado"
                : estadoEntrega === "PARCIAL"
                ? "Parcial"
                : estadoEntrega === "PENDIENTE"
                ? "Pendiente"
                : "Todos"}
            </strong>
          </span>
          {estadoEntrega ? (
            <span
              role="button"
              tabIndex={0}
              css={styles.clearMiniBtn}
              onClick={(e) => {
                e.stopPropagation();
                onEstadoEntregaChange("");
              }}
              aria-label="Limpiar filtro de entrega"
            >
              <X size={12} />
            </span>
          ) : (
            <ChevronDown
              size={13}
              css={styles.chevronIcon(activeDropdown === "entrega")}
            />
          )}
        </button>

        {activeDropdown === "entrega" && (
          <div
            css={styles.dropdownMenu}
            style={{ minWidth: 225, width: "max-content" }}
            role="listbox"
            data-testid="operaciones-entrega-menu"
          >
            <button
              type="button"
              data-testid="operaciones-filter-entrega-TODOS"
              css={[styles.menuOptionItem, !estadoEntrega && styles.menuOptionItemSelected]}
              onClick={() => {
                onEstadoEntregaChange("");
                setActiveDropdown(null);
              }}
            >
              <span>Todas las entregas</span>
              {!estadoEntrega && <Check size={14} color={COLOR.ACCENT.PRIMARY} />}
            </button>
            <button
              type="button"
              data-testid="operaciones-filter-entrega-ENTREGADO"
              css={[styles.menuOptionItem, estadoEntrega === "ENTREGADO" && styles.menuOptionItemSelected]}
              onClick={() => {
                onEstadoEntregaChange("ENTREGADO");
                setActiveDropdown(null);
              }}
            >
              <div css={styles.menuOptionLeft}>
                <CheckCircle2 size={14} color={COLOR.SEMANTIC.SUCCESS} />
                <span>Entregado / Recibido</span>
              </div>
              {estadoEntrega === "ENTREGADO" && <Check size={14} color={COLOR.SEMANTIC.SUCCESS} />}
            </button>
            <button
              type="button"
              data-testid="operaciones-filter-entrega-PARCIAL"
              css={[styles.menuOptionItem, estadoEntrega === "PARCIAL" && styles.menuOptionItemSelected]}
              onClick={() => {
                onEstadoEntregaChange("PARCIAL");
                setActiveDropdown(null);
              }}
            >
              <div css={styles.menuOptionLeft}>
                <Clock size={14} color={COLOR.SEMANTIC.WARNING} />
                <span>Entrega parcial</span>
              </div>
              {estadoEntrega === "PARCIAL" && <Check size={14} color={COLOR.SEMANTIC.WARNING} />}
            </button>
            <button
              type="button"
              data-testid="operaciones-filter-entrega-PENDIENTE"
              css={[styles.menuOptionItem, estadoEntrega === "PENDIENTE" && styles.menuOptionItemSelected]}
              onClick={() => {
                onEstadoEntregaChange("PENDIENTE");
                setActiveDropdown(null);
              }}
            >
              <div css={styles.menuOptionLeft}>
                <AlertCircle size={14} color={COLOR.SEMANTIC.DANGER} />
                <span>Pendiente de entrega</span>
              </div>
              {estadoEntrega === "PENDIENTE" && <Check size={14} color={COLOR.SEMANTIC.DANGER} />}
            </button>
          </div>
        )}
      </div>

      {/* 5. Botón Limpiar filtros cuando hay filtros activos */}
      {hasActiveFilters && (
        <button
          type="button"
          css={styles.clearAllLink}
          onClick={onClearAll}
          data-testid="operaciones-clear-all-filters"
          title="Restablecer todos los filtros"
        >
          <RotateCcw size={12} />
          <span>Limpiar filtros</span>
        </button>
      )}
    </div>
  );
}

const styles = {
  barContainer: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    padding: "2px 0",
    position: "relative",
  }),
  tiposGroup: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  }),
  chipPill: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 32,
    padding: "0 11px",
    borderRadius: 16,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s ease",
    whiteSpace: "nowrap",
    "&:hover": {
      borderColor: COLOR.ACCENT.PRIMARY,
      backgroundColor: COLOR.BACKGROUND.SUBTLE,
    },
  }),
  chipPillSelected: css({
    backgroundColor: COLOR.BUTTON.PRIMARY.BACKGROUND,
    borderColor: COLOR.ACCENT.PRIMARY,
    color: COLOR.BUTTON.PRIMARY.TEXT,
    fontWeight: 600,
    boxShadow: "0 1px 4px rgba(0, 128, 162, 0.2)",
    "&:hover": {
      backgroundColor: COLOR.ACCENT.HOVER,
      borderColor: COLOR.ACCENT.HOVER,
    },
  }),
  chipIcon: css({
    display: "flex",
    alignItems: "center",
  }),
  divider: css({
    width: 1,
    height: 20,
    backgroundColor: COLOR.BORDER.SUBTLE,
    margin: "0 2px",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "none",
    },
  }),
  dropdownAnchor: css({
    position: "relative",
    display: "inline-block",
  }),
  filterPill: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 32,
    padding: "0 10px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s ease",
    whiteSpace: "nowrap",
    "&:hover": {
      borderColor: COLOR.ACCENT.PRIMARY,
      backgroundColor: COLOR.BACKGROUND.SUBTLE,
    },
  }),
  filterPillActiveAccent: css({
    borderColor: COLOR.ACCENT.PRIMARY,
    backgroundColor: "rgba(0, 128, 162, 0.08)",
    color: COLOR.ACCENT.PRIMARY,
    fontWeight: 600,
  }),
  filterPillActiveSuccess: css({
    borderColor: COLOR.SEMANTIC.SUCCESS,
    color: COLOR.SEMANTIC.SUCCESS,
    fontWeight: 600,
    "&:hover": {
      borderColor: COLOR.SEMANTIC.SUCCESS,
    },
  }),
  filterPillActiveWarning: css({
    borderColor: COLOR.SEMANTIC.WARNING,
    color: COLOR.SEMANTIC.WARNING,
    fontWeight: 600,
    "&:hover": {
      borderColor: COLOR.SEMANTIC.WARNING,
    },
  }),
  filterPillActiveDanger: css({
    borderColor: COLOR.SEMANTIC.DANGER,
    color: COLOR.SEMANTIC.DANGER,
    fontWeight: 600,
    "&:hover": {
      borderColor: COLOR.SEMANTIC.DANGER,
    },
  }),
  pillText: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
  }),
  clearMiniBtn: css({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 16,
    height: 16,
    borderRadius: 8,
    color: "inherit",
    opacity: 0.7,
    cursor: "pointer",
    marginLeft: 2,
    "&:hover": {
      opacity: 1,
      backgroundColor: "rgba(0, 0, 0, 0.08)",
    },
  }),
  chevronIcon: (isOpen: boolean) =>
    css({
      color: COLOR.TEXT.SECONDARY,
      transition: "transform 0.15s ease",
      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
      marginLeft: 1,
    }),
  dropdownMenu: css({
    position: "absolute",
    top: "calc(100% + 5px)",
    left: 0,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 10,
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
    padding: 4,
    zIndex: 100,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  }),
  menuOptionItem: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "7px 10px",
    borderRadius: 6,
    border: "none",
    background: "none",
    color: COLOR.TEXT.PRIMARY,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "left",
    whiteSpace: "nowrap",
    gap: 12,
    transition: "background-color 0.12s",
    "&:hover": {
      backgroundColor: COLOR.BACKGROUND.SUBTLE,
    },
  }),
  menuOptionItemSelected: css({
    fontWeight: 600,
  }),
  menuOptionLeft: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    whiteSpace: "nowrap",
  }),
  popoverMenu: css({
    position: "absolute",
    top: "calc(100% + 5px)",
    left: 0,
    backgroundColor: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    boxShadow: "0 10px 28px rgba(0, 0, 0, 0.14)",
    padding: "12px",
    zIndex: 100,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      left: "auto",
      right: 0,
    },
  }),
  popoverHeader: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 4,
  }),
  popoverTitle: css({
    fontSize: 13,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
  }),
  subClearBtn: css({
    background: "none",
    border: "none",
    color: COLOR.ACCENT.PRIMARY,
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    padding: 0,
    "&:hover": {
      textDecoration: "underline",
    },
  }),
  dateInputsContainer: css({
    display: "flex",
    flexDirection: "column",
    gap: 6,
  }),
  dateFieldsRow: css({
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  }),
  dateFieldCol: css({
    display: "flex",
    flexDirection: "column",
    gap: 3,
  }),
  dateFieldSublabel: css({
    fontSize: 11,
    fontWeight: 500,
    color: COLOR.TEXT.SECONDARY,
  }),
  popoverFooter: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingTop: 8,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
  }),
  applyDateBtn: css({
    padding: "6px 14px",
    borderRadius: 6,
    border: "none",
    backgroundColor: COLOR.BUTTON.PRIMARY.BACKGROUND,
    color: COLOR.BUTTON.PRIMARY.TEXT,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.15s",
    "&:hover": {
      backgroundColor: COLOR.ACCENT.HOVER,
    },
  }),
  clearAllLink: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    height: 32,
    padding: "0 8px",
    borderRadius: 6,
    border: "none",
    background: "none",
    color: COLOR.ACCENT.PRIMARY,
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.12s",
    "&:hover": {
      backgroundColor: COLOR.BACKGROUND.SUBTLE,
      textDecoration: "underline",
    },
  }),
};

