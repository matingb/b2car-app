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
import type { GastoFinanciero } from "@/model/finanzas";
import type { AutocompleteOption } from "@/app/components/ui/Autocomplete";
import {
  type CuentaFinancieraDraft,
  EMPTY_CUENTA_FINANCIERA_DRAFT,
  validateCuentaFinancieraForm,
} from "@/app/components/finanzas/CuentaFinancieraFormFields";
import { type PagoDraftItem } from "@/app/components/arreglos/RegistrarPagoSection";
import type { OperacionLineaDraft } from "./OperacionLineaEditor";
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

type StockItemWithActual = ProductoLite & { stockActual: number; productoId: string };

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
  addLinea: () => void;
  removeLinea: (index: number) => void;
  setLineaAt: (index: number, linea: OperacionLineaDraft) => void;
  stockOptions: AutocompleteOption[];
  stockById: Map<string, StockItemWithActual>;
  isInventarioLoading: boolean;
  getDefaultUnitarioForStockId: (stockId: string) => number | null;
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
  children,
}: OperacionModalProps & { children: React.ReactNode }) {
  const isEditingGasto = Boolean(gasto);
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

  const [montoInicial, setMontoInicial] = useState<string>("");
  const [moverStock, setMoverStock] = useState<boolean>(true);

  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [isPagoModificado, setIsPagoModificado] = useState<boolean>(false);
  const [pagosDraft, setPagosDraft] = useState<PagoDraftItem[]>(() => [
    {
      id: generateUuidV4(),
      cuentaId: initialCuentaId ?? cuentaFavorita?.id ?? "",
      monto: "",
      fecha: gasto?.fecha ? toLocalDateInputFormat(gasto.fecha) : toISODateLocal(new Date()),
      descripcion: "",
    },
  ]);

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
      setIsPagoModificado(false);
      return;
    }
    if (didInitRef.current) return;
    didInitRef.current = true;
    setIsPagoModificado(false);

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
      setPagosDraft([
        {
          id: generateUuidV4(),
          cuentaId: gasto.cuentaId || initialAcc,
          monto: String(gasto.importe || ""),
          fecha: gasto.fecha ? toLocalDateInputFormat(gasto.fecha) : toISODateLocal(new Date()),
          descripcion: "",
        },
      ]);
      setShowAdvanced(false);
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
    setShowAdvanced(false);
    setProveedorId(initialProveedorId ?? "");
    setClienteId(initialClienteId ?? "");
    setPagosDraft([
      {
        id: generateUuidV4(),
        cuentaId: initialAcc,
        monto: "",
        fecha: toISODateLocal(new Date()),
        descripcion: "",
      },
    ]);
    setShowAdvanced(false);
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
    setPagosDraft((prev) => {
      if (prev.length > 0 && !prev[0].cuentaId) {
        return prev.map((p, i) => (i === 0 ? { ...p, cuentaId: cuentaFavorita.id } : p));
      }
      return prev;
    });
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
        stockActual: Number(s.stockActual) || 0,
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
          return [{ ...prev[0], stockId: match.id, unitario, total: round2(unitario * (Number(prev[0].cantidad) || 0)) }];
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
        return { ...linea, unitario, total };
      }),
    );
  }, [tipo, stockItems, open, isTipoEnabled, proveedorCatalogoMap]);

  const stockOptions = useMemo<AutocompleteOption[]>(
    () => {
      let filtered = stockItems;
      if (tipo === "COMPRA" && proveedorId && proveedorProductoIds !== null) {
        filtered = stockItems.filter((s) => proveedorProductoIds.has(s.productoId));
      }

      return filtered.map((s) => {
        const catInfo = proveedorCatalogoMap.get(s.productoId);
        const provCod = catInfo?.codigoProveedor ? `${catInfo.codigoProveedor} · ` : "";
        const stockActual = Number(s.stockActual) || 0;
        const cod =
          s.codigo && s.codigo !== catInfo?.codigoProveedor
            ? `${s.codigo} · `
            : !catInfo?.codigoProveedor && s.codigo
            ? `${s.codigo} · `
            : "";
        return {
          value: s.id,
          label: s.nombre,
          secondaryLabel: `${provCod}${cod}Stock actual: ${stockActual}`,
        };
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

  const setLineaAt = useCallback((idx: number, nextLinea: OperacionLineaDraft) => {
    setLineas((prev) => prev.map((l, i) => (
      i === idx
        ? { ...nextLinea, stockId: contextualStock?.stockId ?? nextLinea.stockId }
        : l
    )));
  }, [contextualStock]);

  const addLinea = useCallback(() => {
    if (contextualStock) return;
    setLineas((prev) => [...prev, createEmptyLinea()]);
  }, [contextualStock]);

  const removeLinea = useCallback((idx: number) => {
    if (contextualStock) return;
    setLineas((prev) => prev.filter((_, i) => i !== idx));
  }, [contextualStock]);

  const isCreatingCuenta = cuentaFinancieraId === CREATE_CUENTA_VALUE;

  const importeTotal = useMemo(() => {
    if (tipo === "GASTO") return Number(montoGasto) || 0;
    return lineas.reduce(
      (sum, l) => sum + (Number(l.cantidad) || 0) * (Number(l.unitario) || 0),
      0
    );
  }, [tipo, montoGasto, lineas]);

  const noPagar = pagosDraft.length === 0;

  const setEstadoPago = useCallback((nuevo: EstadoPagoOperacion) => {
    if (nuevo === "PENDIENTE") {
      setIsPagoModificado(true);
      setPagosDraft([]);
    } else {
      setIsPagoModificado(false);
      setPagosDraft((prev) => {
        if (prev.length > 0) return prev;
        const activeAcc = cuentaFavorita?.id ?? initialCuentaId ?? cuentaFinancieraId ?? "";
        return [
          {
            id: generateUuidV4(),
            cuentaId: activeAcc,
            monto: String(importeTotal || 0),
            fecha: toISODateLocal(new Date()),
            descripcion: "",
          },
        ];
      });
    }
  }, [cuentaFavorita?.id, initialCuentaId, cuentaFinancieraId, importeTotal]);

  const setNoPagar = useCallback((val: boolean) => {
    if (val) {
      setIsPagoModificado(true);
      setPagosDraft([]);
    } else {
      setIsPagoModificado(false);
      setPagosDraft((prev) => {
        if (prev.length > 0) return prev;
        const activeAcc = cuentaFavorita?.id ?? initialCuentaId ?? cuentaFinancieraId ?? "";
        return [
          {
            id: generateUuidV4(),
            cuentaId: activeAcc,
            monto: String(importeTotal || 0),
            fecha: toISODateLocal(new Date()),
            descripcion: "",
          },
        ];
      });
    }
  }, [cuentaFavorita?.id, initialCuentaId, cuentaFinancieraId, importeTotal]);

  // Si no fue modificado manualmente, mantener pagosDraft[0].monto sincronizado con importeTotal
  useEffect(() => {
    if (isPagoModificado) return;

    const activeAccount = cuentaFavorita?.id ?? initialCuentaId ?? cuentaFinancieraId ?? "";
    const targetMontoStr = String(importeTotal || 0);

    setPagosDraft((prev) => {
      if (prev.length !== 1) {
        return prev;
      }

      const currentMontoNum = Number(prev[0].monto) || 0;
      const targetMontoNum = importeTotal;
      const targetCuentaId = prev[0].cuentaId || activeAccount;

      if (
        currentMontoNum === targetMontoNum &&
        (prev[0].monto === targetMontoStr || (targetMontoNum === 0 && prev[0].monto === "")) &&
        prev[0].cuentaId === targetCuentaId
      ) {
        return prev;
      }

      return [
        {
          id: prev[0].id,
          cuentaId: targetCuentaId,
          monto: targetMontoStr,
          fecha: prev[0].fecha || toISODateLocal(new Date()),
          descripcion: prev[0].descripcion || "",
        },
      ];
    });
  }, [
    isPagoModificado,
    importeTotal,
    cuentaFavorita?.id,
    initialCuentaId,
    cuentaFinancieraId,
    tipo,
  ]);

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

  // Handlers para pagos múltiples
  const handleAddPagoRow = useCallback(() => {
    const nextCuentaId = cuentaFavorita?.id ?? cuentasActivas?.[0]?.id ?? "";
    const totalActual = pagosDraft.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
    const restante = Math.max(0, importeTotal - totalActual);
    setPagosDraft((prev) => {
      if (prev.length === 0) {
        setIsPagoModificado(false);
      } else {
        setIsPagoModificado(true);
      }
      return [
        ...prev,
        {
          id: generateUuidV4(),
          cuentaId: nextCuentaId,
          monto: restante > 0 ? String(restante) : (importeTotal > 0 ? String(importeTotal) : ""),
          fecha: toISODateLocal(new Date()),
          descripcion: "",
        },
      ];
    });
  }, [cuentasActivas, cuentaFavorita, pagosDraft, importeTotal]);

  const handleRemovePagoRow = useCallback((id: string) => {
    setIsPagoModificado(true);
    setPagosDraft((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleRestoreFavorita = useCallback(() => {
    if (!cuentaFavorita) return;
    setIsPagoModificado(false);
    setPagosDraft([
      {
        id: generateUuidV4(),
        cuentaId: cuentaFavorita.id,
        monto: String(importeTotal || 0),
        fecha: toISODateLocal(new Date()),
        descripcion: "",
      },
    ]);
  }, [cuentaFavorita, importeTotal]);

  const handleUpdatePagoRow = useCallback((id: string, field: keyof PagoDraftItem, val: string) => {
    if (field === "monto") {
      setIsPagoModificado(true);
    }
    setPagosDraft((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: val } : p))
    );
  }, []);

  const handleUpdatePagoCuentaDraft = useCallback((id: string, patch: Partial<CuentaFinancieraDraft>) => {
    setPagosDraft((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, cuentaDraft: { ...(p.cuentaDraft || EMPTY_CUENTA_FINANCIERA_DRAFT), ...patch } }
          : p
      )
    );
  }, []);

  const handleToggleAdvanced = useCallback(() => {
    setShowAdvanced((prev) => {
      const next = !prev;
      if (!next && cuentaFavorita) {
        setIsPagoModificado(false);
        setPagosDraft([
          {
            id: generateUuidV4(),
            cuentaId: cuentaFavorita.id,
            monto: String(importeTotal || 0),
            fecha: toISODateLocal(new Date()),
            descripcion: "",
          },
        ]);
      }
      return next;
    });
  }, [cuentaFavorita, importeTotal]);

  const totalPagado = useMemo(() => {
    return pagosDraft.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
  }, [pagosDraft]);

  const computedEstadoPago: EstadoPagoOperacion = useMemo(() => {
    if (importeTotal <= 0) return "PAGADO";
    if (pagosDraft.length === 0) return "PENDIENTE";
    if (totalPagado >= importeTotal) return "PAGADO";
    if (totalPagado > 0) return "PARCIAL";
    return "PENDIENTE";
  }, [importeTotal, pagosDraft.length, totalPagado]);

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

      if (importeTotal > 0 && pagosDraft.length > 0) {
        const allPagosValid = pagosDraft.every((p) => {
          if (p.cuentaId === CREATE_CUENTA_VALUE) {
            return validateCuentaFinancieraForm(p.cuentaDraft);
          }
          return Boolean(p.cuentaId);
        });
        if (!allPagosValid) return false;
      }

      return true;
    }

    if (!tallerId) return false;
    if (lineas.length === 0) return false;

    const allLinesValid = lineas.every(
      (l) =>
        Boolean(l.stockId) &&
        Number(l.cantidad) > 0 &&
        Number.isFinite(l.unitario) &&
        (l.cantidadEntregar === undefined || (Number(l.cantidadEntregar) >= 0 && Number(l.cantidadEntregar) <= Number(l.cantidad)))
    );
    if (!allLinesValid) return false;

    if (importeTotal > 0 && pagosDraft.length > 0) {
      const allPagosValid = pagosDraft.every((p) => {
        if (p.cuentaId === CREATE_CUENTA_VALUE) {
          return validateCuentaFinancieraForm(p.cuentaDraft);
        }
        return Boolean(p.cuentaId);
      });
      if (!allPagosValid) return false;
    }

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
    pagosDraft,
    isEditingGasto,
  ]);

  const isSubmitting = isOperacionesLoading || isSubmittingGasto;

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !tipo) return;
    const fechaTimestamp = toISODateTimeWithLocalCurrentTime(fecha);
    if (!fechaTimestamp) return;

    let targetCuentaId: string | null = cuentaFinancieraId || null;
    if (cuentaFinancieraId && isCreatingCuenta) {
      const created = await createCuenta({
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
      const pagosPayload: {
        cuenta_id: string;
        cuenta_financiera_id: string;
        monto: number;
        fecha: string;
        descripcion: string | null;
      }[] = [];

      if (importeTotal > 0 && pagosDraft.length > 0) {
        for (const p of pagosDraft) {
          const montoNum = Number(p.monto) || 0;
          if (montoNum <= 0) continue;
          let accId = p.cuentaId;
          if (accId === CREATE_CUENTA_VALUE && p.cuentaDraft) {
            const created = await createCuenta({
              nombre: p.cuentaDraft.nombre.trim(),
              tipo: p.cuentaDraft.tipo,
              saldoInicial: 0,
            });
            accId = created.id;
          }
          if (accId) {
            pagosPayload.push({
              cuenta_id: accId,
              cuenta_financiera_id: accId,
              monto: montoNum,
              fecha: toISODateTimeWithLocalCurrentTime(p.fecha || fecha) || fechaTimestamp,
              descripcion: p.descripcion.trim() || null,
            });
          }
        }
      }

      const primaryCuentaId = pagosPayload.length > 0
        ? pagosPayload[0].cuenta_financiera_id
        : (computedEstadoPago === "PENDIENTE" ? null : (targetCuentaId || null));

      const payload = {
        tipo,
        taller_id: tallerId || null,
        fecha: fechaTimestamp,
        cuenta_financiera_id: primaryCuentaId,
        observaciones: observaciones.trim() || null,
        idempotency_key: generateUuidV4(),
        estado_pago: computedEstadoPago,
        monto_inicial: computedEstadoPago === "PARCIAL" ? totalPagado : null,
        mover_stock: moverStock,
        proveedor_id: tipo === "COMPRA" && proveedorId ? proveedorId : null,
        cliente_id: tipo === "VENTA" && clienteId ? clienteId : null,
        pagos: pagosPayload.length > 0 ? pagosPayload : undefined,
        monto: tipo === "GASTO" ? Number(montoGasto) : undefined,
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
          };
        }),
      };

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
  };

  return (
    <OperacionFormContext.Provider value={value}>
      {children}
    </OperacionFormContext.Provider>
  );
}
