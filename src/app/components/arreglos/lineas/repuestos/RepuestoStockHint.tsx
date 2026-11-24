"use client";

import React from "react";
import ConflictWarning from "@/app/components/arreglos/lineas/shared/ConflictWarning";
import StockPurchaseHint from "@/app/components/arreglos/lineas/repuestos/StockPurchaseHint";
import type { RepuestoStockState } from "./repuestoValidator";

type RepuestoStockHintProps = {
  submitting?: boolean;
  stockState: RepuestoStockState;
  newProductConflict?: string | null;
  newProductQty: number;
  precioCompra: number;
  deferred?: boolean;
};

export function resolveStockHint({
  submitting,
  stockState,
  newProductConflict,
  newProductQty,
  precioCompra,
  deferred = false,
}: RepuestoStockHintProps): React.ReactNode | undefined {
  if (submitting) return undefined;

  if (stockState.hasExistingRepuestoConflict) {
    return <ConflictWarning message="El repuesto ya se encuentra en el arreglo" />;
  }

  if (stockState.hasStockIssue) {
    return (
      <StockPurchaseHint
        stockActual={stockState.stockActual}
        faltante={stockState.faltante}
        precioCompra={precioCompra}
        deferred={deferred}
      />
    );
  }

  if (stockState.isNewProduct && !newProductConflict && newProductQty > 0) {
    return (
      <StockPurchaseHint
        stockActual={0}
        faltante={newProductQty}
        precioCompra={precioCompra}
        deferred={deferred}
      />
    );
  }

  return undefined;
}
