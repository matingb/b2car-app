"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { finanzasClient } from "@/clients/finanzasClient";
import { logger } from "@/lib/logger";
import type {
  ActualizarCuentaFinancieraInput,
  CrearCuentaFinancieraInput,
  CrearIngresoManualInput,
  CrearTransferenciaFinancieraInput,
  CuentaFinanciera,
  IngresoManualFinanciero,
  ListarMovimientosFinancierosInput,
  MovimientoFinanciero,
  TransferenciaFinanciera,
} from "@/model/finanzas";

export type CuentasFinancierasContextType = {
  cuentas: CuentaFinanciera[];
  cuentasActivas: CuentaFinanciera[];
  cuentaFavorita: CuentaFinanciera | null;
  saldoTotal: number;
  loading: boolean;
  loadError: string | null;
  loadCuentas: (opts?: { silent?: boolean }) => Promise<boolean>;
  /** Recarga las cuentas; alias público para las pantallas consumidoras. */
  refresh: () => Promise<boolean>;
  getCuentaById: (id: string) => Promise<CuentaFinanciera | null>;
  getCuentaByIdResult: (id: string) => Promise<CuentaLookupResult>;
  createCuenta: (input: CrearCuentaFinancieraInput) => Promise<CuentaFinanciera>;
  updateCuenta: (
    id: string,
    input: ActualizarCuentaFinancieraInput
  ) => Promise<CuentaFinanciera>;
  deleteCuenta: (id: string) => Promise<void>;
  createTransferencia: (
    input: CrearTransferenciaFinancieraInput
  ) => Promise<TransferenciaFinanciera>;
  createIngresoManual: (input: CrearIngresoManualInput) => Promise<IngresoManualFinanciero>;
  getMovimientos: (
    cuentaId: string,
    filters?: ListarMovimientosFinancierosInput
  ) => Promise<MovimientoFinanciero[]>;
};

export type CuentaLookupResult = {
  data: CuentaFinanciera | null;
  error: string | null;
};

const CuentasFinancierasContext =
  createContext<CuentasFinancierasContextType | null>(null);

