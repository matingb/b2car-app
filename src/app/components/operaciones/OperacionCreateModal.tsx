"use client";

import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import { css } from "@emotion/react";
import { COLOR } from "@/theme/theme";
import { useOperaciones } from "@/app/providers/OperacionesProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { productosClient } from "@/clients/productosClient";
import { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import Dropdown from "@/app/components/ui/Dropdown";
import type { ProductoDTO } from "@/model/dtos";
import type { TipoOperacion } from "@/model/types";
import {
  Plus,
  Truck,
  Receipt,
  Wrench,
} from "lucide-react";
import OperacionLineaEditor, {
  OPERACION_LINE_GRID_TEMPLATE,
  type OperacionLineaDraft,
} from "./OperacionLineaEditor";
import { formatArs } from "@/lib/format";

type TallerLite = { id: string; nombre: string };

type Props = {
  open: boolean;
  talleres: TallerLite[];
  onClose: () => void;
};

type OperacionTipoUi = TipoOperacion;

type ProductoLite = {
  id: string;
  nombre: string;
  codigo: string;
  precio_unitario: number;
  costo_unitario: number;
};

type LineaDraft = OperacionLineaDraft;

function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function createEmptyLinea(): LineaDraft {
  return {
    id: crypto.randomUUID?.() ?? String(Math.random()),
    productoId: "",
    cantidad: 1,
    unitario: 0,
    total: 0,
  };
}

function getDefaultUnitario(producto: ProductoLite, tipo: OperacionTipoUi) {
  return tipo === "VENTA"
    ? Number(producto.precio_unitario) || 0
    : Number(producto.costo_unitario) || 0;
}

const TIPOS_UI: Array<{
  tipo: OperacionTipoUi;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}> = [
  { tipo: "VENTA", label: "Venta", icon: <Receipt size={16} /> },
  { tipo: "COMPRA", label: "Compra", icon: <Truck size={16} /> },
];

export default function OperacionCreateModal({
  open,
  talleres,
  onClose,
}: Props) {
  const { create, loading } = useOperaciones();
  const { success, error } = useToast();

  const [tipo, setTipo] = useState<OperacionTipoUi | null>("VENTA");
  const [tallerId, setTallerId] = useState<string>("");
  const [productos, setProductos] = useState<ProductoLite[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [lineas, setLineas] = useState<LineaDraft[]>([createEmptyLinea()]);
  const didInitRef = React.useRef(false);
  const tipoConfigById = useMemo(
    () => new Map(TIPOS_UI.map((t) => [t.tipo, t])),
    [],
  );

  const isTipoEnabled = (value: OperacionTipoUi | null) => {
    if (!value) return false;
    return !tipoConfigById.get(value)?.disabled;
  };

  const hasManyTalleres = talleres.length > 1;

  useEffect(() => {
    if (!open) {
      didInitRef.current = false;
      return;
    }
    if (didInitRef.current) return;
    didInitRef.current = true;

    setTipo("VENTA");
    setLineas([createEmptyLinea()]);
    setTallerId(talleres.length === 1 ? talleres[0].id : "");
  }, [open, talleres]);

  useEffect(() => {
    if (!open) return;
    if (tallerId) return;
    if (talleres.length === 1) setTallerId(talleres[0].id);
  }, [open, talleres, tallerId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingProductos(true);
    void (async () => {
      try {
        const res = await productosClient.getAll();
        const data = (res.data ?? []) as unknown as ProductoDTO[];
        const mapped: ProductoLite[] = data.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          codigo: p.codigo,
          precio_unitario: Number(p.precio_unitario) || 0,
          costo_unitario: Number(p.costo_unitario) || 0,
        }));
        if (!cancelled) setProductos(mapped);
      } finally {
        if (!cancelled) setLoadingProductos(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Al cambiar tipo (si está habilitado), recalcular unitario desde producto y total
  useEffect(() => {
    if (!open) return;
    if (!tipo) return;
    if (!isTipoEnabled(tipo)) return;

    setLineas((prev) =>
      prev.map((linea) => {
        if (!linea.productoId) return linea;
        const prod = productos.find((p) => p.id === linea.productoId);
        if (!prod) return linea;
        const unitario = getDefaultUnitario(prod, tipo);
        const total = round2((Number(linea.cantidad) || 0) * unitario);
        return { ...linea, unitario, total };
      }),
    );
  }, [tipo, productos, open]);

  const productosById = useMemo(
    () => new Map(productos.map((p) => [p.id, p])),
    [productos],
  );

  const productoOptions = useMemo<AutocompleteOption[]>(
    () =>
      productos.map((p) => ({
        value: p.id,
        label: p.nombre,
        secondaryLabel: p.codigo,
      })),
    [productos],
  );

  const canSubmit = useMemo(() => {
    if (!open) return false;
    if (!tipo || !isTipoEnabled(tipo)) return false;
    if (!tallerId) return false;
    if (lineas.length === 0) return false;
    return lineas.every(
      (l) =>
        Boolean(l.productoId) &&
        Number(l.cantidad) > 0 &&
        Number.isFinite(l.unitario),
    );
  }, [open, tipo, tallerId, lineas, tipoConfigById]);

  const setLineaAt = (idx: number, nextLinea: LineaDraft) => {
    setLineas((prev) => prev.map((l, i) => (i === idx ? nextLinea : l)));
  };

  const addLinea = () => setLineas((prev) => [...prev, createEmptyLinea()]);
  const removeLinea = (idx: number) =>
    setLineas((prev) => prev.filter((_, i) => i !== idx));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !tipo) return;

    try {
      const payload = {
        tipo,
        taller_id: tallerId,
        lineas: lineas.map((l) => {
          const cantidad = Number(l.cantidad) || 0;
          const unitario = Number(l.unitario) || 0;
          const delta = tipo === "VENTA" ? -cantidad : cantidad;
          return {
            producto_id: l.productoId,
            cantidad,
            monto_unitario: unitario,
            delta_cantidad: delta,
          };
        }),
      };

      const created = await create(payload);
      if (created) {
        success("Operación creada");
        onClose();
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "No se pudo crear la operación";
      error("Error creando operación", msg);
    }
  };

  return (
    <Modal
      open={open}
      title="Nueva operación"
      onClose={onClose}
      onSubmit={onSubmit}
      submitText="Crear"
      submitting={loading}
      disabledSubmit={!canSubmit}
      modalStyle={{ width: "min(860px, 96vw)", overflowY: "auto" }}
    >
      <div style={{ padding: "8px 0 12px" , minHeight: "385px" }}>
        <div css={styles.headerRow}>
          <div style={styles.headerLeft}>
            {hasManyTalleres ? (
              <>
                <label style={styles.label}>Taller</label>
                <Dropdown
                  value={tallerId || ""}
                  onChange={(v) => setTallerId(v)}
                  options={[
                    { value: "", label: "Seleccionar taller…" },
                    ...talleres.map((t) => ({ value: t.id, label: t.nombre })),
                  ]}
                  data-testid="operaciones-create-taller"
                  style={{ height: 44, padding: "10px 12px", fontSize: 14 }}
                />
              </>
            ) : (
              <div />
            )}
          </div>

          <div style={styles.headerRight}>
            <label style={styles.label}>Tipo de operación</label>
            <div css={styles.tipoRow}>
              {TIPOS_UI.map((t) => {
                const isSelected = tipo === t.tipo;
                const isDisabled = Boolean(t.disabled);
                return (
                  <span key={t.tipo} css={styles.tooltipWrap}>
                    <button
                      type="button"
                      onClick={() => !isDisabled && setTipo(t.tipo)}
                      disabled={isDisabled}
                      data-testid={`operaciones-create-tipo-${t.tipo}`}
                      css={[
                        styles.tipoChip,
                        isSelected && styles.tipoChipSelected,
                        isDisabled && styles.tipoChipDisabled,
                      ]}
                    >
                      {t.icon ? (
                        <span style={{ display: "flex" }}>{t.icon}</span>
                      ) : null}
                      <span>{t.label}</span>
                    </button>
                    {isDisabled ? (
                      <span css={styles.tooltip} className="operaciones-tooltip">
                        En construcción
                      </span>
                    ) : null}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={styles.sectionHeaderRow}>
            <div style={styles.sectionTitleWrap}>
              <div style={styles.linesTitle}>Detalle de Productos</div>
            </div>
          </div>

          <div css={styles.columnsHeader} aria-hidden="true">
            <div>PRODUCTO</div>
            <div style={{ textAlign: "center" }}>CANT.</div>
            <div style={{ textAlign: "right" }}>UNITARIO</div>
            <div style={{ textAlign: "right" }}>TOTAL</div>
            <div />
          </div>

          <div css={styles.linesList}>
          {lineas.map((l, idx) => {
            const disabled = !tipo || !isTipoEnabled(tipo);
            const tipoLinea = !tipo || !isTipoEnabled(tipo) ? null : tipo;
            const getDefaultUnitarioForProductoId = (productoId: string) => {
              if (!tipoLinea) return null;
              const prod = productosById.get(productoId);
              if (!prod) return null;
              return getDefaultUnitario(prod, tipoLinea);
            };
            return (
              <OperacionLineaEditor
                key={l.id}
                index={idx}
                linea={l}
                disabled={disabled}
                loadingProductos={loadingProductos}
                productoOptions={productoOptions}
                getDefaultUnitarioForProductoId={getDefaultUnitarioForProductoId}
                onChange={(next) => setLineaAt(idx, next)}
                onRemove={() => removeLinea(idx)}
                canRemove={lineas.length > 1}
              />
            );
          })}
          </div>

          <div style={styles.addAndTotalRow}>
            <button
              type="button"
              onClick={addLinea}
              disabled={!tipo || !isTipoEnabled(tipo)}
              css={styles.addLineaBtn}
              data-testid="operaciones-add-line"
              title={!tipo ? "Seleccioná un tipo para agregar líneas" : undefined}
              aria-label="Agregar producto"
            >
              <Plus size={16} />
              <span style={styles.addLineaText}>Agregar Producto</span>
            </button>

            <div style={styles.totalInline}>
              <div style={styles.totalInlineLabel}>TOTAL OPERACIÓN</div>
              <div style={styles.totalInlineValue}>
                {formatArs(lineas.reduce((acc, l) => acc + (Number(l.total) || 0), 0))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

const styles = {
  headerRow: css({
    display: "flex",
    gap: 12,
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 12,
  }),
  headerLeft: {
    minWidth: 240,
    maxWidth: 360,
    flex: "0 0 auto",
  } as const,
  headerRight: {
    flex: "1 1 auto",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-end",
  } as const,
  label: {
    display: "block",
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    marginBottom: 6,
  },
  tipoRow: css({
    display: "flex",
    alignItems: "stretch",
    gap: 8,
    flexWrap: "nowrap",
    paddingBottom: 2,
  }),
  tooltipWrap: css({
    position: "relative",
    display: "inline-flex",
    "&:hover .operaciones-tooltip, &:focus-within .operaciones-tooltip": {
      opacity: 1,
    },
  }),
  tooltip: css({
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: "calc(100% + 8px)",
    backgroundColor: "rgba(20, 20, 20, 0.95)",
    color: "white",
    padding: "6px 8px",
    borderRadius: 8,
    fontSize: 12,
    whiteSpace: "nowrap",
    opacity: 0,
    pointerEvents: "none",
    transition: "opacity 120ms ease",
    zIndex: 10,
    "::after": {
      content: '""',
      position: "absolute",
      top: "100%",
      left: "50%",
      transform: "translateX(-50%)",
      border: "6px solid transparent",
      borderTopColor: "rgba(20, 20, 20, 0.95)",
    },
  }),
  tipoChip: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.PRIMARY,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    whiteSpace: "nowrap",
    transition: "all 120ms ease",
    ":hover": {
      borderColor: COLOR.ACCENT.PRIMARY,
    },
  }),
  tipoChipSelected: css({
    backgroundColor: COLOR.ACCENT.PRIMARY,
    color: COLOR.TEXT.CONTRAST,
    borderColor: COLOR.ACCENT.PRIMARY,
    boxShadow: "0 0 0 2px rgba(0, 121, 149, 0.18)",
  }),
  tipoChipDisabled: css({
    opacity: 0.6,
    cursor: "default",
  }),
  linesTitle: {
    fontWeight: 600,
    fontSize: 14,
  } as const,
  sectionHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  } as const,
  sectionTitleWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  } as const,
  columnsHeader: css({
    display: "grid",
    gridTemplateColumns: OPERACION_LINE_GRID_TEMPLATE,
    gap: 10,
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    marginBottom: 10,
    width: "100%",
    [`@media (max-width: 720px)`]: {
      display: "none",
    },
  }),
  linesList: css({
    display: "flex",
    flexDirection: "column",
    gap: 10,
    width: "100%",
  }),
  addLineaBtn: css({
    display: "flex",
    alignItems: "center",
    gap: 6,
    height: 44,
    padding: "0 12px",
    borderRadius: 10,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    backgroundColor: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.PRIMARY,
    cursor: "pointer",
    "&:disabled": {
      opacity: 0.6,
      cursor: "default",
    },
  }),
  addLineaText: {
    fontWeight: 600,
    fontSize: 14,
  } as const,
  addAndTotalRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  } as const,
  totalInline: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-end",
    gap: 2,
  } as const,
  totalInlineLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
  } as const,
  totalInlineValue: {
    fontSize: 22,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
  } as const,
} as const;
