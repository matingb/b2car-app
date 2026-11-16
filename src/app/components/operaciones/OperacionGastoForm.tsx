"use client";

import GastoFormFields from "@/app/components/finanzas/GastoFormFields";
import PagoCondicionSection from "@/app/components/finanzas/PagoCondicionSection";
import { useOperacionForm } from "./OperacionFormContext";
import OperacionFacturaPercepciones from "./OperacionFacturaPercepciones";

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
    importeTotal,
    cuentaFavorita,
    pagosDraft,
    handleAddPagoRow,
    handleRemovePagoRow,
    handleRestoreFavorita,
    handleUpdatePagoRow,
    handleUpdatePagoCuentaDraft,
    noPagar,
    setNoPagar,
    showAdvanced,
    handleToggleAdvanced,
    isLoadingCuentas,
    isEditingGasto,
    factura,
    puedeCargarComprobante,
  } = useOperacionForm();

  const conFactura = puedeCargarComprobante && factura.activa;

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
      pagoSection={
        !isEditingGasto ? (
          <>
          {conFactura ? (
            <div style={{ marginBottom: 10 }}>
              <OperacionFacturaPercepciones />
            </div>
          ) : null}
          <PagoCondicionSection
            tipo="GASTO"
            totalOperacion={importeTotal}
            cuentaFavorita={cuentaFavorita}
            pagos={pagosDraft}
            onAddPago={handleAddPagoRow}
            onRemovePago={handleRemovePagoRow}
            onRestoreFavorita={handleRestoreFavorita}
            onUpdatePago={handleUpdatePagoRow}
            onUpdatePagoCuentaDraft={handleUpdatePagoCuentaDraft}
            noPagar={noPagar}
            onNoPagarChange={setNoPagar}
            showAdvanced={showAdvanced}
            onToggleAdvanced={handleToggleAdvanced}
            loadingCuentas={isLoadingCuentas}
          />
          </>
        ) : null
      }
    />
  );
}
