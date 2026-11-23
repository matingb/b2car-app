"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useOperaciones } from "@/app/providers/OperacionesProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useCuentasFinancieras } from "@/app/providers/CuentasFinancierasProvider";
import { useInventario } from "@/app/providers/InventarioProvider";
import { finanzasClient } from "@/clients/finanzasClient";
import { isValidDate, toISODateLocal, toISODateTimeWithLocalCurrentTime, toLocalDateInputFormat } from "@/lib/fechas";
import { generateUuidV4 } from "@/lib/uuid";
import { logger } from "@/lib/logger";
import type { EstadoPagoOperacion, Proveedor, Cliente, TipoOperacion } from "@/model/types";
import { proveedoresClient } from "@/clients/proveedores/proveedoresClient";
import { clientesClient } from "@/clients/clientes/clientesClient";
import { productosClient } from "@/clients/productosClient";
import { CATEGORIAS_GASTO, type GastoFinanciero } from "@/model/finanzas";
import { comprobantesRecibidosClient } from "@/clients/comprobantesRecibidosClient";
import {
  esFacturaCompraConVencimiento,
  sumarImportes,
  type ComprobanteRecibido,
  type ComprobanteRecibidoInput,
  type FacturaCompraConVencimiento,
} from "@/lib/comprobantesRecibidos/types";
import { calcularIvaTotalDesdeBases } from "@/lib/comprobantesRecibidos/iva";
import type { AutocompleteOption } from "@/app/components/ui/Autocomplete";
import { buildStockAutocompleteOptions } from "@/app/components/stock/StockBreakdownBadge";
import {
  type CuentaFinancieraDraft,
  EMPTY_CUENTA_FINANCIERA_DRAFT,
  validateCuentaFinancieraForm,
} from "@/app/components/finanzas/CuentaFinancieraFormFields";
import { useCondicionPago, type PagoDraftItem } from "@/app/components/finanzas/useCondicionPago";
import type { OperacionLineaDraft } from "./OperacionLineaEditor";
import {
  type ConceptoFactura,
  type FacturaCompraState,
  buildFacturaCompraInput,
  importePercepcion,
  useFacturaCompraDraft,
} from "./useFacturaCompraDraft";
import {
  type OperacionModalProps,
  type ProductoLite,
  type TallerLite,
  type TipoOperacionConfig,
  TIPOS_UI,
  buildOperacionCreatedMessage,
  createEmptyLinea,
  getDefaultUnitario,
  round2,
} from "./operacionModalTypes";

export const CREATE_CUENTA_VALUE = "__create_cuenta__";

/**
 * Compra ya creada cuya factura no se pudo guardar en el mismo paso. Se reabre el
 * formulario del documento con lo cargado y la misma clave de idempotencia para reintentar
 * sin recrear la operación ni repetir pagos o stock.
 */
export type ComprobantePendiente = {
  operacionId: string;
  input: ComprobanteRecibidoInput;
  conceptos: ConceptoFactura[];
  idempotencyKey: string;
  error: string;
};

type StockItemWithActual = ProductoLite & {
  stockActual: number;
  stockDisponible?: number;
  stockReservado?: number;
  stockPendiente?: number;
  productoId: string;
};

type OperacionFormContextValue = {
  open: boolean;
  onClose: () => void;
  talleres: TallerLite[];
  tipo: TipoOperacion | null;
  setTipo: (tipo: TipoOperacion) => void;
  tallerId: string;
  setTallerId: (id: string) => void;
  isContextualStock: boolean;
  fecha: string;
  setFecha: (fecha: string) => void;
  cuentaFinancieraId: string;
  setCuentaFinancieraId: (id: string) => void;
  cuentaDraft: CuentaFinancieraDraft;
  setCuentaDraft: (draft: CuentaFinancieraDraft) => void;
  isEditingGasto: boolean;
  gasto: GastoFinanciero | null | undefined;
  tipoConfigById: Map<TipoOperacion, TipoOperacionConfig>;
  isTipoEnabled: (value: TipoOperacion | null) => boolean;

  // Proveedor
  proveedorId: string;
  setProveedorId: (id: string) => void;
  disabledProveedor: boolean;
  proveedores: Proveedor[];
  isProveedoresLoading: boolean;
  isProveedorProductosLoading: boolean;
  isProveedorProductosEmpty: boolean;

  // Cliente
  clienteId: string;
  setClienteId: (id: string) => void;
  disabledCliente: boolean;
  clientes: Cliente[];
  isClientesLoading: boolean;

  // Gasto
  categoriaGasto: string;
  setCategoriaGasto: (cat: string) => void;
  montoGasto: string;
  setMontoGasto: (monto: string) => void;
  descripcionGasto: string;
  setDescripcionGasto: (desc: string) => void;
  observaciones: string;
  setObservaciones: (obs: string) => void;

  // Stock
  lineas: OperacionLineaDraft[];
  addLinea: () => string | null;
  removeLinea: (index: number) => void;
  setLineaAt: (index: number, linea: OperacionLineaDraft) => void;
  stockOptions: AutocompleteOption[];
  stockById: Map<string, StockItemWithActual>;
  isInventarioLoading: boolean;
  getDefaultUnitarioForStockId: (stockId: string) => number | null;
  getStockActualForStockId: (stockId: string) => number | undefined;
  stockDeliveryPercentage: number;
  stockDeliveryStatus: string;

  // Pagos y Cuentas
  isLoadingCuentas: boolean;
  cuentaFavorita: { id: string; nombre: string } | null;
  pagosDraft: PagoDraftItem[];
  setPagosDraft: React.Dispatch<React.SetStateAction<PagoDraftItem[]>>;
  showAdvanced: boolean;
  setShowAdvanced: React.Dispatch<React.SetStateAction<boolean>>;
  noPagar: boolean;
  setNoPagar: (noPagar: boolean) => void;
  handleAddPagoRow: () => void;
  handleRemovePagoRow: (id: string) => void;
  handleRestoreFavorita: () => void;
  handleUpdatePagoRow: (id: string, field: keyof PagoDraftItem, val: string) => void;
  handleUpdatePagoCuentaDraft: (id: string, patch: Partial<CuentaFinancieraDraft>) => void;
  handleToggleAdvanced: () => void;
  isPagoModificado: boolean;
  setIsPagoModificado: (modificado: boolean) => void;

  // Submit & Validation
  canSubmit: boolean;
  isSubmitting: boolean;
  submitForm: (e: React.FormEvent) => Promise<void>;
  requiresCuenta: boolean;
  importeTotal: number;

  // Condición comercial y stock diferido
  estadoPago: EstadoPagoOperacion;
  setEstadoPago: (estado: EstadoPagoOperacion) => void;
  montoInicial: string;
  setMontoInicial: (monto: string) => void;
  moverStock: boolean;
  setMoverStock: (mover: boolean) => void;

  // Factura recibida opcional, cargada en el mismo formulario y guardada sobre la operación creada
  puedeCargarComprobante: boolean;
  factura: FacturaCompraState;
  /** Conceptos de la factura derivados del detalle de la operación (productos o gasto). */
  conceptosFactura: ConceptoFactura[];
};

