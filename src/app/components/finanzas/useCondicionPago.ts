"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateUuidV4 } from "@/lib/uuid";
import { toISODateLocal, toISODateTimeWithLocalCurrentTime } from "@/lib/fechas";
import type { EstadoPagoOperacion } from "@/model/types";
import type { TipoCuentaFinanciera } from "@/model/finanzas";
import {
  type CuentaFinancieraDraft,
  EMPTY_CUENTA_FINANCIERA_DRAFT,
  validateCuentaFinancieraForm,
} from "@/app/components/finanzas/CuentaFinancieraFormFields";
import { CREATE_CUENTA_VALUE } from "@/app/components/finanzas/CuentaFinancieraAutocomplete";

export { CREATE_CUENTA_VALUE };

export interface PagoDraftItem {
  id: string;
  cuentaId: string;
  monto: string;
  fecha: string;
  descripcion: string;
  cuentaDraft?: CuentaFinancieraDraft;
}

export interface UseCondicionPagoOptions {
  open?: boolean;
  targetAmount: number;
  cuentaFavorita?: { id: string; nombre: string } | null;
  cuentasActivas?: { id: string; nombre: string }[];
  initialCuentaId?: string;
  initialFecha?: string;
  initialMonto?: string;
  initialPagos?: PagoDraftItem[];
  minRows?: number; // 0: permite diferido (operaciones), 1: exige al menos 1 fila de pago (cobros)
  maxAmount?: number;
  defaultFecha?: string;
}

export interface UseCondicionPagoResult {
  // Estado
  pagosDraft: PagoDraftItem[];
  setPagosDraft: React.Dispatch<React.SetStateAction<PagoDraftItem[]>>;
  showAdvanced: boolean;
  setShowAdvanced: React.Dispatch<React.SetStateAction<boolean>>;
  isPagoModificado: boolean;
  setIsPagoModificado: (modificado: boolean) => void;

  // Derivados
  totalPagado: number;
  saldoRestante: number;
  computedEstadoPago: EstadoPagoOperacion;
  noPagar: boolean;
  canSubmitPagos: boolean;

  // Handlers
  handleAddPagoRow: () => void;
  handleRemovePagoRow: (id: string) => void;
  handleRestoreFavorita: () => void;
  handleUpdatePagoRow: (id: string, field: keyof PagoDraftItem, val: string) => void;
  handleUpdatePagoCuentaDraft: (id: string, patch: Partial<CuentaFinancieraDraft>) => void;
  handleToggleAdvanced: () => void;
  setNoPagar: (noPagar: boolean) => void;
  setEstadoPago: (estado: EstadoPagoOperacion) => void;

  // Resolución de cuentas creadas al vuelo
  resolvePagosPayload: (
    createCuentaFn?: (draft: {
      nombre: string;
      tipo: TipoCuentaFinanciera;
      saldoInicial: number;
    }) => Promise<{ id: string; nombre: string }>,
    baseFecha?: string
  ) => Promise<{
    cuenta_id: string;
    cuenta_financiera_id: string;
    monto: number;
    fecha: string;
    descripcion: string | null;
  }[]>;

  // Bundles de props listos para la UI
  pagoSectionProps: {
    pagos: PagoDraftItem[];
    onAddPago: () => void;
    onRemovePago: (id: string) => void;
    onUpdatePago: (id: string, field: keyof PagoDraftItem, value: string) => void;
    onUpdatePagoCuentaDraft: (id: string, patch: Partial<CuentaFinancieraDraft>) => void;
    onRestoreFavorita: () => void;
    noPagar: boolean;
    onNoPagarChange: (val: boolean) => void;
    showAdvanced: boolean;
    onToggleAdvanced: () => void;
  };
  registrarPagoProps: {
    pagos: PagoDraftItem[];
    onAddPago: () => void;
    onRemovePago: (id: string) => void;
    onUpdatePago: (id: string, field: keyof PagoDraftItem, value: string) => void;
    onUpdatePagoCuentaDraft: (id: string, patch: Partial<CuentaFinancieraDraft>) => void;
  };
}

