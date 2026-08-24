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
import type {
  ActualizarCuentaFinancieraInput,
  CrearCuentaFinancieraInput,
  CrearTransferenciaFinancieraInput,
  CuentaFinanciera,
  ListarMovimientosFinancierosInput,
  MovimientoFinanciero,
  TransferenciaFinanciera,
} from "@/model/finanzas";

export type CuentasFinancierasContextType = {
  cuentas: CuentaFinanciera[];
  cuentasActivas: CuentaFinanciera[];
  saldoTotal: number;
  loading: boolean;
  loadError: string | null;
  loadCuentas: () => Promise<void>;
  getCuentaById: (id: string) => Promise<CuentaFinanciera | null>;
  createCuenta: (input: CrearCuentaFinancieraInput) => Promise<CuentaFinanciera>;
  updateCuenta: (
    id: string,
    input: ActualizarCuentaFinancieraInput
  ) => Promise<CuentaFinanciera>;
  deleteCuenta: (id: string) => Promise<void>;
  createTransferencia: (
    input: CrearTransferenciaFinancieraInput
  ) => Promise<TransferenciaFinanciera>;
  getMovimientos: (
    cuentaId: string,
    filters?: ListarMovimientosFinancierosInput
  ) => Promise<MovimientoFinanciero[]>;
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
  const inFlightPromiseRef = useRef<Promise<void> | null>(null);
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
          setCuentas([]);
        } else {
          setCuentas(res.data ?? []);
          hasLoadedRef.current = true;
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "No se pudieron cargar las cuentas financieras";
        setLoadError(msg);
        setCuentas([]);
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

  const saldoTotal = useMemo(
    () =>
      cuentasActivas.reduce(
        (total, cuenta) => total + (Number(cuenta.saldoActual) || 0),
        0
      ),
    [cuentasActivas]
  );

  const getCuentaById = useCallback(
    async (id: string): Promise<CuentaFinanciera | null> => {
      try {
        const res = await finanzasClient.obtenerCuenta(id);
        if (res.error || !res.data) {
          return null;
        }
        const updated = res.data;
        setCuentas((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        );
        return updated;
      } catch {
        return null;
      }
    },
    []
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
          previous.map((item) => (item.id === updated.id ? updated : item))
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
        console.info("[CuentasFinancierasProvider] Creando transferencia con input:", input);
        const res = await finanzasClient.crearTransferencia(input);
        if (res.error || !res.data) {
          const errorMsg = res.error || "No se pudo registrar la transferencia.";
          console.error("[CuentasFinancierasProvider] Falló crearTransferencia:", errorMsg, { input, res });
          throw new Error(errorMsg);
        }
        await loadCuentas();
        return res.data;
      } catch (err) {
        console.error("[CuentasFinancierasProvider] Excepción en createTransferencia:", err);
        throw err;
      } finally {
        setLoading(false);
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
      saldoTotal,
      loading,
      loadError,
      loadCuentas,
      getCuentaById,
      createCuenta,
      updateCuenta,
      deleteCuenta,
      createTransferencia,
      getMovimientos,
    }),
    [
      cuentas,
      cuentasActivas,
      saldoTotal,
      loading,
      loadError,
      loadCuentas,
      getCuentaById,
      createCuenta,
      updateCuenta,
      deleteCuenta,
      createTransferencia,
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

