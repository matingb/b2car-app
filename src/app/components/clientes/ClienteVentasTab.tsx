"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { css } from "@emotion/react";
import { Receipt } from "lucide-react";
import { COLOR, BREAKPOINTS } from "@/theme/theme";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import SearchBar from "@/app/components/ui/SearchBar";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import Can from "@/app/components/auth/Can";
import { Permission } from "@/lib/permissions";
import { clientesClient } from "@/clients/clientes/clientesClient";
import type { ClienteOperacionesResumen, ClienteOperacionItemDTO } from "@/model/dtos";
import type { Operacion, TipoOperacion } from "@/model/types";
import type { StockItem } from "@/model/stock";
import LineDetalleOperacion from "@/app/components/operaciones/LineDetalleOperacion";
import { tipoConfig } from "@/app/components/operaciones/useOperacionDetalle";
import OperacionCreateModal from "@/app/components/operaciones/OperacionCreateModal";
import { OperacionesProvider } from "@/app/providers/OperacionesProvider";
import { InventarioProvider } from "@/app/providers/InventarioProvider";
import { useTenant } from "@/app/providers/TenantProvider";
import { useToast } from "@/app/providers/ToastProvider";

export type ClienteVentasTabProps = {
  clienteId: string;
  clienteNombre: string;
  onVentaUpdated?: () => void;
};

type FilterEstado = "todos" | "pendientes_pago" | "pagadas" | "pendientes_stock";

