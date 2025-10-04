"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useClienteById } from "@/app/providers/ClientesProvider";
import { ACCENT_PRIMARY } from "@/theme/theme";
import { Divider } from "@mui/material";
import { Mail, Phone } from "lucide-react";
import IconLabel from "@/app/components/IconLabel";
import ScreenHeader from "@/app/components/ScreenHeader";

export default function ClientesPage() {
  const params = useParams<{ cliente_id: string }>();
  const { cliente, loading, refetch } = useClienteById(Number(params.cliente_id));

  if (loading) return loadingScreen();

  return (
    <div>
      <ScreenHeader
        title="Clientes"
        breadcrumbs={["Detalle"]}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, }}>
        <div style={styles.avatar}>
          {((cliente?.nombre?.[0] ?? "") + (cliente?.apellido?.[0] ?? "")) || "?"}
        </div>
        <h1 style={{ margin: 0 }}>{`${cliente?.nombre} ${cliente?.apellido}`}</h1>
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <div style={styles.contentPanel}>
          <h2>Datos de contacto</h2>
          <Divider />

          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignContent: "center" }}>
            <IconLabel
              icon={<Mail size={18} style={{ color: ACCENT_PRIMARY }} />}
              label={cliente?.email ?? "-"}
            />
            <IconLabel
              icon={<Phone size={18} style={{ color: ACCENT_PRIMARY }} />}
              label={cliente?.telefono ?? "-"}
            />
          </div>

        </div>
        <div style={styles.contentPanel}>
          <h2>Vehiculos asociados</h2>
          <Divider />
        </div>
      </div>
      <div style={styles.fullPanel }>
        <h2>Ultimos arreglos</h2>
        <Divider />
      </div>

    </div>
  );
}

function loadingScreen() {
  return (
    <div>

      <ScreenHeader
        title="Clientes"
        breadcrumbs={["Detalle"]}
      />

      //TODO Agregar un skeleton

    </div>
  );
}

const styles = {
  contentPanel: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: "50%",
  },
  fullPanel: {
    width: "100%",
    marginTop: 16
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: "50%",
    background: ACCENT_PRIMARY,
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    fontSize: 24,
  },
} as const;