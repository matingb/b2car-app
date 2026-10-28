"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { css } from "@emotion/react";
import { ShoppingCart } from "lucide-react";
import { COLOR, BREAKPOINTS } from "@/theme/theme";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import SearchBar from "@/app/components/ui/SearchBar";
import Can from "@/app/components/auth/Can";
import { Permission } from "@/lib/permissions";
import { proveedoresClient } from "@/clients/proveedores/proveedoresClient";
import type { ProveedorCuentaCorrienteResumen, ProveedorOperacionItemDTO } from "@/model/dtos";
import type { Operacion, TipoOperacion } from "@/model/types";
import type { StockItem } from "@/model/stock";
import LineDetalleOperacion from "@/app/components/operaciones/LineDetalleOperacion";
import { tipoConfig } from "@/app/components/operaciones/useOperacionDetalle";
import { OperacionesProvider } from "@/app/providers/OperacionesProvider";

export type ProveedorOperacionesTabProps = {
  proveedorId: string;
  proveedorNombre: string;
  resumen?: ProveedorCuentaCorrienteResumen | null;
  loading?: boolean;
  error?: string | null;
  onReload?: () => void;
  onNuevaCompra?: () => void;
  onOperacionUpdated?: () => void;
};

type FilterEstado = "todos" | "pendientes_pago" | "pagadas" | "pendientes_stock";

function mapToOperacion(op: ProveedorOperacionItemDTO, proveedorNombre: string): Operacion {
  return {
    id: op.id,
    tipo: (op.tipo as Operacion["tipo"]) || "COMPRA",
    fecha: op.fecha || op.created_at,
    created_at: op.created_at,
    monto_total: op.monto_total,
    total_pagado: op.total_pagado,
    saldo_pendiente: op.saldo_pendiente,
    esta_pago: op.saldo_pendiente === 0,
    estado_pago: op.estado_pago as Operacion["estado_pago"],
    estado_stock: op.estado_stock as Operacion["estado_stock"],
    observaciones: op.observaciones || undefined,
    taller_id: op.taller_id,
    proveedor_id: undefined,
    proveedor_nombre: proveedorNombre,
    lineas: (op.lineas ?? []).map((l) => ({
      id: l.id,
      operacion_id: l.operacion_id,
      stock_id: l.stock_id,
      cantidad: l.cantidad,
      cantidad_cumplida: l.cantidad_cumplida,
      monto_unitario: l.monto_unitario,
      delta_cantidad: l.delta_cantidad,
      created_at: l.created_at,
      nombre: l.nombre,
      codigo: l.codigo,
    })),
  };
}

