"use client";

import React from "react";
import GastoFormFields from "@/app/components/finanzas/GastoFormFields";
import { useOperacionForm } from "./OperacionFormContext";

export default function OperacionGastoForm() {
  const {
    categoriaGasto,
    setCategoriaGasto,
    montoGasto,
    setMontoGasto,
    descripcionGasto,
    setDescripcionGasto,
    observaciones,
    setObservaciones,
  } = useOperacionForm();

  return (
    <GastoFormFields
      categoriaGasto={categoriaGasto}
      setCategoriaGasto={setCategoriaGasto}
      montoGasto={montoGasto}
      setMontoGasto={setMontoGasto}
      descripcionGasto={descripcionGasto}
      setDescripcionGasto={setDescripcionGasto}
      observacionesGasto={observaciones}
      setObservacionesGasto={setObservaciones}
    />
  );
}
