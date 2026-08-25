"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { TipoCliente } from "@/model/types";
import ParticularDetails from "@/app/components/screens/ParticularDetails";
import EmpresaDetails from "@/app/components/screens/EmpresaDetails";
import { useClientes } from "@/app/providers/ClientesProvider";
import { VehiculosProvider } from "@/app/providers/VehiculosProvider";
import { COLOR } from "@/theme/theme";

export default function ClientesDetailsPage() {
  const params = useParams<{ id: string }>();
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
        <div style={{ marginTop: 16, color: COLOR.TEXT.SECONDARY }}>Cargando...</div>
      </div>
    );
  }

  if (!tipo) {
    return (
      <div>
        <ScreenHeader title="Clientes" breadcrumbs={["Detalle"]} hasBackButton />
        <div style={{ marginTop: 16, color: COLOR.TEXT.SECONDARY }}>No se encontró el cliente solicitado.</div>
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