export function CuentasFinancierasProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cuentas, setCuentas] = useState<CuentaFinanciera[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const inFlightPromiseRef = useRef<Promise<boolean> | null>(null);
  const hasLoadedRef = useRef(false);

  const loadCuentas = useCallback(async (opts?: { silent?: boolean }) => {
    if (inFlightPromiseRef.current) {
      return inFlightPromiseRef.current;
    }
    const run = async () => {
      if (!opts?.silent && !hasLoadedRef.current) {
        setLoading(true);
      }
      setLoadError(null);
      try {
        const res = await finanzasClient.listarCuentas();
        if (res.error) {
          setLoadError(res.error);
          return false;
        } else {
          setCuentas(res.data ?? []);
          hasLoadedRef.current = true;
          return true;
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "No se pudieron cargar las cuentas financieras";
        setLoadError(msg);
        return false;
      } finally {
        setLoading(false);
        inFlightPromiseRef.current = null;
      }
    };
    const promise = run();
    inFlightPromiseRef.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    void loadCuentas();
  }, [loadCuentas]);

  const cuentasActivas = useMemo(
    () => cuentas.filter((cuenta) => cuenta.activo),
    [cuentas]
  );

  const cuentaFavorita = useMemo(
    () => cuentasActivas.find((cuenta) => cuenta.favorita) ?? null,
    [cuentasActivas]
  );

  const saldoTotal = useMemo(
    () =>
      cuentasActivas.reduce(
        (total, cuenta) => total + (Number(cuenta.saldoActual) || 0),
        0
      ),
    [cuentasActivas]
  );

  const getCuentaByIdResult = useCallback(
    async (id: string): Promise<CuentaLookupResult> => {
      try {
        const res = await finanzasClient.obtenerCuenta(id);
        if (res.error || !res.data) {
          return { data: null, error: res.error || "No se encontró la cuenta solicitada." };
        }
        const updated = res.data;
        setCuentas((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        );
        return { data: updated, error: null };
      } catch (err: unknown) {
        return {
          data: null,
          error: err instanceof Error ? err.message : "No se pudo cargar la cuenta financiera",
        };
      }
    },
    []
  );

  const getCuentaById = useCallback(
    async (id: string): Promise<CuentaFinanciera | null> => {
      const result = await getCuentaByIdResult(id);
      return result.data;
    },
    [getCuentaByIdResult]
  );

  const createCuenta = useCallback(
    async (input: CrearCuentaFinancieraInput): Promise<CuentaFinanciera> => {
      setLoading(true);
      try {
        const res = await finanzasClient.crearCuenta(input);
        if (res.error || !res.data) {
          throw new Error(res.error || "No se pudo crear la cuenta.");
        }
        const created = res.data;
        setCuentas((previous) => [...previous, created]);
        return created;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateCuenta = useCallback(
    async (
      id: string,
      input: ActualizarCuentaFinancieraInput
    ): Promise<CuentaFinanciera> => {
      setLoading(true);
      try {
        const res = await finanzasClient.actualizarCuenta(id, input);
        if (res.error || !res.data) {
          throw new Error(res.error || "No se pudo actualizar la cuenta.");
        }
        const updated = res.data;
        setCuentas((previous) =>
          previous.map((item) => {
            if (item.id === updated.id) return updated;
            return input.favorita === true ? { ...item, favorita: false } : item;
          })
        );
        return updated;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteCuenta = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    try {
      const res = await finanzasClient.eliminarCuenta(id);
      if (res.error) {
        throw new Error(res.error);
      }
      setCuentas((previous) => previous.filter((item) => item.id !== id));
    } finally {
      setLoading(false);
    }
  }, []);

  const createTransferencia = useCallback(
    async (
      input: CrearTransferenciaFinancieraInput
    ): Promise<TransferenciaFinanciera> => {
      setLoading(true);
      try {
        const res = await finanzasClient.crearTransferencia(input);
        if (res.error || !res.data) {
          const errorMsg = res.error || "No se pudo registrar la transferencia.";
          throw new Error(errorMsg);
        }
        await loadCuentas();
        return res.data;
      } catch (err) {
        logger.error("No se pudo registrar la transferencia", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadCuentas]
  );

  const createIngresoManual = useCallback(
    async (input: CrearIngresoManualInput): Promise<IngresoManualFinanciero> => {
      try {
        const res = await finanzasClient.crearIngresoManual(input);
        if (res.error || !res.data) {
          throw new Error(res.error || "No se pudo registrar el ingreso manual.");
        }
        const pendingLoad = inFlightPromiseRef.current;
        if (pendingLoad) await pendingLoad;
        await loadCuentas({ silent: true });
        return res.data;
      } catch (err) {
        logger.error("No se pudo registrar el ingreso manual", err);
        throw err;
      }
    },
    [loadCuentas]
  );

  const getMovimientos = useCallback(
    async (
      cuentaId: string,
      filters?: ListarMovimientosFinancierosInput
    ): Promise<MovimientoFinanciero[]> => {
      const res =
        filters !== undefined
          ? await finanzasClient.listarMovimientos(cuentaId, filters)
          : await finanzasClient.listarMovimientos(cuentaId);
      if (res.error) {
        throw new Error(res.error);
      }
      return res.data ?? [];
    },
    []
  );

  const value = useMemo<CuentasFinancierasContextType>(
    () => ({
      cuentas,
      cuentasActivas,
      cuentaFavorita,
      saldoTotal,
      loading,
      loadError,
      loadCuentas,
      refresh: loadCuentas,
      getCuentaById,
      getCuentaByIdResult,
      createCuenta,
      updateCuenta,
      deleteCuenta,
      createTransferencia,
      createIngresoManual,
      getMovimientos,
    }),
    [
      cuentas,
      cuentasActivas,
      cuentaFavorita,
      saldoTotal,
      loading,
      loadError,
      loadCuentas,
      getCuentaById,
      getCuentaByIdResult,
      createCuenta,
      updateCuenta,
      deleteCuenta,
      createTransferencia,
      createIngresoManual,
      getMovimientos,
    ]
  );

  return (
    <CuentasFinancierasContext.Provider value={value}>
      {children}
    </CuentasFinancierasContext.Provider>
  );
}
export function useCuentasFinancieras() {
  const ctx = useContext(CuentasFinancierasContext);
  if (!ctx) {
    throw new Error(
      "useCuentasFinancieras debe usarse dentro de CuentasFinancierasProvider"
    );
  }

  const { loadCuentas } = ctx;

  useEffect(() => {
    loadCuentas();
  }, [loadCuentas]);

  return ctx;
}

