"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useClienteById } from "@/app/providers/ClientesProvider";
import { COLOR } from "@/theme/theme";
import { Divider } from "@mui/material";
import { Mail, Phone } from "lucide-react";
import IconLabel from "@/app/components/IconLabel";
import ScreenHeader from "@/app/components/ScreenHeader";
import { Vehiculo } from "@/model/types";
import "@radix-ui/themes/styles.css";
import { Skeleton, Theme } from "@radix-ui/themes";
import Avatar from "@/app/components/Avatar";
import Card from "@/app/components/Card";
import ParticularDetails from "@/app/components/ParticularDetails";
import EmpresaDetails from "@/app/components/EmpresaDetails";
import { TipoCliente } from "@/model/types";

export default function ClientesDetailsPage() {
  const params = useParams<{ id: string }>();
  const { cliente, loading, vehiculos } = useClienteById(params.id);
  const [tipo, setTipo] = useState<string | null>(null);

  useEffect(() => {
    const tipoCliente = typeof window !== 'undefined' ? localStorage.getItem('tipo_cliente') : null;
    setTipo(tipoCliente?.toLowerCase() ?? null);
  }, []);

  if (loading) return loadingScreen();

  return (
    <div>
      <ScreenHeader title="Clientes" breadcrumbs={["Detalle"]} />
      {tipo === TipoCliente.EMPRESA || tipo === 'empresa' ? (
        <EmpresaDetails empresa={cliente} vehiculos={vehiculos || []} />
      ) : (
        <ParticularDetails cliente={cliente} vehiculos={vehiculos || []} />
      )}
    </div>
  );
}

function loadingScreen() {
  return (
    <div style={{ maxHeight: "100%", minHeight: "0vh" }}>
      <Theme style={{ height: "100%", minHeight: "0vh" }}>
        <ScreenHeader title="Clientes" breadcrumbs={["Detalle"]} />

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

const styles = {
  contentPanel: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    width: "50%",
  },
  fullPanel: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    marginTop: 16,
    gap: 4,
  },
  rowCell: {
    padding: "8px 12px",
  },
} as const;
