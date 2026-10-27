"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import { TipoCliente } from "@/model/types";
import ParticularDetails from "@/app/components/screens/ParticularDetails";
import EmpresaDetails from "@/app/components/screens/EmpresaDetails";
import { useClientes } from "@/app/providers/ClientesProvider";
import { VehiculosProvider } from "@/app/providers/VehiculosProvider";
import { ROUTES } from "@/routing/routes";
import { COLOR } from "@/theme/theme";

export default function ClientesDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { getClienteById } = useClientes();
  const [tipo, setTipo] = useState<TipoCliente | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingDetail(true);
    setTipo(null);

    getClienteById(params.id)
      .then((cliente) => {
        if (!cancelled) {
          setTipo(cliente?.tipo_cliente ?? null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingDetail(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [params.id, getClienteById]);

  if (loadingDetail) {
    return (
      <div>
        <ScreenHeader title="Clientes" breadcrumbs={["Detalle"]} hasBackButton />
        <div style={styles.loadingContainer}>Cargando...</div>
      </div>
    );
  }

  if (!tipo) {
    return (
      <div>
        <ScreenHeader title="Clientes" breadcrumbs={["Detalle"]} hasBackButton />
        <Card style={styles.errorCard}>
          <div style={styles.errorTitle}>Cliente no encontrado</div>
          <div style={styles.errorSub}>
            No se encontró el cliente solicitado o fue eliminado.
          </div>
          <div style={{ marginTop: 16 }}>
            <Button
              text="Volver a Clientes"
              onClick={() => router.push(ROUTES.clientes)}
            />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <VehiculosProvider>
      <div>
        <ScreenHeader title="Clientes" breadcrumbs={["Detalle"]} hasBackButton />
        {tipo === TipoCliente.EMPRESA ? (
          <EmpresaDetails />
        ) : (
          <ParticularDetails />
        )}
      </div>
    </VehiculosProvider>
  );
}

const styles = {
  loadingContainer: {
    padding: "32px 0",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 14,
  },
  errorCard: {
    padding: 32,
    textAlign: "center" as const,
    background: COLOR.BACKGROUND.SECONDARY,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    marginBottom: 8,
  },
  errorSub: {
    fontSize: 14,
    color: COLOR.TEXT.SECONDARY,
  },
};
