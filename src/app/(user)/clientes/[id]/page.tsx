"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useClienteById } from "@/app/providers/ClientesProvider";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { TipoCliente } from "@/model/types";
import "@radix-ui/themes/styles.css";
import { Skeleton, Theme } from "@radix-ui/themes";
import ParticularDetails from "@/app/components/screens/ParticularDetails";
import EmpresaDetails from "@/app/components/screens/EmpresaDetails";

export default function ClientesDetailsPage() {
  const params = useParams<{ id: string }>();
  const { cliente, loading, vehiculos } = useClienteById(params.id);
  const [tipo, setTipo] = useState<string | null>(null);

  useEffect(() => {
    const tipoCliente =
      typeof window !== "undefined"
        ? localStorage.getItem("tipo_cliente")
        : null;
    setTipo(tipoCliente?.toLowerCase() ?? null);
  }, []);

  if (loading) return loadingScreen();

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <ScreenHeader title="Clientes" breadcrumbs={["Detalle"]} hasBackButton/>
      </div>
      {tipo === TipoCliente.EMPRESA || tipo === "empresa" ? (
        <EmpresaDetails 
          empresa={cliente} 
          vehiculos={vehiculos || []} 
        />
      ) : (
        <ParticularDetails 
          cliente={cliente} 
          vehiculos={vehiculos || []} 
        />
      )}
    </div>
  );
}

function loadingScreen() {
  return (
    <div style={{ maxHeight: "100%", minHeight: "0vh" }}>
      <Theme style={{ height: "100%", minHeight: "0vh" }}>
        <div style={{ marginBottom: 8 }}>
          <ScreenHeader title="Clientes" breadcrumbs={["Detalle"]} hasBackButton/>
        </div>

        <div
          style={{
            flex: 1,
            marginTop: 16,
            gap: 16,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Skeleton width="64px" height="64px" />
          <Skeleton width="256px" height="16px" />
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
          <div
            style={{
              flex: 1,
              marginTop: 16,
              gap: 16,
              display: "flex",
              flexDirection: "column",
              alignItems: "start",
              width: "50%",
            }}
          >
            <Skeleton width="80%" height="16px" />
            <Skeleton width="95%" height="16px" />
            <Skeleton width="95%" height="16px" />
          </div>
          <div
            style={{
              flex: 1,
              marginTop: 16,
              gap: 16,
              display: "flex",
              flexDirection: "column",
              alignItems: "start",
              width: "50%",
            }}
          >
            <Skeleton width="80%" height="16px" />
            <Skeleton width="95%" height="16px" />
            <Skeleton width="90%" height="16px" />
          </div>
        </div>
        <div
          style={{
            flex: 1,
            marginTop: 32,
            gap: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
          }}
        >
          <Skeleton width="100%" height="16px" />
          <Skeleton width="90%" height="16px" />
          <Skeleton width="90%" height="16px" />
        </div>
      </Theme>
    </div>
  );
}
