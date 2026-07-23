"use client";

import { useCallback, useState } from "react";

export type UltimoTipoEmpleado = {
  categoriaArregloId: string | null;
  empleadoId: string | null;
};

const VACIO: UltimoTipoEmpleado = { categoriaArregloId: null, empleadoId: null };

export function useUltimoTipoEmpleado() {
  const [ultimo, setUltimo] = useState<UltimoTipoEmpleado>(VACIO);

  const registrar = useCallback((categoriaArregloId: string | null, empleadoId: string | null) => {
    setUltimo({ categoriaArregloId, empleadoId });
  }, []);

  const reset = useCallback(() => setUltimo(VACIO), []);

  return { ultimo, registrar, reset };
}
