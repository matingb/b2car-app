"use client";

import React from "react";
import { COLOR } from "@/theme/theme";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import CuentaCorrienteExtracto from "@/app/components/finanzas/CuentaCorrienteExtracto";
import type { ProveedorCuentaCorrienteResumen } from "@/model/dtos";

export type ProveedorCuentaCorrienteTabProps = {
  resumen?: ProveedorCuentaCorrienteResumen | null;
  loading?: boolean;
  error?: string | null;
  onReload?: () => void;
  onNuevaCompra?: () => void;
  onRegistrarPago?: () => void;
  onRegistrarCobro?: () => void;
};

export default function ProveedorCuentaCorrienteTab({
  resumen,
  loading = false,
  error = null,
  onReload,
}: ProveedorCuentaCorrienteTabProps) {
  const movimientos = resumen?.movimientos ?? [];

  if (loading && !resumen) {
    return <ListSkeleton rows={5} />;
  }

  if (error && !resumen) {
    return (
      <Card style={styles.errorCard}>
        <div style={{ color: COLOR.SEMANTIC.DANGER, fontWeight: 600 }}>{error}</div>
        {onReload && (
          <div style={{ marginTop: 12 }}>
            <Button text="Reintentar" onClick={onReload} outline />
          </div>
        )}
      </Card>
    );
  }

  return (
    <CuentaCorrienteExtracto
      movimientos={movimientos}
      emptySubtitle="Las órdenes de compra y los pagos o reintegros registrados aparecerán en este extracto contable."
    />
  );
}

const styles = {
  errorCard: {
    padding: 24,
    textAlign: "center" as const,
  },
};
