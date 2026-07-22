"use client";

import { useCallback, useState } from "react";

export type UltimoTipoEmpleado = {
  tipoArregloId: string | null;
  empleadoId: string | null;
};

const VACIO: UltimoTipoEmpleado = { tipoArregloId: null, empleadoId: null };

export function useUltimoTipoEmpleado() {
  const [ultimo, setUltimo] = useState<UltimoTipoEmpleado>(VACIO);

  const registrar = useCallback((tipoArregloId: string | null, empleadoId: string | null) => {
    setUltimo({ tipoArregloId, empleadoId });
  }, []);

  const reset = useCallback(() => setUltimo(VACIO), []);

  return { ultimo, registrar, reset };
}
