"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import { useOperaciones } from "@/app/providers/OperacionesProvider";
import { useInventario } from "@/app/providers/InventarioProvider";
import { useTenant } from "@/app/providers/TenantProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { operacionesClient } from "@/clients/operacionesClient";
import { finanzasClient } from "@/clients/finanzasClient";
import type { Operacion } from "@/model/types";
import type { StockItem } from "@/model/stock";
import type { CategoriaGastoFinanciero } from "@/model/finanzas";
import { formatDateLabel } from "@/lib/fechas";
import { formatArs } from "@/lib/format";
import { ROUTES } from "@/routing/routes";
import { Permission } from "@/lib/permissions";
import { COLOR } from "@/theme/theme";
import Color from "color";
import { css } from "@emotion/react";
import {
  ArrowLeft,
  CircleDollarSign,
  FileText,
  PackageCheck,
  Pencil,
  Receipt,
  Trash2,
  AlertCircle,
} from "lucide-react";

import OperacionPagoModal from "@/app/components/operaciones/OperacionPagoModal";
import OperacionStockConfirmModal from "@/app/components/operaciones/OperacionStockConfirmModal";
import OperacionCreateModal from "@/app/components/operaciones/OperacionCreateModal";
import FacturaElectronicaModal from "@/app/components/arreglos/FacturaElectronicaModal";
import RemitoCreateModal from "@/app/components/remitos/RemitoCreateModal";

function shortId(value?: string | null) {
  if (!value) return "-";
  return value.slice(0, 8).toUpperCase();
}

