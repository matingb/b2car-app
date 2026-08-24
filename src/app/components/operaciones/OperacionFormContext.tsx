"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useOperaciones } from "@/app/providers/OperacionesProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useCuentasFinancieras } from "@/app/providers/CuentasFinancierasProvider";
import { useInventario } from "@/app/providers/InventarioProvider";
import { finanzasClient } from "@/clients/finanzasClient";
import { isValidDate, toISODateLocal } from "@/lib/fechas";
import { generateUuidV4 } from "@/lib/uuid";
import type { TipoOperacion } from "@/model/types";
import type { GastoFinanciero } from "@/model/finanzas";
import type { AutocompleteOption } from "@/app/components/ui/Autocomplete";
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

type StockItemWithActual = ProductoLite & { stockActual: number };

type OperacionFormContextValue = {
  open: boolean;
  onClose: () => void;
  talleres: TallerLite[];
  tipo: TipoOperacion | null;
  setTipo: (tipo: TipoOperacion) => void;
  tallerId: string;
  setTallerId: (id: string) => void;
  fecha: string;
  setFecha: (fecha: string) => void;
  cuentaFinancieraId: string;
  setCuentaFinancieraId: (id: string) => void;
  isEditingGasto: boolean;
  gasto: GastoFinanciero | null | undefined;
  tipoConfigById: Map<TipoOperacion, TipoOperacionConfig>;
  isTipoEnabled: (value: TipoOperacion | null) => boolean;

  // Gasto
  categoriaGasto: string;
  setCategoriaGasto: (cat: string) => void;
  montoGasto: string;
  setMontoGasto: (monto: string) => void;
  descripcionGasto: string;
  setDescripcionGasto: (desc: string) => void;

  // Stock
  lineas: OperacionLineaDraft[];
  addLinea: () => void;
  removeLinea: (index: number) => void;
  setLineaAt: (index: number, linea: OperacionLineaDraft) => void;
  stockOptions: AutocompleteOption[];
  stockById: Map<string, StockItemWithActual>;
  isInventarioLoading: boolean;
  getDefaultUnitarioForStockId: (stockId: string) => number | null;

  // Submit & Validation
  canSubmit: boolean;
  isSubmitting: boolean;
  submitForm: (e: React.FormEvent) => Promise<void>;
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
  gasto,
  children,
}: OperacionModalProps & { children: React.ReactNode }) {
  const { create, loading: isOperacionesLoading, refresh: refreshOperaciones } = useOperaciones();
  const { success, error } = useToast();
  const { loading: isLoadingCuentas, refresh: refreshCuentas } = useCuentasFinancieras();

  const [tipo, setTipo] = useState<TipoOperacion | null>(gasto ? "GASTO" : initialTipo ?? "VENTA");
  const [tallerId, setTallerId] = useState<string>("");
  const [cuentaFinancieraId, setCuentaFinancieraId] = useState<string>(gasto?.cuentaId ?? initialCuentaId ?? "");
  const [fecha, setFecha] = useState<string>(() => (gasto?.fecha ? gasto.fecha.slice(0, 10) : toISODateLocal(new Date())));
  const [lineas, setLineas] = useState<OperacionLineaDraft[]>([createEmptyLinea()]);

  const [categoriaGasto, setCategoriaGasto] = useState<string>(gasto?.categoria ?? "ALQUILER");
  const [montoGasto, setMontoGasto] = useState<string>(gasto ? String(gasto.importe) : "");
  const [descripcionGasto, setDescripcionGasto] = useState<string>(gasto?.descripcion ?? "");
  const [isSubmittingGasto, setIsSubmittingGasto] = useState(false);

  const { inventario, isLoading: isInventarioLoading } = useInventario(tallerId || undefined);
  const didInitRef = useRef(false);

  const tipoConfigById = useMemo(
    () => new Map(TIPOS_UI.map((t) => [t.tipo, t])),
    [],
  );

  const isTipoEnabled = useCallback(
    (value: TipoOperacion | null) => {
      if (!value) return false;
      return !tipoConfigById.get(value)?.disabled;
    },
    [tipoConfigById],
  );

  useEffect(() => {
    if (!open) {
      didInitRef.current = false;
      return;
    }
    if (didInitRef.current) return;
    didInitRef.current = true;

    if (gasto) {
      setTipo("GASTO");
      setFecha(gasto.fecha ? gasto.fecha.slice(0, 10) : toISODateLocal(new Date()));
      setLineas([createEmptyLinea()]);
      setTallerId(talleres.length === 1 ? talleres[0].id : "");
      setCuentaFinancieraId(gasto.cuentaId || "");
      setCategoriaGasto(gasto.categoria || "ALQUILER");
      setMontoGasto(String(gasto.importe || ""));
      setDescripcionGasto(gasto.descripcion || "");
      return;
    }

    setTipo(initialTipo ?? "VENTA");
    setFecha(toISODateLocal(new Date()));
    setLineas([createEmptyLinea()]);
    setTallerId(talleres.length === 1 ? talleres[0].id : "");
    setCuentaFinancieraId(initialCuentaId ?? "");
    setCategoriaGasto("ALQUILER");
    setMontoGasto("");
    setDescripcionGasto("");
  }, [open, talleres, initialTipo, initialCuentaId, gasto]);

  useEffect(() => {
    if (!open) return;
    if (tallerId) return;
    if (talleres.length === 1) setTallerId(talleres[0].id);
  }, [open, talleres, tallerId]);

  const stockItems = useMemo<StockItemWithActual[]>(
    () =>
      (inventario ?? []).map((s) => ({
        id: s.id,
        nombre: s.nombre,
        codigo: s.codigo,
        precio_unitario: Number(s.precioUnitario) || 0,
        costo_unitario: Number(s.costoUnitario) || 0,
        stockActual: Number(s.stockActual) || 0,
      })),
    [inventario]
  );

  // Recalcular unitario desde stock/producto y total al cambiar tipo (VENTA / COMPRA)
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
        const unitario = getDefaultUnitario(item, tipo);
        const total = round2((Number(linea.cantidad) || 0) * unitario);
        return { ...linea, unitario, total };
      }),
    );
  }, [tipo, stockItems, open, isTipoEnabled]);

  const stockById = useMemo(() => new Map(stockItems.map((s) => [s.id, s])), [stockItems]);

  const stockOptions = useMemo<AutocompleteOption[]>(
    () =>
      stockItems.map((s) => ({
        value: s.id,
        label: s.nombre,
        secondaryLabel: `${s.codigo || ""}${s.codigo ? " · " : ""}Stock: ${Number(s.stockActual) || 0}`,
      })),
    [stockItems],
  );

  const getDefaultUnitarioForStockId = useCallback(
    (stockId: string): number | null => {
      if (!tipo || !isTipoEnabled(tipo) || tipo === "GASTO") return null;
      const item = stockById.get(stockId);
      if (!item) return null;
      return getDefaultUnitario(item, tipo);
    },
    [tipo, isTipoEnabled, stockById],
  );

  const setLineaAt = useCallback((idx: number, nextLinea: OperacionLineaDraft) => {
    setLineas((prev) => prev.map((l, i) => (i === idx ? nextLinea : l)));
  }, []);

  const addLinea = useCallback(() => {
    setLineas((prev) => [...prev, createEmptyLinea()]);
  }, []);

  const removeLinea = useCallback((idx: number) => {
    setLineas((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const canSubmit = useMemo(() => {
    if (!open) return false;
    if (!tipo || !isTipoEnabled(tipo)) return false;
    if (!cuentaFinancieraId) return false;
    if (!isValidDate(fecha)) return false;

    if (tipo === "GASTO") {
      const importeNum = Number(montoGasto);
      return (
        Boolean(categoriaGasto) &&
        Boolean(descripcionGasto.trim()) &&
        Number.isFinite(importeNum) &&
        importeNum > 0 &&
        !isLoadingCuentas &&
        !isSubmittingGasto
      );
    }

    if (!tallerId) return false;
    if (lineas.length === 0) return false;
    return lineas.every(
      (l) =>
        Boolean(l.stockId) &&
        Number(l.cantidad) > 0 &&
        Number.isFinite(l.unitario),
    );
  }, [
    open,
    tipo,
    isTipoEnabled,
    cuentaFinancieraId,
    fecha,
    montoGasto,
    categoriaGasto,
    descripcionGasto,
    isLoadingCuentas,
    isSubmittingGasto,
    tallerId,
    lineas,
  ]);

  const isSubmitting = isOperacionesLoading || isSubmittingGasto;

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !tipo) return;

    if (tipo === "GASTO") {
      setIsSubmittingGasto(true);
      try {
        const payload = {
          cuentaId: cuentaFinancieraId,
          categoria: categoriaGasto,
          importe: Number(montoGasto),
          fecha,
          descripcion: descripcionGasto.trim(),
          idempotencyKey: generateUuidV4(),
        };
        const response = gasto
          ? await finanzasClient.actualizarGasto(gasto.id, payload)
          : await finanzasClient.crearGasto(payload);
        if (response.error || !response.data) {
          throw new Error(response.error || (gasto ? "No se pudo actualizar el gasto" : "No se pudo registrar el gasto"));
        }
        await refreshOperaciones();
        await refreshCuentas();
        success(gasto ? "Gasto actualizado" : "Gasto registrado", "El movimiento financiero se guardó correctamente.");
        onClose();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : (gasto ? "No se pudo actualizar el gasto" : "No se pudo registrar el gasto");
        error(gasto ? "Error actualizando gasto" : "Error registrando gasto", msg);
      } finally {
        setIsSubmittingGasto(false);
      }
      return;
    }

    try {
      const payload = {
        tipo,
        taller_id: tallerId,
        fecha,
        cuenta_financiera_id: cuentaFinancieraId,
        idempotency_key: generateUuidV4(),
        lineas: lineas.map((l) => {
          const cantidad = Number(l.cantidad) || 0;
          const unitario = Number(l.unitario) || 0;
          const delta = tipo === "VENTA" ? -cantidad : cantidad;
          return {
            stock_id: l.stockId,
            cantidad,
            monto_unitario: unitario,
            delta_cantidad: delta,
          };
        }),
      };

      const created = await create(payload);
      if (created) {
        const tallerNombre = talleres.find((t) => t.id === tallerId)?.nombre ?? "el taller seleccionado";
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
    fecha,
    setFecha,
    cuentaFinancieraId,
    setCuentaFinancieraId,
    isEditingGasto: Boolean(gasto),
    gasto,
    tipoConfigById,
    isTipoEnabled,
    categoriaGasto,
    setCategoriaGasto,
    montoGasto,
    setMontoGasto,
    descripcionGasto,
    setDescripcionGasto,
    lineas,
    addLinea,
    removeLinea,
    setLineaAt,
    stockOptions,
    stockById,
    isInventarioLoading,
    getDefaultUnitarioForStockId,
    canSubmit,
    isSubmitting,
    submitForm,
  };

  return (
    <OperacionFormContext.Provider value={value}>
      {children}
    </OperacionFormContext.Provider>
  );
}