export function useCondicionPago({
  open = true,
  targetAmount,
  cuentaFavorita,
  cuentasActivas,
  initialCuentaId,
  initialFecha,
  initialMonto,
  initialPagos,
  minRows = 0,
  maxAmount,
  defaultFecha: propDefaultFecha,
}: UseCondicionPagoOptions): UseCondicionPagoResult {
  const defaultFecha = useMemo(
    () => propDefaultFecha || initialFecha || toISODateLocal(new Date()),
    [propDefaultFecha, initialFecha]
  );

  const initialAcc = initialCuentaId ?? cuentaFavorita?.id ?? "";

  const [pagosDraft, setPagosDraft] = useState<PagoDraftItem[]>(() => {
    if (initialPagos && initialPagos.length > 0) return initialPagos;
    return [
      {
        id: generateUuidV4(),
        cuentaId: initialAcc,
        monto: initialMonto ?? "",
        fecha: defaultFecha,
        descripcion: "",
      },
    ];
  });

  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [isPagoModificado, setIsPagoModificado] = useState<boolean>(false);
  const didInitRef = useRef(false);

  // Reiniciar estado al abrir/cerrar modal
  useEffect(() => {
    if (!open) {
      didInitRef.current = false;
      setIsPagoModificado(false);
      return;
    }
    if (didInitRef.current) return;
    didInitRef.current = true;
    setIsPagoModificado(false);
    setShowAdvanced(false);

    if (initialPagos && initialPagos.length > 0) {
      setPagosDraft(initialPagos);
      return;
    }

    const acc = initialCuentaId ?? cuentaFavorita?.id ?? "";
    setPagosDraft([
      {
        id: generateUuidV4(),
        cuentaId: acc,
        monto: initialMonto ?? (targetAmount > 0 && initialMonto === undefined ? String(targetAmount) : ""),
        fecha: defaultFecha,
        descripcion: "",
      },
    ]);
  }, [open, initialCuentaId, cuentaFavorita?.id, initialMonto, targetAmount, defaultFecha, initialPagos]);

  // Si cuentaFavorita carga asíncronamente y no hay cuenta seleccionada
  useEffect(() => {
    if (!open || initialCuentaId || !cuentaFavorita?.id) return;
    setPagosDraft((prev) => {
      if (prev.length > 0 && !prev[0].cuentaId) {
        return prev.map((p, i) => (i === 0 ? { ...p, cuentaId: cuentaFavorita.id } : p));
      }
      return prev;
    });
  }, [open, initialCuentaId, cuentaFavorita?.id]);

  // Sincronización automática de pagosDraft[0].monto hacia targetAmount mientras no haya modificación manual
  useEffect(() => {
    if (isPagoModificado) return;

    const activeAccount = cuentaFavorita?.id ?? initialCuentaId ?? "";
    const targetMontoStr = String(targetAmount || 0);

    setPagosDraft((prev) => {
      if (prev.length !== 1) return prev;

      const currentMontoNum = Number(prev[0].monto) || 0;
      const targetMontoNum = targetAmount;
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
          fecha: prev[0].fecha || defaultFecha,
          descripcion: prev[0].descripcion || "",
        },
      ];
    });
  }, [isPagoModificado, targetAmount, cuentaFavorita?.id, initialCuentaId, defaultFecha]);

  const totalPagado = useMemo(() => {
    return pagosDraft.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
  }, [pagosDraft]);

  const saldoRestante = useMemo(() => {
    return Math.max(0, targetAmount - totalPagado);
  }, [targetAmount, totalPagado]);

  const computedEstadoPago: EstadoPagoOperacion = useMemo(() => {
    if (targetAmount <= 0) return "PAGADO";
    if (pagosDraft.length === 0) return "PENDIENTE";
    if (totalPagado >= targetAmount) return "PAGADO";
    if (totalPagado > 0) return "PARCIAL";
    return "PENDIENTE";
  }, [targetAmount, pagosDraft.length, totalPagado]);

  const noPagar = pagosDraft.length === 0;

  const handleAddPagoRow = useCallback(() => {
    const nextCuentaId = cuentaFavorita?.id ?? cuentasActivas?.[0]?.id ?? "";
    const totalActual = pagosDraft.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
    const restante = Math.max(0, targetAmount - totalActual);

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
          monto: restante > 0 ? String(restante) : (targetAmount > 0 ? String(targetAmount) : ""),
          fecha: defaultFecha,
          descripcion: "",
        },
      ];
    });
  }, [cuentasActivas, cuentaFavorita, pagosDraft, targetAmount, defaultFecha]);

  const handleRemovePagoRow = useCallback((id: string) => {
    if (minRows > 0 && pagosDraft.length <= minRows) return;
    setIsPagoModificado(true);
    setPagosDraft((prev) => {
      if (minRows > 0 && prev.length <= minRows) return prev;
      return prev.filter((p) => p.id !== id);
    });
  }, [minRows, pagosDraft.length]);

  const handleRestoreFavorita = useCallback(() => {
    if (!cuentaFavorita) return;
    setIsPagoModificado(false);
    setPagosDraft([
      {
        id: generateUuidV4(),
        cuentaId: cuentaFavorita.id,
        monto: String(targetAmount || 0),
        fecha: defaultFecha,
        descripcion: "",
      },
    ]);
  }, [cuentaFavorita, targetAmount, defaultFecha]);

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
            monto: String(targetAmount || 0),
            fecha: defaultFecha,
            descripcion: "",
          },
        ]);
      }
      return next;
    });
  }, [cuentaFavorita, targetAmount, defaultFecha]);

  const setNoPagar = useCallback((val: boolean) => {
    if (val) {
      setIsPagoModificado(true);
      setPagosDraft([]);
    } else {
      setIsPagoModificado(false);
      setPagosDraft((prev) => {
        if (prev.length > 0) return prev;
        const activeAcc = cuentaFavorita?.id ?? initialCuentaId ?? "";
        return [
          {
            id: generateUuidV4(),
            cuentaId: activeAcc,
            monto: String(targetAmount || 0),
            fecha: defaultFecha,
            descripcion: "",
          },
        ];
      });
    }
  }, [cuentaFavorita?.id, initialCuentaId, targetAmount, defaultFecha]);

  const setEstadoPago = useCallback((nuevo: EstadoPagoOperacion) => {
    if (nuevo === "PENDIENTE") {
      setIsPagoModificado(true);
      setPagosDraft([]);
    } else {
      setIsPagoModificado(false);
      setPagosDraft((prev) => {
        if (prev.length > 0) return prev;
        const activeAcc = cuentaFavorita?.id ?? initialCuentaId ?? "";
        return [
          {
            id: generateUuidV4(),
            cuentaId: activeAcc,
            monto: String(targetAmount || 0),
            fecha: defaultFecha,
            descripcion: "",
          },
        ];
      });
    }
  }, [cuentaFavorita?.id, initialCuentaId, targetAmount, defaultFecha]);

  const canSubmitPagos = useMemo(() => {
    if (minRows > 0 && pagosDraft.length < minRows) return false;
    if (pagosDraft.length === 0) return true;

    const allValid = pagosDraft.every((p) => {
      if (p.cuentaId === CREATE_CUENTA_VALUE) {
        return validateCuentaFinancieraForm(p.cuentaDraft);
      }
      return Boolean(p.cuentaId);
    });
    if (!allValid) return false;

    if (maxAmount !== undefined && totalPagado > maxAmount) return false;

    return true;
  }, [minRows, pagosDraft, maxAmount, totalPagado]);

  const resolvePagosPayload = useCallback(
    async (
      createCuentaFn?: (draft: {
        nombre: string;
        tipo: TipoCuentaFinanciera;
        saldoInicial: number;
      }) => Promise<{ id: string; nombre: string }>,
      baseFecha?: string
    ) => {
      const result: {
        cuenta_id: string;
        cuenta_financiera_id: string;
        monto: number;
        fecha: string;
        descripcion: string | null;
      }[] = [];

      if (targetAmount > 0 && pagosDraft.length > 0) {
        for (const p of pagosDraft) {
          const montoNum = Number(p.monto) || 0;
          if (montoNum <= 0) continue;

          let accId = p.cuentaId;
          if (accId === CREATE_CUENTA_VALUE && p.cuentaDraft && createCuentaFn) {
            const created = await createCuentaFn({
              nombre: p.cuentaDraft.nombre.trim(),
              tipo: p.cuentaDraft.tipo,
              saldoInicial: 0,
            });
            accId = created.id;
          }

          if (accId) {
            const fechaVal = p.fecha || baseFecha || defaultFecha;
            const finalTimestamp =
              toISODateTimeWithLocalCurrentTime(fechaVal) ||
              toISODateTimeWithLocalCurrentTime(baseFecha || defaultFecha) ||
              fechaVal;

            result.push({
              cuenta_id: accId,
              cuenta_financiera_id: accId,
              monto: montoNum,
              fecha: finalTimestamp,
              descripcion: p.descripcion.trim() || null,
            });
          }
        }
      }

      return result;
    },
    [targetAmount, pagosDraft, defaultFecha]
  );

  const pagoSectionProps = useMemo(
    () => ({
      pagos: pagosDraft,
      onAddPago: handleAddPagoRow,
      onRemovePago: handleRemovePagoRow,
      onUpdatePago: handleUpdatePagoRow,
      onUpdatePagoCuentaDraft: handleUpdatePagoCuentaDraft,
      onRestoreFavorita: handleRestoreFavorita,
      noPagar,
      onNoPagarChange: setNoPagar,
      showAdvanced,
      onToggleAdvanced: handleToggleAdvanced,
    }),
    [
      pagosDraft,
      handleAddPagoRow,
      handleRemovePagoRow,
      handleUpdatePagoRow,
      handleUpdatePagoCuentaDraft,
      handleRestoreFavorita,
      noPagar,
      setNoPagar,
      showAdvanced,
      handleToggleAdvanced,
    ]
  );

  const registrarPagoProps = useMemo(
    () => ({
      pagos: pagosDraft,
      onAddPago: handleAddPagoRow,
      onRemovePago: handleRemovePagoRow,
      onUpdatePago: handleUpdatePagoRow,
      onUpdatePagoCuentaDraft: handleUpdatePagoCuentaDraft,
    }),
    [
      pagosDraft,
      handleAddPagoRow,
      handleRemovePagoRow,
      handleUpdatePagoRow,
      handleUpdatePagoCuentaDraft,
    ]
  );

  return {
    pagosDraft,
    setPagosDraft,
    showAdvanced,
    setShowAdvanced,
    isPagoModificado,
    setIsPagoModificado,
    totalPagado,
    saldoRestante,
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
    pagoSectionProps,
    registrarPagoProps,
  };
}