function mapToOperacion(op: ClienteOperacionItemDTO, clienteId: string, clienteNombre: string): Operacion {
  return {
    id: op.id,
    tipo: (op.tipo as Operacion["tipo"]) || "VENTA",
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
    cliente_id: clienteId,
    cliente_nombre: clienteNombre,
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

export default function ClienteVentasTab({
  clienteId,
  clienteNombre,
  onVentaUpdated,
}: ClienteVentasTabProps) {
  const { talleres } = useTenant();
  const toast = useToast();

  const [data, setData] = useState<ClienteOperacionesResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<FilterEstado>("todos");
  const [expandedOperacionId, setExpandedOperacionId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await clientesClient.getOperaciones(clienteId);
      if (res.error) throw new Error(res.error);
      setData(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error cargando ventas del cliente");
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const rawOperaciones = useMemo(() => data?.operaciones ?? [], [data]);

  const operaciones = useMemo(() => {
    return rawOperaciones.map((op) => mapToOperacion(op, clienteId, clienteNombre));
  }, [rawOperaciones, clienteId, clienteNombre]);

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
      // Búsqueda por texto
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
    void loadData();
    onVentaUpdated?.();
  };

  if (loading && !data) {
    return <ListSkeleton rows={4} />;
  }

  if (error && !data) {
    return (
      <Card style={styles.errorCard}>
        <div style={{ color: COLOR.SEMANTIC.DANGER, fontWeight: 600 }}>{error}</div>
        <div style={{ marginTop: 12 }}>
          <Button text="Reintentar" onClick={loadData} outline />
        </div>
      </Card>
    );
  }

  return (
    <OperacionesProvider>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Toolbar: buscador y botón de nueva venta */}
        <div css={styles.toolbar}>
          <div style={styles.searchWrapper}>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Buscar por código, producto..."
              inputTestId="cliente-ventas-search"
            />
          </div>

          <Can permission={Permission.OperacionesEdit}>
            <Button
              icon={<Receipt size={16} />}
              text="Nueva Venta"
              onClick={() => setCreateModalOpen(true)}
              dataTestId="cliente-ventas-nueva-venta-btn"
            />
          </Can>
        </div>

        {/* Chips de filtro rápido */}
        {operaciones.length > 0 && (
          <div css={styles.chipsContainer} role="group" aria-label="Filtrar por estado">
            <button
              type="button"
              onClick={() => setFilterEstado("todos")}
              css={[styles.chip, filterEstado === "todos" && styles.chipActive]}
              data-testid="filtro-ventas-todos"
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setFilterEstado("pendientes_pago")}
              css={[styles.chip, filterEstado === "pendientes_pago" && styles.chipActive]}
              data-testid="filtro-ventas-pendientes-pago"
            >
              Pendientes de cobro
            </button>
            <button
              type="button"
              onClick={() => setFilterEstado("pendientes_stock")}
              css={[styles.chip, filterEstado === "pendientes_stock" && styles.chipActive]}
              data-testid="filtro-ventas-pendientes-stock"
            >
              Pendientes de entrega
            </button>
            <button
              type="button"
              onClick={() => setFilterEstado("pagadas")}
              css={[styles.chip, filterEstado === "pagadas" && styles.chipActive]}
              data-testid="filtro-ventas-pagadas"
            >
              Cobradas
            </button>
          </div>
        )}

        {/* Listado de LineDetalleOperacion */}
        {operacionesFiltradas.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Receipt size={44} color={COLOR.ICON.MUTED} style={{ marginBottom: 12 }} />
            <div style={styles.emptyTitle}>
              {search.trim() || filterEstado !== "todos"
                ? "No se encontraron ventas con los filtros aplicados"
                : "Sin ventas registradas"}
            </div>
            <div style={styles.emptySubtitle}>
              {search.trim() || filterEstado !== "todos"
                ? "Probá ajustando los términos de búsqueda o seleccionando otro filtro de estado."
                : `Aún no se han registrado ventas de repuestos o accesorios para ${clienteNombre}. Al registrar ventas directas, podrás hacer seguimiento de las entregas y registrar cobros desde acá.`}
            </div>
            <Can permission={Permission.OperacionesEdit}>
              <div style={{ marginTop: 16 }}>
                <Button
                  icon={<Receipt size={16} />}
                  text="Registrar Venta"
                  onClick={() => setCreateModalOpen(true)}
                  dataTestId="cliente-ventas-empty-registrar-btn"
                />
              </div>
            </Can>
          </Card>
        ) : (
          <div style={styles.cardsList}>
            {operacionesFiltradas.map((operacion) => {
              const tipo = (operacion.tipo as TipoOperacion) || "VENTA";
              const config = tipoConfig[tipo] ?? tipoConfig.VENTA;
              const isExpanded = expandedOperacionId === operacion.id;

              return (
                <div
                  key={operacion.id}
                  data-testid={`cliente-venta-card-${operacion.id}`}
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
                    showDocumentos={true}
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

        {/* Modal de Nueva Venta */}
        {createModalOpen && (
          <InventarioProvider>
            <OperacionCreateModal
              open={createModalOpen}
              talleres={talleres}
              initialTipo="VENTA"
              initialClienteId={clienteId}
              disabledCliente
              onClose={() => setCreateModalOpen(false)}
              onSuccess={async () => {
                setCreateModalOpen(false);
                toast.success("Venta registrada", `Se registró la venta para ${clienteNombre}.`);
                void loadData();
                onVentaUpdated?.();
              }}
            />
          </InventarioProvider>
        )}
      </div>
    </OperacionesProvider>
  );
}

const styles = {
  toolbar: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
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
    gap: 8,
    overflowX: "auto",
    paddingBottom: 4,
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": { display: "none" },
  }),
  chip: css({
    padding: "6px 14px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 500,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    color: COLOR.TEXT.SECONDARY,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 150ms ease",
    "&:hover": {
      backgroundColor: COLOR.BACKGROUND.SUBTLE,
      color: COLOR.TEXT.PRIMARY,
    },
  }),
  chipActive: css({
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    borderColor: COLOR.ACCENT.PRIMARY,
    color: COLOR.ACCENT.PRIMARY,
    fontWeight: 600,
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
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 14,
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
  errorCard: {
    padding: 24,
    textAlign: "center" as const,
    backgroundColor: COLOR.BACKGROUND.PRIMARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
  },
};