const OperacionFormContext = createContext<OperacionFormContextValue | null>(null);

export function useOperacionForm() {
  const ctx = useContext(OperacionFormContext);
  if (!ctx) {
    throw new Error("useOperacionForm must be used within an OperacionFormProvider");
  }
  return ctx;
}

export function OperacionFormProvider({
  open,
  talleres,
  onClose,
  initialTipo,
  initialCuentaId,
  initialProveedorId,
  disabledProveedor = false,
  initialClienteId,
  disabledCliente = false,
  initialProductoId,
  gasto,
  contextualStock,
  onSuccess,
  onComprobantePendiente,
  onFacturaConVencimiento,
  children,
}: OperacionModalProps & {
  children: React.ReactNode;
  onFacturaConVencimiento?: (factura: FacturaCompraConVencimiento) => void;
  /**
   * Habilita la factura en línea. Recibe la compra ya creada cuando su factura no se
   * pudo guardar: la operación está persistida y el documento puede reintentarse sin recrearla.
   */
  onComprobantePendiente?: (pendiente: ComprobantePendiente) => void;
}) {
  const isEditingGasto = Boolean(gasto);
  const [isSubmittingFactura, setIsSubmittingFactura] = useState(false);
  const operationIdempotencyKeyRef = useRef(generateUuidV4());
  const operationRequestFingerprintRef = useRef<string | null>(null);
  const operationFechaTimestampRef = useRef(new Map<string, string>());
  const inlineCuentaCreadaRef = useRef(new Map<string, { id: string; nombre: string }>());
  const { create, loading: isOperacionesLoading, refresh: refreshOperaciones } = useOperaciones();
  const { success, error } = useToast();
  const {
    loading: isLoadingCuentas,
    refresh: refreshCuentas,
    createCuenta,
    cuentaFavorita,
    cuentasActivas,
  } = useCuentasFinancieras();

  const [tipo, setTipoState] = useState<TipoOperacion | null>(gasto ? "GASTO" : contextualStock ? "VENTA" : initialTipo ?? "VENTA");
  const [tallerId, setTallerIdState] = useState<string>("");
  const [cuentaFinancieraId, setCuentaFinancieraId] = useState<string>(
    gasto?.cuentaId ?? initialCuentaId ?? cuentaFavorita?.id ?? ""
  );
  const [cuentaDraft, setCuentaDraft] = useState<CuentaFinancieraDraft>(() => ({ ...EMPTY_CUENTA_FINANCIERA_DRAFT }));
  const [fecha, setFecha] = useState<string>(() => (gasto?.fecha ? toLocalDateInputFormat(gasto.fecha) : toISODateLocal(new Date())));
  const [lineas, setLineas] = useState<OperacionLineaDraft[]>([createEmptyLinea(contextualStock?.stockId)]);

  const [categoriaGasto, setCategoriaGasto] = useState<string>(gasto?.categoria ?? "ALQUILER");
  const [montoGasto, setMontoGasto] = useState<string>(gasto ? String(gasto.importe) : "");
  const [descripcionGasto, setDescripcionGasto] = useState<string>(gasto?.descripcion ?? "");
  const [observaciones, setObservaciones] = useState<string>(gasto?.observaciones ?? "");
  const [isSubmittingGasto, setIsSubmittingGasto] = useState(false);

  useEffect(() => {
    if (!open) return;
    operationIdempotencyKeyRef.current = generateUuidV4();
    operationRequestFingerprintRef.current = null;
    operationFechaTimestampRef.current.clear();
    inlineCuentaCreadaRef.current.clear();
  }, [open]);

  const timestampForOperationFecha = useCallback((dateInput: string) => {
    if (dateInput.includes("T")) return toISODateTimeWithLocalCurrentTime(dateInput);
    const cached = operationFechaTimestampRef.current.get(dateInput);
    if (cached) return cached;
    const resolved = toISODateTimeWithLocalCurrentTime(dateInput);
    if (resolved) operationFechaTimestampRef.current.set(dateInput, resolved);
    return resolved;
  }, []);

  const createCuentaOnce = useCallback(async (draft: Parameters<typeof createCuenta>[0]) => {
    const key = JSON.stringify([draft.nombre.trim(), draft.tipo, draft.saldoInicial]);
    const cached = inlineCuentaCreadaRef.current.get(key);
    if (cached) return cached;
    const created = await createCuenta(draft);
    const result = { id: created.id, nombre: created.nombre };
    inlineCuentaCreadaRef.current.set(key, result);
    return result;
  }, [createCuenta]);

  const [montoInicial, setMontoInicial] = useState<string>("");
  const [moverStock, setMoverStock] = useState<boolean>(true);

  const [proveedorId, setProveedorId] = useState<string>(
    initialProveedorId ?? ""
  );
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [isProveedoresLoading, setIsProveedoresLoading] = useState<boolean>(false);

  const [clienteId, setClienteId] = useState<string>(
    initialClienteId ?? ""
  );
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isClientesLoading, setIsClientesLoading] = useState<boolean>(false);

  useEffect(() => {
    if (initialProveedorId !== undefined) {
      setProveedorId(initialProveedorId ?? "");
    }
  }, [initialProveedorId]);

  useEffect(() => {
    if (initialClienteId !== undefined) {
      setClienteId(initialClienteId ?? "");
    }
  }, [initialClienteId]);

  useEffect(() => {
    if (tipo === "COMPRA") {
      setIsProveedoresLoading(true);
      Promise.resolve(proveedoresClient?.getAll?.())
        .then((res) => {
          if (res?.data) setProveedores(res.data);
        })
        .catch(() => {})
        .finally(() => setIsProveedoresLoading(false));
    } else if (tipo === "VENTA") {
      setIsClientesLoading(true);
      Promise.resolve(clientesClient?.getAll?.())
        .then((res) => {
          if (res?.data) setClientes(res.data);
        })
        .catch(() => {})
        .finally(() => setIsClientesLoading(false));
    }
  }, [tipo]);

  const { inventario, isLoading: isInventarioLoading } = useInventario(tallerId || undefined);
  const didInitRef = useRef(false);

  const tipoConfigById = useMemo(
    () => new Map(TIPOS_UI.map((t) => [t.tipo, t])),
    [],
  );

  const isTipoEnabled = useCallback(
    (value: TipoOperacion | null) => {
      if (!value) return false;
      if (contextualStock) return value === "VENTA" || value === "COMPRA";
      return !tipoConfigById.get(value)?.disabled;
    },
    [contextualStock, tipoConfigById],
  );

  const setTipo = useCallback(
    (value: TipoOperacion) => {
      if (isTipoEnabled(value)) setTipoState(value);
    },
    [isTipoEnabled],
  );

  const setTallerId = useCallback(
    (id: string) => {
      if (!contextualStock) setTallerIdState(id);
    },
    [contextualStock],
  );

  useEffect(() => {
    if (!open) {
      didInitRef.current = false;
      return;
    }
    if (didInitRef.current) return;
    didInitRef.current = true;

    const initialAcc = initialCuentaId ?? cuentaFavorita?.id ?? "";

    if (gasto) {
      setTipoState("GASTO");
      setFecha(gasto.fecha ? toLocalDateInputFormat(gasto.fecha) : toISODateLocal(new Date()));
      setLineas([createEmptyLinea()]);
      setTallerIdState(talleres[0]?.id ?? "");
      setCuentaFinancieraId(gasto.cuentaId || "");
      setCategoriaGasto(gasto.categoria || "ALQUILER");
      setMontoGasto(String(gasto.importe || ""));
      setDescripcionGasto(gasto.descripcion || "");
      setObservaciones(gasto.observaciones || "");
      return;
    }

    setTipoState(contextualStock ? "VENTA" : initialTipo ?? "VENTA");
    setFecha(toISODateLocal(new Date()));
    setLineas([createEmptyLinea(contextualStock?.stockId)]);
    setTallerIdState(contextualStock?.tallerId ?? talleres[0]?.id ?? "");
    setCuentaFinancieraId(initialAcc);
    setCategoriaGasto("ALQUILER");
    setMontoGasto("");
    setDescripcionGasto("");
    setObservaciones("");
    setMontoInicial("");
    setMoverStock(true);
    setProveedorId(initialProveedorId ?? "");
    setClienteId(initialClienteId ?? "");
  }, [open, talleres, initialTipo, initialCuentaId, gasto, contextualStock, cuentaFavorita, initialProveedorId, initialClienteId]);

  useEffect(() => {
    if (!open) return;
    if (contextualStock) {
      setTallerIdState(contextualStock.tallerId);
      return;
    }
    if (tallerId) return;
    const firstTallerId = talleres[0]?.id;
    if (firstTallerId) setTallerIdState(firstTallerId);
  }, [open, talleres, tallerId, contextualStock]);

  useEffect(() => {
    if (
      !open ||
      gasto ||
      initialCuentaId ||
      cuentaFinancieraId ||
      !cuentaFavorita?.id
    ) {
      return;
    }

    setCuentaFinancieraId(cuentaFavorita.id);
  }, [open, gasto, initialCuentaId, cuentaFinancieraId, cuentaFavorita]);

  const stockItems = useMemo<StockItemWithActual[]>(
    () =>
      (inventario ?? []).map((s) => ({
        id: s.id,
        productoId: s.productoId ?? s.id,
        nombre: s.nombre,
        codigo: s.codigo,
        precio_unitario: Number(s.precioUnitario) || 0,
        costo_unitario: Number(s.costoUnitario) || 0,
        ivaAlicuotaId: s.ivaAlicuotaId ?? null,
        stockActual: Number(s.stockActual) || 0,
        stockDisponible: s.stockDisponible,
        stockReservado: s.stockReservado,
        stockPendiente: s.stockPendiente,
      })),
    [inventario]
  );

  const [proveedorProductoIds, setProveedorProductoIds] = useState<Set<string> | null>(null);
  const [isProveedorProductosLoading, setIsProveedorProductosLoading] = useState(false);
  const [proveedorCatalogoMap, setProveedorCatalogoMap] = useState<
    Map<string, { codigoProveedor?: string | null; costoReferencia?: number }>
  >(new Map());

  useEffect(() => {
    if (!open || tipo !== "COMPRA" || !proveedorId) {
      setProveedorProductoIds(null);
      setProveedorCatalogoMap(new Map());
      setIsProveedorProductosLoading(false);
      return;
    }

    let active = true;
    setIsProveedorProductosLoading(true);

    Promise.all([
      productosClient.getAll({ proveedorId }),
      proveedoresClient.getProductos(proveedorId),
    ])
      .then(([prodsRes, provProdsRes]) => {
        if (!active) return;
        const ids = new Set<string>();
        if (prodsRes?.data) {
          for (const p of prodsRes.data) {
            ids.add(p.id);
          }
        }
        const catMap = new Map<string, { codigoProveedor?: string | null; costoReferencia?: number }>();
        if (provProdsRes?.data) {
          for (const pp of provProdsRes.data) {
            ids.add(pp.producto_id);
            catMap.set(pp.producto_id, {
              codigoProveedor: pp.codigo_proveedor,
              costoReferencia: Number(pp.costo_referencia) || 0,
            });
          }
        }
        setProveedorProductoIds(ids);
        setProveedorCatalogoMap(catMap);
      })
      .catch((err) => {
        logger.error("Error cargando productos del proveedor", err);
      })
      .finally(() => {
        if (active) {
          setIsProveedorProductosLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [open, tipo, proveedorId]);

  const stockById = useMemo(() => new Map(stockItems.map((s) => [s.id, s])), [stockItems]);

  // Si se cambia de proveedor o se filtran productos, desasociar líneas que no correspondan
  useEffect(() => {
    if (!open || tipo !== "COMPRA" || !proveedorProductoIds) return;
    setLineas((prev) =>
      prev.map((l) => {
        if (!l.stockId) return l;
        const item = stockById.get(l.stockId);
        if (!item || !proveedorProductoIds.has(item.productoId)) {
          return { ...l, stockId: "", unitario: 0, total: 0 };
        }
        return l;
      })
    );
  }, [open, tipo, proveedorProductoIds, stockById]);

  // Pre-seleccionar producto inicial si fue provisto
  useEffect(() => {
    if (!open || !initialProductoId || !stockItems.length) return;
    setLineas((prev) => {
      if (prev.length === 1 && !prev[0].stockId) {
        const match = stockItems.find((s) => s.productoId === initialProductoId);
        if (match) {
          const unitario = getDefaultUnitario(match, tipo || "COMPRA");
          const stockFisico = Number(match.stockActual) || 0;
          const cantidad = Number(prev[0].cantidad) || 1;
          const cantidadEntregar = tipo === "VENTA" ? Math.min(cantidad, Math.max(0, stockFisico)) : cantidad;
          return [{
            ...prev[0],
            stockId: match.id,
            unitario,
            cantidadEntregar,
            total: round2(unitario * cantidad),
          }];
        }
      }
      return prev;
    });
  }, [open, initialProductoId, stockItems, tipo]);

  // Recalcular unitario desde stock/producto y total al cambiar tipo (VENTA / COMPRA) o catálogo de proveedor
  useEffect(() => {
    if (!open) return;
    if (!tipo) return;
    if (tipo === "GASTO") return;
    if (!isTipoEnabled(tipo)) return;

    setLineas((prev) =>
      prev.map((linea) => {
        if (!linea.stockId) return linea;
        const item = stockItems.find((s) => s.id === linea.stockId);
        if (!item) return linea;
        let unitario = getDefaultUnitario(item, tipo);
        if (tipo === "COMPRA") {
          const catInfo = proveedorCatalogoMap.get(item.productoId);
          if (catInfo && typeof catInfo.costoReferencia === "number" && catInfo.costoReferencia > 0) {
            unitario = catInfo.costoReferencia;
          }
        }
        const total = round2((Number(linea.cantidad) || 0) * unitario);
        let cantidadEntregar = linea.cantidadEntregar;
        if (tipo === "VENTA") {
          const stockFisico = Number(item.stockActual) || 0;
          const cant = Number(linea.cantidad) || 0;
          if (cantidadEntregar === undefined || cantidadEntregar === cant) {
            cantidadEntregar = Math.min(cant, Math.max(0, stockFisico));
          }
        }
        return { ...linea, unitario, total, cantidadEntregar };
      }),
    );
  }, [tipo, stockItems, open, isTipoEnabled, proveedorCatalogoMap]);

  const stockOptions = useMemo<AutocompleteOption[]>(
    () => {
      let filtered = stockItems;
      if (tipo === "COMPRA" && proveedorId && proveedorProductoIds !== null) {
        filtered = stockItems.filter((s) => proveedorProductoIds.has(s.productoId));
      }

      return buildStockAutocompleteOptions(filtered, {
        getCodePrefix: (s) => {
          const catInfo = proveedorCatalogoMap.get(s.productoId);
          const provCod = catInfo?.codigoProveedor ? `${catInfo.codigoProveedor} · ` : "";
          const cod =
            s.codigo && s.codigo !== catInfo?.codigoProveedor
              ? `${s.codigo} · `
              : !catInfo?.codigoProveedor && s.codigo
              ? `${s.codigo} · `
              : "";
          return `${provCod}${cod}`;
        },
      });
    },
    [stockItems, tipo, proveedorId, proveedorProductoIds, proveedorCatalogoMap],
  );

  const isProveedorProductosEmpty = useMemo(
    () =>
      Boolean(
        tipo === "COMPRA" &&
          proveedorId &&
          !isProveedorProductosLoading &&
          proveedorProductoIds !== null &&
          (proveedorProductoIds.size === 0 || stockOptions.length === 0)
      ),
    [tipo, proveedorId, isProveedorProductosLoading, proveedorProductoIds, stockOptions.length]
  );

  const getDefaultUnitarioForStockId = useCallback(
    (stockId: string): number | null => {
      if (!tipo || !isTipoEnabled(tipo) || tipo === "GASTO") return null;
      const item = stockById.get(stockId);
      if (!item) return null;
      if (tipo === "COMPRA") {
        const catInfo = proveedorCatalogoMap.get(item.productoId);
        if (catInfo && typeof catInfo.costoReferencia === "number" && catInfo.costoReferencia > 0) {
          return catInfo.costoReferencia;
        }
      }
      return getDefaultUnitario(item, tipo);
    },
    [tipo, isTipoEnabled, stockById, proveedorCatalogoMap],
  );

  const getStockActualForStockId = useCallback(
    (stockId: string): number | undefined => {
      const item = stockById.get(stockId);
      return item ? Number(item.stockActual) || 0 : undefined;
    },
    [stockById]
  );

  const setLineaAt = useCallback((idx: number, nextLinea: OperacionLineaDraft) => {
    setLineas((prev) => prev.map((l, i) => (
      i === idx
        ? { ...nextLinea, stockId: contextualStock?.stockId ?? nextLinea.stockId }
        : l
    )));
  }, [contextualStock]);

  const addLinea = useCallback(() => {
    if (contextualStock) return null;
    const linea = createEmptyLinea();
    setLineas((prev) => [...prev, linea]);
    return linea.id ?? null;
  }, [contextualStock]);

  const removeLinea = useCallback((idx: number) => {
    if (contextualStock) return;
    setLineas((prev) => prev.filter((_, i) => i !== idx));
  }, [contextualStock]);

  const isCreatingCuenta = cuentaFinancieraId === CREATE_CUENTA_VALUE;

  const puedeCargarComprobante = Boolean(onComprobantePendiente)
    && !isEditingGasto
    && !contextualStock
    && tipo === "COMPRA";

  const proveedorSeleccionado = useMemo(
    () => proveedores.find((p) => p.id === proveedorId) ?? null,
    [proveedores, proveedorId],
  );
  const factura = useFacturaCompraDraft({ open, tipo, proveedor: proveedorSeleccionado });
  const facturaActiva = factura.activa && puedeCargarComprobante;

  // En una compra guardada con factura, IVA A calculado y percepciones suman al total, los pagos
  // sugeridos y el saldo. En los gastos, IVA y percepciones quedan solo en la factura.
  const sumaPercepciones = tipo === "COMPRA" && facturaActiva;
  const totalPercepciones = useMemo(
    () => (sumaPercepciones
      ? sumarImportes(factura.draft.percepciones.map((linea) => importePercepcion(linea.importe)))
      : 0),
    [sumaPercepciones, factura.draft.percepciones],
  );

  const totalIvaCompra = useMemo(() => {
    if (tipo !== "COMPRA" || !facturaActiva || factura.draft.clase !== "A") return 0;
    try {
      return calcularIvaTotalDesdeBases(lineas.map((linea, index) => ({
        key: String(index),
        importe: (Number(linea.cantidad) || 0) * (Number(linea.unitario) || 0),
        ivaAlicuotaId: linea.ivaAlicuotaId ?? stockById.get(linea.stockId)?.ivaAlicuotaId ?? 5,
      })));
    } catch {
      return 0;
    }
  }, [tipo, facturaActiva, factura.draft.clase, lineas, stockById]);

  const importeTotal = useMemo(() => {
    if (tipo === "GASTO") return Number(montoGasto) || 0;
    const totalLineas = lineas.reduce(
      (sum, l) => sum + (Number(l.cantidad) || 0) * (Number(l.unitario) || 0),
      0
    );
    return sumarImportes([totalLineas, totalIvaCompra, totalPercepciones]);
  }, [tipo, montoGasto, lineas, totalIvaCompra, totalPercepciones]);

  // Porcentaje y estado de entrega de stock
  const stockDeliveryPercentage = useMemo(() => {
    const totalCantidad = lineas.reduce((acc, l) => acc + (Number(l.cantidad) || 0), 0);
    if (totalCantidad <= 0) return 100;
    const totalEntregar = lineas.reduce((acc, l) => {
      const cant = Number(l.cantidad) || 0;
      const ent = l.cantidadEntregar !== undefined ? Number(l.cantidadEntregar) : cant;
      return acc + Math.min(cant, Math.max(0, ent));
    }, 0);
    return Math.round((totalEntregar / totalCantidad) * 100);
  }, [lineas]);

  const stockDeliveryStatus = useMemo(() => {
    const verb = tipo === "COMPRA" ? "recibido" : "entregado";
    if (stockDeliveryPercentage === 100) return `100% ${verb}`;
    if (stockDeliveryPercentage === 0) return "Pendiente";
    return `${stockDeliveryPercentage}% ${verb}`;
  }, [stockDeliveryPercentage, tipo]);

  const {
    pagosDraft,
    setPagosDraft,
    showAdvanced,
    setShowAdvanced,
    isPagoModificado,
    setIsPagoModificado,
    totalPagado,
    computedEstadoPago,
    noPagar,
    canSubmitPagos,
    handleAddPagoRow,
    handleRemovePagoRow,
    handleRestoreFavorita,
    handleUpdatePagoRow,
    handleUpdatePagoCuentaDraft,
    handleToggleAdvanced,
    setNoPagar,
    setEstadoPago,
    resolvePagosPayload,
  } = useCondicionPago({
    open,
    targetAmount: importeTotal,
    cuentaFavorita,
    cuentasActivas,
    initialCuentaId: gasto?.cuentaId ?? initialCuentaId ?? undefined,
    initialFecha: gasto?.fecha ? toLocalDateInputFormat(gasto.fecha) : undefined,
    initialMonto: gasto ? String(gasto.importe || "") : undefined,
    minRows: 0,
  });

  const requiresCuenta = tipo === "GASTO" || (importeTotal > 0 && computedEstadoPago !== "PENDIENTE");

  const canSubmit = useMemo(() => {
    if (!open) return false;
    if (!tipo || !isTipoEnabled(tipo)) return false;
    if (!isValidDate(fecha)) return false;

    if (tipo === "GASTO") {
      if (talleres.length > 0 && !tallerId) return false;
      const importeNum = Number(montoGasto);
      if (isEditingGasto) {
        if (requiresCuenta && !cuentaFinancieraId) return false;
        if (cuentaFinancieraId && isCreatingCuenta && !validateCuentaFinancieraForm(cuentaDraft)) return false;
        return (
          Boolean(categoriaGasto) &&
          Number.isFinite(importeNum) &&
          importeNum > 0 &&
          !isLoadingCuentas &&
          !isSubmittingGasto
        );
      }

      if (!categoriaGasto || !Number.isFinite(importeNum) || importeNum <= 0) return false;
      if (isSubmittingGasto) return false;

      if (importeTotal > 0 && !canSubmitPagos) return false;

      return true;
    }

    if (!tallerId) return false;
    if (lineas.length === 0) return false;

    const allLinesValid = lineas.every((l) => {
      const cant = Number(l.cantidad);
      const ent = l.cantidadEntregar !== undefined ? Number(l.cantidadEntregar) : cant;
      if (!l.stockId || cant <= 0 || !Number.isFinite(l.unitario)) return false;
      if (ent < 0 || ent > cant) return false;
      if (tipo === "VENTA") {
        const item = stockById.get(l.stockId);
        const stockActual = item ? Number(item.stockActual) || 0 : 0;
        if (ent > stockActual) return false;
      }
      return true;
    });
    if (!allLinesValid) return false;

    if (importeTotal > 0 && !canSubmitPagos) return false;

    return true;
  }, [
    open,
    tipo,
    isTipoEnabled,
    fecha,
    montoGasto,
    requiresCuenta,
    cuentaFinancieraId,
    isCreatingCuenta,
    cuentaDraft,
    categoriaGasto,
    isLoadingCuentas,
    isSubmittingGasto,
    talleres,
    tallerId,
    lineas,
    importeTotal,
    canSubmitPagos,
    isEditingGasto,
    stockById,
  ]);

  const isSubmitting = isOperacionesLoading || isSubmittingGasto || isSubmittingFactura;

  const conceptosFactura = useMemo<ConceptoFactura[]>(() => {
    if (tipo === "GASTO") {
      const importe = round2(Number(montoGasto) || 0);
      if (importe <= 0) return [];
      const categoria = CATEGORIAS_GASTO.find((c) => c.value === categoriaGasto)?.label ?? "Gasto";
      const descripcion = descripcionGasto.trim() || categoria;
      return [{ key: "gasto", descripcion, importe, ivaAlicuotaId: factura.draft.ivaAlicuotaGasto ?? 5 }];
    }
    return lineas
      .map((l, index) => {
        const cantidad = Number(l.cantidad) || 0;
        const unitario = Number(l.unitario) || 0;
        const descripcion = stockById.get(l.stockId)?.nombre?.trim() ?? "";
        return {
          key: `${l.id ?? index}-${l.stockId}`,
          ivaAlicuotaId: l.ivaAlicuotaId ?? stockById.get(l.stockId)?.ivaAlicuotaId ?? null,
          descripcion,
          cantidad,
          unitario,
          importe: round2(cantidad * unitario),
        };
      })
      .filter((c) => c.descripcion && c.importe > 0);
  }, [tipo, montoGasto, categoriaGasto, descripcionGasto, lineas, stockById, factura.draft.ivaAlicuotaGasto]);

  /**
   * Guarda la factura de la operación recién creada. El receptor (datos fiscales del tenant) se
   * toma de la precarga del servidor. Devuelve el error si no se pudo guardar.
   */
  const guardarFacturaDeOperacion = async (
    operacionId: string,
    input: ComprobanteRecibidoInput,
    idempotencyKey: string,
  ): Promise<{ input: ComprobanteRecibidoInput; comprobante?: ComprobanteRecibido; error?: string }> => {
    let documento = input;
    try {
      const datos = await comprobantesRecibidosClient.listByOperacion(operacionId);
      documento = { ...input, receptor: datos.precarga.receptor };
    } catch (cause) {
      logger.warn("No se pudo precargar el receptor de la factura recibida", cause);
    }
    try {
      const comprobante = await comprobantesRecibidosClient.create(operacionId, documento, idempotencyKey);
      return { input: documento, comprobante };
    } catch (cause) {
      return { input: documento, error: cause instanceof Error ? cause.message : "No se pudo guardar la factura" };
    }
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !tipo) return;
    const fechaTimestamp = timestampForOperationFecha(fecha);
    if (!fechaTimestamp) return;

    // La factura se valida antes de crear la operación para no dejar una compra sin su documento
    // por un dato faltante. Solo los rechazos del servidor (p. ej., duplicada) llegan después.
    let facturaInput: ComprobanteRecibidoInput | null = null;
    if (facturaActiva) {
      const parsed = buildFacturaCompraInput({
        draft: factura.draft,
        fechaOperacion: fecha,
        conceptos: conceptosFactura,
        proveedorId: tipo === "COMPRA" && proveedorId ? proveedorId : null,
        tipoOperacion: tipo,
      });
      if (parsed.error || !parsed.value) {
        const msg = parsed.error ?? "Revisá los datos de la factura";
        factura.setError(msg);
        error("Revisá los datos de la factura", msg);
        return;
      }
      facturaInput = parsed.value;
    }

    let targetCuentaId: string | null = cuentaFinancieraId || null;
    if (cuentaFinancieraId && isCreatingCuenta) {
      const created = await createCuentaOnce({
        nombre: cuentaDraft.nombre.trim(),
        tipo: cuentaDraft.tipo,
        saldoInicial: 0,
      });
      success("Cuenta creada", `${created.nombre} se registró correctamente.`);
      targetCuentaId = created.id;
    }

    if (tipo === "GASTO" && isEditingGasto) {
      setIsSubmittingGasto(true);
      try {
        const payload = {
          cuentaId: targetCuentaId!,
          categoria: categoriaGasto,
          importe: Number(montoGasto),
          fecha: fechaTimestamp,
          descripcion: descripcionGasto.trim() || null,
          observaciones: observaciones.trim() || null,
          idempotencyKey: generateUuidV4(),
        };
        const response = await finanzasClient.actualizarGasto(gasto!.id, payload);
        if (response.error || !response.data) {
          throw new Error(response.error || "No se pudo actualizar el gasto");
        }
        await refreshOperaciones();
        await refreshCuentas();
        success("Gasto actualizado", "El movimiento financiero se guardó correctamente.");
        onClose();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "No se pudo actualizar el gasto";
        error("Error actualizando gasto", msg);
      } finally {
        setIsSubmittingGasto(false);
      }
      return;
    }

    try {
      const pagosPayload = await resolvePagosPayload(createCuentaOnce, fecha);

      const primaryCuentaId = pagosPayload.length > 0
        ? pagosPayload[0].cuenta_financiera_id
        : (computedEstadoPago === "PENDIENTE" ? null : (targetCuentaId || null));

      const payloadBase = {
        tipo,
        taller_id: tallerId || null,
        fecha: fechaTimestamp,
        cuenta_financiera_id: primaryCuentaId,
        observaciones: observaciones.trim() || null,
        estado_pago: computedEstadoPago,
        monto_inicial: computedEstadoPago === "PARCIAL" ? totalPagado : null,
        mover_stock: moverStock,
        proveedor_id: tipo === "COMPRA" && proveedorId ? proveedorId : null,
        cliente_id: tipo === "VENTA" && clienteId ? clienteId : null,
        pagos: pagosPayload.length > 0 ? pagosPayload : undefined,
        // Las percepciones de la factura de una compra se registran como cargos de la operación
        // (suman a monto_total). Son las mismas líneas que se guardan en la factura.
        cargos: tipo === "COMPRA" && facturaInput
          ? facturaInput.lineas
              .filter((l) => l.tipo === "PERCEPCION")
              .map((l) => ({
                tipo: "PERCEPCION" as const,
                percepcion_codigo: l.percepcionCodigo ?? "OTRA",
                descripcion: l.descripcion,
                importe: l.importe,
              }))
          : undefined,
        monto: tipo === "GASTO" ? Number(montoGasto) : undefined,
        precios_incluyen_iva: tipo === "COMPRA"
          ? !(facturaActiva && factura.draft.clase === "A")
          : undefined,
        categoria_gasto: tipo === "GASTO" ? categoriaGasto : undefined,
        descripcion: tipo === "GASTO" ? (descripcionGasto.trim() || null) : undefined,
        lineas: tipo === "GASTO" ? [] : lineas.map((l) => {
          const cantidad = Number(l.cantidad) || 0;
          const cantidadCumplida = l.cantidadEntregar !== undefined ? Number(l.cantidadEntregar) : cantidad;
          const unitario = Number(l.unitario) || 0;
          const delta = tipo === "VENTA" ? -cantidad : cantidad;
          return {
            stock_id: l.stockId,
            cantidad,
            cantidad_cumplida: cantidadCumplida,
            monto_unitario: unitario,
            delta_cantidad: delta,
            iva_alicuota_id: l.ivaAlicuotaId ?? stockById.get(l.stockId)?.ivaAlicuotaId ?? 5,
          };
        }),
      };

      // Reintentos idénticos conservan la misma clave aunque se pierda la respuesta del servidor.
      // Si cambia el contenido del intento, se emite una clave nueva para no devolver una operación vieja.
      const requestFingerprint = JSON.stringify(payloadBase);
      if (operationRequestFingerprintRef.current !== requestFingerprint) {
        operationRequestFingerprintRef.current = requestFingerprint;
        operationIdempotencyKeyRef.current = generateUuidV4();
      }
      const payload = { ...payloadBase, idempotency_key: operationIdempotencyKeyRef.current };

      const created = await create(payload);
      if (created) {
        try {
          await Promise.all([refreshCuentas(), onSuccess?.()]);
        } catch (refreshError) {
          logger.error("No se pudieron refrescar los datos luego de crear la operación", refreshError);
        }
        const tallerNombre = tallerId
          ? (talleres.find((t) => t.id === tallerId)?.nombre ?? "el taller seleccionado")
          : "la operación";
        if (facturaInput && created.id && onComprobantePendiente) {
          const idempotencyKey = generateUuidV4();
          setIsSubmittingFactura(true);
          const resultado = await guardarFacturaDeOperacion(created.id, facturaInput, idempotencyKey);
          setIsSubmittingFactura(false);
          if (resultado.error) {
            // La operación ya existe: no se informa como éxito completo ni se recrea al reintentar.
            error("La operación se creó, pero la factura no se guardó", resultado.error);
            onComprobantePendiente({
              operacionId: created.id,
              input: resultado.input,
              conceptos: conceptosFactura,
              idempotencyKey,
              error: resultado.error,
            });
            return;
          }
          success(
            tipo === "GASTO" ? "Gasto y factura registrados" : "Compra y factura registradas",
            buildOperacionCreatedMessage(tipo, tallerNombre, tipoConfigById)
          );
          if (onFacturaConVencimiento && resultado.comprobante && esFacturaCompraConVencimiento(resultado.comprobante)) {
            onFacturaConVencimiento(resultado.comprobante);
            return;
          }
          onClose();
          return;
        }
        success(
          "Operación creada",
          buildOperacionCreatedMessage(tipo, tallerNombre, tipoConfigById)
        );
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No se pudo crear la operación";
      error("Error creando operación", msg);
    }
  };

  const value: OperacionFormContextValue = {
    open,
    onClose,
    talleres,
    tipo,
    setTipo,
    tallerId,
    setTallerId,
    isContextualStock: Boolean(contextualStock),
    fecha,
    setFecha,
    cuentaFinancieraId,
    setCuentaFinancieraId,
    cuentaDraft,
    setCuentaDraft,
    isEditingGasto: Boolean(gasto),
    gasto,
    tipoConfigById,
    isTipoEnabled,
    proveedorId,
    setProveedorId,
    disabledProveedor: Boolean(disabledProveedor),
    proveedores,
    isProveedoresLoading,
    isProveedorProductosLoading,
    isProveedorProductosEmpty,
    clienteId,
    setClienteId,
    disabledCliente: Boolean(disabledCliente),
    clientes,
    isClientesLoading,
    categoriaGasto,
    setCategoriaGasto,
    montoGasto,
    setMontoGasto,
    descripcionGasto,
    setDescripcionGasto,
    observaciones,
    setObservaciones,
    lineas,
    addLinea,
    removeLinea,
    setLineaAt,
    stockOptions,
    stockById,
    isInventarioLoading,
    getDefaultUnitarioForStockId,
    getStockActualForStockId,
    stockDeliveryPercentage,
    stockDeliveryStatus,
    isLoadingCuentas,
    cuentaFavorita: cuentaFavorita ?? null,
    pagosDraft,
    setPagosDraft,
    showAdvanced,
    setShowAdvanced,
    noPagar,
    setNoPagar,
    handleAddPagoRow,
    handleRemovePagoRow,
    handleRestoreFavorita,
    handleUpdatePagoRow,
    handleUpdatePagoCuentaDraft,
    handleToggleAdvanced,
    isPagoModificado,
    setIsPagoModificado,
    canSubmit,
    isSubmitting,
    submitForm,
    requiresCuenta,
    importeTotal,
    estadoPago: computedEstadoPago,
    setEstadoPago,
    montoInicial,
    setMontoInicial,
    moverStock,
    setMoverStock,
    puedeCargarComprobante,
    factura,
    conceptosFactura,
  };

  return (
    <OperacionFormContext.Provider value={value}>
      {children}
    </OperacionFormContext.Provider>
  );
}
