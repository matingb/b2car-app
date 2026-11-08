"use client";

import React, { useEffect, useState, useCallback } from "react";
import { css } from "@emotion/react";
import { COLOR } from "@/theme/theme";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import CuentaCorrienteExtracto from "@/app/components/finanzas/CuentaCorrienteExtracto";
import type { ClienteMovimientoCuenta } from "@/model/types";
import { clientesClient } from "@/clients/clientes/clientesClient";

type Props = {
  clienteId: string;
  clienteNombre?: string;
  saldoCuenta?: number;
  onMovimientoUpdated?: () => void;
};

export default function ClienteCuentaCorrienteTab({
  clienteId,
  saldoCuenta,
}: Props) {
  const [movimientos, setMovimientos] = useState<ClienteMovimientoCuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await clientesClient.getCuentaCorriente(clienteId);
      if (res.error) throw new Error(res.error);
      setMovimientos(res.data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error cargando cuenta corriente");
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    if (clienteId) void load();
  }, [clienteId, saldoCuenta, load]);

  if (loading && movimientos.length === 0) return <ListSkeleton rows={5} />;
  if (error && movimientos.length === 0) return <div css={styles.errorBox}>{error}</div>;

  return (
    <CuentaCorrienteExtracto
      movimientos={movimientos}
      emptySubtitle="Los cargos de trabajos, ventas y los cobros o pagos directos registrados aparecerán en este extracto contable."
    />
  );
}

const styles = {
  errorBox: css({
    padding: 16,
    borderRadius: 8,
    backgroundColor: COLOR.BACKGROUND.DANGER_TINT,
    color: COLOR.SEMANTIC.DANGER,
    fontSize: 14,
  }),
};
