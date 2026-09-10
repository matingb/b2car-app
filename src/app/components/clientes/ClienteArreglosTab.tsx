"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { css } from "@emotion/react";
import { Wrench, Plus } from "lucide-react";
import { ROUTES } from "@/routing/routes";
import { COLOR } from "@/theme/theme";
import ArregloItem from "@/app/components/arreglos/ArregloItem";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import type { Arreglo } from "@/model/types";
import { arreglosClient } from "@/clients/arreglosClient";

type Props = {
  clienteId: string;
  onNewArreglo?: () => void;
};

export default function ClienteArreglosTab({ clienteId, onNewArreglo }: Props) {
  const router = useRouter();
  const [arreglos, setArreglos] = useState<Arreglo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await arreglosClient.getAll({ clienteId, limit: 100 });
      if (res.error) throw new Error(res.error);
      setArreglos(res.data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error cargando arreglos");
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    if (clienteId) void load();
  }, [clienteId, load]);

  if (loading) return <ListSkeleton rows={4} />;
  if (error) return <div css={styles.errorBox}>{error}</div>;

  if (arreglos.length === 0) {
    return (
      <Card style={styles.emptyCard}>
        <Wrench size={36} color={COLOR.TEXT.TERTIARY} />
        <span style={styles.emptyTitle}>No hay trabajos registrados para este cliente</span>
        <span style={styles.emptySubtitle}>
          Cuando ingreses un vehículo del cliente a taller, sus órdenes aparecerán acá.
        </span>
        {onNewArreglo ? (
          <Button
            icon={<Plus size={16} />}
            text="Crear trabajo"
            onClick={onNewArreglo}
            style={{ marginTop: 12 }}
          />
        ) : null}
      </Card>
    );
  }

  return (
    <div css={styles.container}>
      <div css={styles.toolbar}>
        <span css={styles.totalText}>
          {arreglos.length} arreglo{arreglos.length === 1 ? "" : "s"} registrado{arreglos.length === 1 ? "" : "s"}
        </span>
        {onNewArreglo ? (
          <Button
            icon={<Plus size={16} />}
            text="Nuevo trabajo"
            onClick={onNewArreglo}
          />
        ) : null}
      </div>

      <div css={styles.list}>
        {arreglos.map((a) => (
          <ArregloItem
            key={a.id}
            arreglo={a}
            onClick={(arr) => router.push(`${ROUTES.arreglos}/${arr.id}`)}
            showObservaciones={true}
          />
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: css({
    display: "flex",
    flexDirection: "column",
    gap: 12,
  }),
  toolbar: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  }),
  totalText: css({
    fontSize: 14,
    color: "var(--color-text-secondary, #64748b)",
    fontWeight: 500,
  }),
  list: css({
    display: "flex",
    flexDirection: "column",
    gap: 12,
  }),
  emptyCard: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 24px",
    textAlign: "center" as const,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    maxWidth: 400,
  },
  errorBox: css({
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#fef2f2",
    color: "#dc2626",
    fontSize: 14,
  }),
};