export default function OperacionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tenant = useTenant();
  const { talleres, hasPermission } = tenant;
  const canUseBilling = hasPermission(Permission.FacturasView);
  const canEmitRemitos = hasPermission(Permission.FacturasEdit);

  const { remove, refresh } = useOperaciones();
  const { getStockById } = useInventario();
  const { success, error: toastError } = useToast();
  const { confirm } = useModalMessage();

  const [operacion, setOperacion] = useState<Operacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stocksById, setStocksById] = useState<Record<string, StockItem>>({});
  const [isPagoModalOpen, setIsPagoModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isEditGastoOpen, setIsEditGastoOpen] = useState(false);
  const [isFacturaOpen, setIsFacturaOpen] = useState(false);
  const [isRemitoOpen, setIsRemitoOpen] = useState(false);

  const loadOperacion = useCallback(async () => {
    if (!params.id) return;
    try {
      const res = await operacionesClient.getById(params.id);
      if (res.error || !res.data) {
        setError(res.error || "Operación no encontrada");
        setOperacion(null);
      } else {
        const op = res.data;

        // Redirección contextual si corresponde
        if (op.tipo === "ASIGNACION_ARREGLO" || op.tipo === "COBRO_ARREGLO") {
          const arregloId = (op as unknown as { arreglo_id?: string }).arreglo_id;
          if (arregloId) {
            router.replace(`${ROUTES.arreglos}/${arregloId}`);
            return;
          }
        }
        if (op.tipo === "TRANSFERENCIA" || op.tipo === "INGRESO" || op.tipo === "APERTURA_CUENTA") {
          if (op.cuenta_financiera_id) {
            router.replace(`${ROUTES.cuentasFinancieras}/${op.cuenta_financiera_id}`);
            return;
          }
        }

        setOperacion(op);
        setError(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error cargando operación");
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    void loadOperacion();
  }, [loadOperacion]);

  // Cargar información de stocks de las líneas
  useEffect(() => {
    if (!operacion?.lineas) return;
    const missingIds = operacion.lineas
      .map((l) => l.stock_id)
      .filter((id): id is string => Boolean(id) && !stocksById[id]);

    if (missingIds.length === 0) return;

    let cancelled = false;
    void (async () => {
      const results = await Promise.all(
        missingIds.map((id) => getStockById(id).catch(() => null))
      );
      if (cancelled) return;

      setStocksById((prev) => {
        const next = { ...prev };
        missingIds.forEach((id, idx) => {
          const item = results[idx];
          if (item) next[id] = item;
        });
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [operacion?.lineas, getStockById, stocksById]);

  const isVenta = operacion?.tipo === "VENTA";
  const isCompra = operacion?.tipo === "COMPRA";
  const isGasto = operacion?.tipo === "GASTO";
  const isComercial = isVenta || isCompra;

  const tallerNombre = useMemo(() => {
    if (!operacion?.taller_id) return null;
    return talleres.find((t) => t.id === operacion.taller_id)?.nombre ?? shortId(operacion.taller_id);
  }, [operacion?.taller_id, talleres]);

  const totalCalculado = useMemo(() => {
    if (!operacion?.lineas) return 0;
    return operacion.lineas.reduce(
      (acc, l) => acc + (l.cantidad || 0) * (l.monto_unitario || 0),
      0
    );
  }, [operacion?.lineas]);

  const totalMonto = operacion?.monto_total ?? (isGasto ? Number(operacion?.monto) || 0 : totalCalculado);
  const totalPagado = operacion?.total_pagado ?? (operacion?.esta_pago ? totalMonto : 0);
  const saldoPendiente = operacion?.saldo_pendiente ?? Math.max(0, totalMonto - totalPagado);

  const tieneSaldoPendiente = saldoPendiente > 0 || operacion?.estado_pago === "PENDIENTE" || operacion?.estado_pago === "PARCIAL";
  const tieneStockPendiente = operacion?.estado_stock === "PENDIENTE" || operacion?.estado_stock === "PARCIAL";

  const handleDelete = async () => {
    if (!operacion) return;
    const ok = await confirm({
      title: "Eliminar operación",
      message: `¿Estás seguro de que querés eliminar esta operación (#${shortId(operacion.id)})? Se revertirán los movimientos de stock y caja asociados.`,
      acceptLabel: "Eliminar",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;

    try {
      if (operacion.tipo === "GASTO") {
        const gastoId = operacion.gasto_id ?? operacion.id;
        const res = await finanzasClient.eliminarGasto(gastoId);
        if (res.error) throw new Error(res.error);
      } else {
        await remove(operacion.id);
      }
      success("Operación eliminada", "La operación se eliminó correctamente.");
      router.push(ROUTES.operaciones);
    } catch (err: unknown) {
      toastError(
        "No se pudo eliminar",
        err instanceof Error ? err.message : "Error inesperado"
      );
    }
  };

  if (loading) {
    return (
      <div>
        <ScreenHeader
          title="Cargando operación..."
          hasBackButton={true}
        />
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (error || !operacion) {
    return (
      <div>
        <ScreenHeader
          title="Operación no encontrada"
          hasBackButton={true}
        />
        <Card style={{ padding: "24px 16px", textAlign: "center" }}>
          <AlertCircle size={40} color={COLOR.SEMANTIC.DANGER} style={{ margin: "0 auto 12px" }} />
          <h3 style={{ margin: "0 0 8px", color: COLOR.TEXT.PRIMARY }}>
            {error || "La operación solicitada no existe o fue eliminada."}
          </h3>
          <p style={{ color: COLOR.TEXT.SECONDARY, margin: "0 0 16px", fontSize: 14 }}>
            Verificá el enlace o regresá al listado de operaciones.
          </p>
          <Button
            text="Volver a Operaciones"
            icon={<ArrowLeft size={16} />}
            onClick={() => router.push(ROUTES.operaciones)}
          />
        </Card>
      </div>
    );
  }

  const opTitle = isVenta
    ? `Venta #${shortId(operacion.id)}`
    : isCompra
      ? `Compra #${shortId(operacion.id)}`
      : isGasto
        ? `Gasto #${shortId(operacion.id)}`
        : `Operación #${shortId(operacion.id)}`;

  const subtitleParts = [
    formatDateLabel(operacion.fecha || operacion.created_at),
    tallerNombre ? `Taller: ${tallerNombre}` : null,
  ].filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Cabecera */}
      <div css={styles.headerRow}>
        <ScreenHeader
          title={opTitle}
          subtitle={subtitleParts.join(" · ")}
          hasBackButton={true}
        />

        {/* Acciones principales */}
        <div css={styles.headerActions}>
          {tieneSaldoPendiente && (
            <Button
              text={isVenta ? "Registrar Cobro" : "Registrar Pago"}
              icon={<CircleDollarSign size={16} />}
              onClick={() => setIsPagoModalOpen(true)}
              dataTestId="operacion-detail-pago-btn"
            />
          )}

          {isComercial && tieneStockPendiente && (
            <Button
              text={isVenta ? "Confirmar Entrega" : "Confirmar Recepción"}
              icon={<PackageCheck size={16} />}
              onClick={() => setIsStockModalOpen(true)}
              dataTestId="operacion-detail-stock-btn"
              outline
            />
          )}

          {isVenta && canUseBilling && (
            <Button
              text="Factura AFIP"
              icon={<Receipt size={16} />}
              onClick={() => setIsFacturaOpen(true)}
              outline
            />
          )}

          {isVenta && canEmitRemitos && (
            <Button
              text="Remito"
              icon={<FileText size={16} />}
              onClick={() => setIsRemitoOpen(true)}
              outline
            />
          )}

          {isGasto && (
            <Button
              text="Editar gasto"
              icon={<Pencil size={16} />}
              onClick={() => setIsEditGastoOpen(true)}
              outline
            />
          )}

          <Button
            text="Eliminar"
            icon={<Trash2 size={16} />}
            onClick={handleDelete}
            outline
            style={{ borderColor: COLOR.SEMANTIC.DANGER, color: COLOR.SEMANTIC.DANGER }}
          />
        </div>
      </div>

      {/* Tarjeta de Resumen Comercial y Estado */}
      <div css={styles.cardsGrid}>
        <Card style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>Estado Financiero</span>
            <div style={styles.badgeGroup}>
              {operacion.estado_pago && (
                <span
                  css={[
                    styles.statusBadge,
                    operacion.estado_pago === "PAGADO"
                      ? styles.badgeSuccess
                      : operacion.estado_pago === "PARCIAL"
                        ? styles.badgeWarning
                        : styles.badgeDanger,
                  ]}
                >
                  {operacion.estado_pago === "PAGADO"
                    ? (isVenta ? "Cobrado" : "Pagado")
                    : operacion.estado_pago === "PARCIAL"
                      ? "Pago parcial"
                      : (isVenta ? "Por cobrar" : "Por pagar")}
                </span>
              )}
            </div>
          </div>

          <div style={styles.metricsRow}>
            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>Total Acordado</span>
              <strong style={styles.metricValue}>{formatArs(totalMonto)}</strong>
            </div>

            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>{isVenta ? "Total Cobrado" : "Total Pagado"}</span>
              <span style={{ ...styles.metricValue, color: COLOR.SEMANTIC.SUCCESS }}>
                {formatArs(totalPagado)}
              </span>
            </div>

            <div style={styles.metricItem}>
              <span style={styles.metricLabel}>Saldo Pendiente</span>
              <strong
                style={{
                  ...styles.metricValue,
                  color: saldoPendiente > 0 ? COLOR.SEMANTIC.WARNING : COLOR.TEXT.PRIMARY,
                }}
              >
                {formatArs(saldoPendiente)}
              </strong>
            </div>
          </div>
        </Card>

        {isComercial && (
          <Card style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>Estado de Mercadería / Stock</span>
              {operacion.estado_stock && operacion.estado_stock !== "NO_APLICA" && (
                <span
                  css={[
                    styles.statusBadge,
                    operacion.estado_stock === "ENTREGADO"
                      ? styles.badgeSuccess
                      : operacion.estado_stock === "PARCIAL"
                        ? styles.badgeWarning
                        : styles.badgeInfo,
                  ]}
                >
                  {operacion.estado_stock === "ENTREGADO"
                    ? (isVenta ? "Entregado" : "Recibido")
                    : operacion.estado_stock === "PARCIAL"
                      ? (isVenta ? "Entrega parcial" : "Recepción parcial")
                      : (isVenta ? "Mercadería reservada" : "En camino")}
                </span>
              )}
            </div>

            <div style={styles.stockSummaryContainer}>
              <p style={{ margin: 0, fontSize: 13, color: COLOR.TEXT.SECONDARY, lineHeight: 1.4 }}>
                {operacion.estado_stock === "ENTREGADO"
                  ? isVenta
                    ? "Toda la mercadería fue entregada y descontada del depósito del taller."
                    : "Toda la mercadería ingresó a estantería y se encuentra físicamente disponible."
                  : operacion.estado_stock === "PARCIAL"
                    ? isVenta
                      ? "Se realizaron entregas parciales al cliente. Resta entregar el saldo pendiente."
                      : "Se recibieron algunas unidades en taller. Resta ingresar mercadería en camino."
                    : isVenta
                      ? "La mercadería se encuentra reservada en el taller para su posterior entrega."
                      : "La mercadería está comprada y figura en camino al taller."}
              </p>
            </div>
          </Card>
        )}

        {isGasto && (
          <Card style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>Detalle del Gasto</span>
              <span style={styles.badgeInfoSimple}>{operacion.categoria_gasto || "GENERAL"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
              {operacion.descripcion && (
                <div>
                  <span style={{ color: COLOR.TEXT.SECONDARY }}>Descripción: </span>
                  <strong style={{ color: COLOR.TEXT.PRIMARY }}>{operacion.descripcion}</strong>
                </div>
              )}
              {operacion.cuenta_financiera_nombre && (
                <div>
                  <span style={{ color: COLOR.TEXT.SECONDARY }}>Cuenta financiera: </span>
                  <strong style={{ color: COLOR.TEXT.PRIMARY }}>{operacion.cuenta_financiera_nombre}</strong>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Observaciones si tiene */}
      {operacion.observaciones && operacion.observaciones.trim() && (
        <Card style={{ padding: "14px 16px" }}>
          <strong style={{ fontSize: 13, color: COLOR.TEXT.SECONDARY, display: "block", marginBottom: 4 }}>
            Observaciones:
          </strong>
          <p style={{ margin: 0, fontSize: 14, color: COLOR.TEXT.PRIMARY, whiteSpace: "pre-wrap" }}>
            {operacion.observaciones}
          </p>
        </Card>
      )}

      {/* Tabla de Productos / Líneas de Stock */}
      {isComercial && (operacion.lineas ?? []).length > 0 && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={styles.tableTitleRow}>
            <h3 style={{ margin: 0, fontSize: 16, color: COLOR.TEXT.PRIMARY }}>
              Productos / Repuestos ({operacion.lineas.length})
            </h3>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thRow}>
                  <th style={styles.th}>Producto</th>
                  <th style={{ ...styles.th, textAlign: "center" }}>Pactadas</th>
                  <th style={{ ...styles.th, textAlign: "center" }}>Cumplidas</th>
                  <th style={{ ...styles.th, textAlign: "center" }}>Pendientes</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Precio Unitario</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {operacion.lineas.map((linea) => {
                  const stock = stocksById[linea.stock_id];
                  const nombre = linea.nombre || stock?.nombre || `Ítem #${linea.id?.slice(0, 6)}`;
                  const codigo = linea.codigo || stock?.codigo;
                  const total = (linea.cantidad || 0) * (linea.monto_unitario || 0);
                  const cumplidas = linea.cantidad_cumplida ?? 0;
                  const pendiente = Math.max(0, (linea.cantidad || 0) - cumplidas);

                  return (
                    <tr key={linea.id} style={styles.tr}>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 600, color: COLOR.TEXT.PRIMARY }}>{nombre}</div>
                        {codigo && <div style={{ fontSize: 12, color: COLOR.TEXT.SECONDARY }}>{codigo}</div>}
                      </td>
                      <td style={{ ...styles.td, textAlign: "center", fontWeight: 600 }}>
                        {linea.cantidad}
                      </td>
                      <td style={{ ...styles.td, textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                            backgroundColor:
                              cumplidas === linea.cantidad
                                ? Color(COLOR.SEMANTIC.SUCCESS).alpha(0.12).toString()
                                : Color(COLOR.SEMANTIC.WARNING).alpha(0.12).toString(),
                            color: cumplidas === linea.cantidad ? COLOR.SEMANTIC.SUCCESS : COLOR.SEMANTIC.WARNING,
                          }}
                        >
                          {cumplidas}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: "center", fontWeight: 600 }}>
                        <span style={{ color: pendiente > 0 ? COLOR.SEMANTIC.WARNING : COLOR.TEXT.SECONDARY }}>
                          {pendiente}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        {formatArs(linea.monto_unitario)}
                      </td>
                      <td style={{ ...styles.td, textAlign: "right", fontWeight: 600 }}>
                        {formatArs(total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Historial de Pagos / Cobros */}
      {operacion.pagos && operacion.pagos.length > 0 && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={styles.tableTitleRow}>
            <h3 style={{ margin: 0, fontSize: 16, color: COLOR.TEXT.PRIMARY }}>
              Historial de Pagos y Cobros ({operacion.pagos.length})
            </h3>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thRow}>
                  <th style={styles.th}>Fecha</th>
                  <th style={styles.th}>Detalle / Referencia</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Importe</th>
                </tr>
              </thead>
              <tbody>
                {operacion.pagos.map((pago) => (
                  <tr key={pago.id} style={styles.tr}>
                    <td style={styles.td}>{formatDateLabel(pago.fecha || pago.created_at)}</td>
                    <td style={styles.td}>
                      {pago.descripcion || "Pago registrado"}
                      {pago.cuenta_financiera_nombre && (
                        <div style={{ fontSize: 12, color: COLOR.TEXT.SECONDARY }}>
                          Cuenta: {pago.cuenta_financiera_nombre}
                        </div>
                      )}
                    </td>
                    <td style={{ ...styles.td, textAlign: "right", fontWeight: 600, color: COLOR.SEMANTIC.SUCCESS }}>
                      {formatArs(pago.monto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modales de acción */}
      {isPagoModalOpen && (
        <OperacionPagoModal
          open={isPagoModalOpen}
          operacion={operacion}
          onClose={() => setIsPagoModalOpen(false)}
          onSuccess={() => {
            void loadOperacion();
            void refresh();
          }}
        />
      )}

      {isStockModalOpen && (
        <OperacionStockConfirmModal
          open={isStockModalOpen}
          operacion={operacion}
          onClose={() => setIsStockModalOpen(false)}
          onSuccess={() => {
            void loadOperacion();
            void refresh();
          }}
        />
      )}

      {isFacturaOpen && (
        <FacturaElectronicaModal
          open={isFacturaOpen}
          operacionId={operacion.id}
          onClose={() => setIsFacturaOpen(false)}
          onAuthorized={() => {
            void loadOperacion();
            void refresh();
          }}
        />
      )}

      {isRemitoOpen && (
        <RemitoCreateModal
          open={isRemitoOpen}
          operacionId={operacion.id}
          onClose={() => setIsRemitoOpen(false)}
          onEmitted={(remitoId) => router.push(`${ROUTES.remitos}/${remitoId}`)}
        />
      )}

      {isEditGastoOpen && (
        <OperacionCreateModal
          open={isEditGastoOpen}
          talleres={talleres}
          initialTipo="GASTO"
          gasto={{
            id: operacion.gasto_id ?? operacion.id,
            cuentaId: operacion.cuenta_financiera_id ?? "",
            categoria: (operacion.categoria_gasto as CategoriaGastoFinanciero) ?? "OTROS",
            importe: Number(operacion.monto) || totalMonto,
            fecha: operacion.fecha,
            descripcion: operacion.descripcion ?? "",
            observaciones: operacion.observaciones ?? null,
            arregloId: null,
            operacionId: null,
            createdAt: operacion.created_at,
            updatedAt: operacion.created_at,
          }}
          onClose={() => {
            setIsEditGastoOpen(false);
            void loadOperacion();
            void refresh();
          }}
        />
      )}
    </div>
  );
}

const styles = {
  headerRow: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 12,
  }),
  headerActions: css({
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  }),
  cardsGrid: css({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 16,
  }),
  card: {
    padding: "16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 14,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    textTransform: "uppercase" as const,
    letterSpacing: "0.03em",
  },
  badgeGroup: {
    display: "flex",
    gap: 6,
  },
  statusBadge: css({
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 10px",
    borderRadius: 14,
    fontSize: 12,
    fontWeight: 600,
  }),
  badgeSuccess: css({
    backgroundColor: Color(COLOR.SEMANTIC.SUCCESS).alpha(0.12).toString(),
    color: COLOR.SEMANTIC.SUCCESS,
  }),
  badgeWarning: css({
    backgroundColor: Color(COLOR.SEMANTIC.WARNING).alpha(0.12).toString(),
    color: COLOR.SEMANTIC.WARNING,
  }),
  badgeDanger: css({
    backgroundColor: Color(COLOR.SEMANTIC.DANGER).alpha(0.12).toString(),
    color: COLOR.SEMANTIC.DANGER,
  }),
  badgeInfo: css({
    backgroundColor: Color(COLOR.SEMANTIC.INFO).alpha(0.12).toString(),
    color: COLOR.SEMANTIC.INFO,
  }),
  badgeInfoSimple: {
    fontSize: 12,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 6,
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.PRIMARY,
  },
  metricsRow: {
    display: "flex",
    gap: 20,
    flexWrap: "wrap" as const,
  },
  metricItem: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
  },
  metricLabel: {
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
  },
  metricValue: {
    fontSize: 18,
    color: COLOR.TEXT.PRIMARY,
    fontWeight: 600,
  },
  stockSummaryContainer: {
    padding: "8px 10px",
    borderRadius: 6,
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
  },
  tableTitleRow: {
    padding: "14px 16px",
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 13,
  },
  thRow: {
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  th: {
    padding: "10px 14px",
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 600,
    textAlign: "left" as const,
  },
  tr: {
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  td: {
    padding: "12px 14px",
    color: COLOR.TEXT.PRIMARY,
  },
};
