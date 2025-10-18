"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useClienteById } from "@/app/providers/ClientesProvider";
import { ACCENT_PRIMARY } from "@/theme/theme";
import { Divider } from "@mui/material";
import { Mail, Phone } from "lucide-react";
import IconLabel from "@/app/components/IconLabel";
import ScreenHeader from "@/app/components/ScreenHeader";
import { Vehiculo } from "@/model/types";
import "@radix-ui/themes/styles.css";
import { Skeleton, Theme } from "@radix-ui/themes";
import Avatar from "@/app/components/Avatar";
import Card from "@/app/components/Card";

export default function ClientesDetailsPage() {
  const params = useParams<{ id: string }>();
  const { cliente, loading, vehiculos } = useClienteById(params.id);

  if (loading) return loadingScreen();

  return (
    <div>
      <ScreenHeader title="Clientes" breadcrumbs={["Detalle"]} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 8,
        }}
      >
        <Avatar nombre={cliente?.nombre ?? ""} size={60} />
        <h1 style={{ margin: 0 }}>{`${cliente?.nombre}`}</h1>
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <Card style={styles.contentPanel}>
          <h2>Datos de contacto</h2>
          <Divider />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              alignContent: "center",
              padding: "4px 8px",
            }}
          >
            <IconLabel
              icon={<Mail size={18} style={{ color: ACCENT_PRIMARY }} />}
              label={cliente?.email ?? "-"}
            />
            <IconLabel
              icon={<Phone size={18} style={{ color: ACCENT_PRIMARY }} />}
              label={cliente?.telefono ?? "-"}
            />
          </div>
        </Card>
        <Card style={styles.contentPanel}>
          <h2>Vehiculos asociados</h2>
          <Divider />
          <div style={{ display: "flex", flexDirection: "column" }}>
            {vehiculos && vehiculos.length > 0 ? (
              vehiculos.map((vehiculo: Vehiculo) => (
                <span
                  key={vehiculo.id ?? vehiculo.patente ?? Math.random()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 8px",
                  }}
                >
                  <strong>{vehiculo.patente ?? "-"}</strong>-
                  <span>
                    {vehiculo.marca ?? "-"} {vehiculo.modelo ?? "-"}
                  </span>
                </span>
              ))
            ) : (
              <span>No hay vehículos asociados</span>
            )}
          </div>
        </Card>
      </div>
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