export default function ProveedorOperacionesTab({
  proveedorId,
  proveedorNombre,
  resumen: controlledResumen,
  loading: controlledLoading,
  error: controlledError,
  onReload,
  onNuevaCompra,
  onOperacionUpdated,
}: ProveedorOperacionesTabProps) {
  const isControlled = controlledResumen !== undefined;

  const [internalData, setInternalData] = useState<ProveedorCuentaCorrienteResumen | null>(null);
  const [internalLoading, setInternalLoading] = useState(true);
  const [internalError, setInternalError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<FilterEstado>("todos");
  const [expandedOperacionId, setExpandedOperacionId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (isControlled) {
      onReload?.();
      return;
    }
    setInternalLoading(true);
    setInternalError(null);
    try {
      const res = await proveedoresClient.getOperaciones(proveedorId);
      if (res.error) throw new Error(res.error);
      setInternalData(res.data);
    } catch (err: unknown) {
      setInternalError(err instanceof Error ? err.message : "Error cargando operaciones del proveedor");
    } finally {
      setInternalLoading(false);
    }
  }, [isControlled, onReload, proveedorId]);

  useEffect(() => {
    if (!isControlled) {
      void loadData();
    }
  }, [isControlled, loadData]);

  const data = isControlled ? controlledResumen : internalData;
  const loading = isControlled ? (controlledLoading ?? false) : internalLoading;
  const error = isControlled ? (controlledError ?? null) : internalError;

  const rawOperaciones = useMemo(() => data?.operaciones ?? [], [data]);

  const operaciones = useMemo(() => {
    return rawOperaciones.map((op) => mapToOperacion(op, proveedorNombre));
  }, [rawOperaciones, proveedorNombre]);

  const stocksById = useMemo(() => {
    const map: Record<string, StockItem> = {};
    operaciones.forEach((op) => {
      (op.lineas ?? []).forEach((l) => {
        if (l.stock_id && (l.nombre || l.codigo)) {
          map[l.stock_id] = {
            id: l.stock_id,
            nombre: l.nombre || "",
            codigo: l.codigo || "",
            cantidad: 0,
            precio_venta: 0,
            costo_promedio: 0,
            taller_id: "",
            producto_id: "",
          } as unknown as StockItem;
        }
      });
    });
    return map;
  }, [operaciones]);

  const operacionesFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return operaciones.filter((op) => {
      // Filtro de búsqueda
      if (q) {
        const idMatch = op.id.toLowerCase().includes(q);
        const obsMatch = op.observaciones?.toLowerCase().includes(q) ?? false;
        const lineasMatch = (op.lineas ?? []).some(
          (l) =>
            l.nombre?.toLowerCase().includes(q) ||
            l.codigo?.toLowerCase().includes(q)
        );
        if (!idMatch && !obsMatch && !lineasMatch) return false;
      }

      // Filtro de estado
      const saldo = op.saldo_pendiente ?? 0;
      if (filterEstado === "pendientes_pago") {
        return saldo > 0 || op.estado_pago === "PENDIENTE" || op.estado_pago === "PARCIAL";
      }
      if (filterEstado === "pagadas") {
        return op.estado_pago === "PAGADO" || saldo === 0;
      }
      if (filterEstado === "pendientes_stock") {
        return op.estado_stock === "PENDIENTE" || op.estado_stock === "PARCIAL";
      }

      return true;
    });
  }, [operaciones, search, filterEstado]);

  const handleOperacionSuccess = () => {
    if (isControlled && onReload) {
      onReload();
    } else {
      void loadData();
    }
    onOperacionUpdated?.();
  };

  if (loading && !data) {
    return <div style={styles.loadingContainer}>Cargando operaciones del proveedor...</div>;
  }

  if (error && !data) {
    return (
      <Card style={styles.errorCard}>
        <div style={{ color: COLOR.SEMANTIC.DANGER, fontWeight: 600 }}>{error}</div>
        <div style={{ marginTop: 12 }}>
          <Button text="Reintentar" onClick={isControlled && onReload ? onReload : loadData} outline />
        </div>
      </Card>
    );
  }

  return (
    <OperacionesProvider>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Toolbar: buscador y botón de nueva compra */}
        <div css={styles.toolbar}>
          <div style={styles.searchWrapper}>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Buscar por código, producto..."
              inputTestId="proveedor-operaciones-search"
            />
          </div>

          {onNuevaCompra && (
            <Can permission={Permission.OperacionesEdit}>
              <Button
                icon={<ShoppingCart size={16} />}
                text="Nueva Compra"
                onClick={onNuevaCompra}
                dataTestId="proveedor-operaciones-nueva-compra-btn"
              />
            </Can>
          )}
        </div>

        {/* Chips de filtro rápido */}
        {operaciones.length > 0 && (
          <div css={styles.chipsContainer} role="group" aria-label="Filtrar por estado">
            <button
              type="button"
              onClick={() => setFilterEstado("todos")}
              css={[styles.chip, filterEstado === "todos" && styles.chipActive]}
              data-testid="filtro-todos"
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setFilterEstado("pendientes_pago")}
              css={[styles.chip, filterEstado === "pendientes_pago" && styles.chipActive]}
              data-testid="filtro-pendientes-pago"
            >
              Pendientes de pago
            </button>
            <button
              type="button"
              onClick={() => setFilterEstado("pendientes_stock")}
              css={[styles.chip, filterEstado === "pendientes_stock" && styles.chipActive]}
              data-testid="filtro-pendientes-stock"
            >
              Pendientes de entrega
            </button>
            <button
              type="button"
              onClick={() => setFilterEstado("pagadas")}
              css={[styles.chip, filterEstado === "pagadas" && styles.chipActive]}
              data-testid="filtro-pagadas"
            >
              Pagadas
            </button>
          </div>
        )}

        {/* Listado de LineDetalleOperacion (misma card que en la pantalla de operaciones) */}
        {operacionesFiltradas.length === 0 ? (
          <Card style={styles.emptyCard}>
            <ShoppingCart size={44} color={COLOR.ICON.MUTED} style={{ marginBottom: 12 }} />
            <div style={styles.emptyTitle}>
              {search.trim() || filterEstado !== "todos"
                ? "No se encontraron operaciones con los filtros aplicados"
                : "Sin operaciones comerciales"}
            </div>
            <div style={styles.emptySubtitle}>
              {search.trim() || filterEstado !== "todos"
                ? "Probá ajustando los términos de búsqueda o seleccionando otro filtro de estado."
                : `Aún no se han emitido órdenes de compra o gastos vinculados a ${proveedorNombre}. Al registrar compras, podrás hacer seguimiento de las entregas y registrar pagos desde aquí.`}
            </div>
            {onNuevaCompra && (
              <Can permission={Permission.OperacionesEdit}>
                <div style={{ marginTop: 16 }}>
                  <Button
                    icon={<ShoppingCart size={16} />}
                    text="Registrar Compra"
                    onClick={onNuevaCompra}
                  />
                </div>
              </Can>
            )}
          </Card>
        ) : (
          <div style={styles.cardsList}>
            {operacionesFiltradas.map((operacion) => {
              const tipo = (operacion.tipo as TipoOperacion) || "COMPRA";
              const config = tipoConfig[tipo] ?? tipoConfig.COMPRA;
              const isExpanded = expandedOperacionId === operacion.id;

              return (
                <div
                  key={operacion.id}
                  data-testid={`proveedor-operacion-card-${operacion.id}`}
                >
                  <LineDetalleOperacion
                    operacion={operacion}
                    tipoLabel={config.label}
                    tipoIcon={config.icon}
                    tipoColor={config.color}
                    tipoBg={config.bg}
                    tallerLabel={rawOperaciones.find((o) => o.id === operacion.id)?.taller_nombre ?? "—"}
                    stocksById={stocksById}
                    expanded={isExpanded}
                    onToggle={() => {
                      setExpandedOperacionId((prev) =>
                        prev === operacion.id ? null : operacion.id
                      );
                    }}
                    onPagoSuccess={handleOperacionSuccess}
                    onStockSuccess={handleOperacionSuccess}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </OperacionesProvider>
  );
}

const styles = {
  loadingContainer: {
    padding: "36px 0",
    textAlign: "center" as const,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 14,
  },
  errorCard: {
    padding: 24,
    textAlign: "center" as const,
  },
  toolbar: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      flexDirection: "column",
      alignItems: "stretch",
    },
  }),
  searchWrapper: {
    flex: 1,
    minWidth: 0,
  },
  chipsContainer: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  }),
  chip: css({
    background: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 20,
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 500,
    color: COLOR.TEXT.SECONDARY,
    cursor: "pointer",
    transition: "all 150ms ease",
    "&:hover": {
      backgroundColor: COLOR.BACKGROUND.SUBTLE,
      color: COLOR.TEXT.PRIMARY,
    },
  }),
  chipActive: css({
    backgroundColor: "rgba(15, 118, 110, 0.12)",
    borderColor: COLOR.ACCENT.PRIMARY,
    color: COLOR.ACCENT.PRIMARY,
    fontWeight: 600,
    "&:hover": {
      backgroundColor: "rgba(15, 118, 110, 0.16)",
      color: COLOR.ACCENT.PRIMARY,
    },
  }),
  cardsList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
  emptyCard: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 24px",
    textAlign: "center" as const,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    maxWidth: 480,
    lineHeight: 1.5,
  },
};
