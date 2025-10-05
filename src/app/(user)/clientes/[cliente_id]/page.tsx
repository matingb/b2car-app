"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useClienteById } from "@/app/providers/ClientesProvider";
import { ACCENT_PRIMARY, ACCENT_NEGATIVE } from "@/theme/theme";
import { Divider } from "@mui/material";
import { Mail, Phone, PencilLine, Trash } from "lucide-react";
import IconLabel from "@/app/components/IconLabel";
import ScreenHeader from "@/app/components/ScreenHeader";
import { Arreglo, Vehiculo } from "@/model/types";
import "@radix-ui/themes/styles.css";
import { Container, Flex, Skeleton, Theme, Text } from "@radix-ui/themes";


export default function ClientesPage() {
  const params = useParams<{ cliente_id: string }>();
  const { cliente, arreglos, loading, refetch, patenteVehiculo, vehiculos } = useClienteById(Number(params.cliente_id));

  if (loading) return loadingScreen();

  return (
    <div>
      <ScreenHeader
        title="Clientes"
        breadcrumbs={["Detalle"]}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8, }}>
        <div style={styles.avatar}>
          {((cliente?.nombre?.[0] ?? "") + (cliente?.apellido?.[0] ?? "")) || "?"}
        </div>
        <h1 style={{ margin: 0 }}>{`${cliente?.nombre} ${cliente?.apellido}`}</h1>
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <div style={styles.contentPanel}>
          <h2>Datos de contacto</h2>
          <Divider />

          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignContent: "center", padding: '4px 8px' }}>
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
          <div style={{ display: "flex", flexDirection: "column"}}>
            {vehiculos && vehiculos.length > 0 ? (
              vehiculos.map((v: Vehiculo) => (
                <span
                  key={v.vehiculo_id ?? v.patente ?? Math.random()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 8px",
                  }}
                >
                  <strong>{v.patente ?? "-"}</strong>-
                  <span >{v.marca ?? "-"} {v.modelo ?? "-"}</span>
                </span>
              ))
            ) : (
              <span>No hay vehículos asociados</span>
            )}
          </div>
        </div>
      </div>
      <div style={styles.fullPanel}>
        <h2>Ultimos arreglos</h2>
        <Divider />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={styles.rowCell}>Fecha</th>
                <th style={styles.rowCell}>Vehículo</th>
                <th style={styles.rowCell}>Observaciones</th>
                <th style={styles.rowCell}>Total</th>
                <th style={styles.rowCell}>Estado</th>
                <th style={styles.rowCell}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {arreglos && arreglos.length > 0 ? (
                arreglos.map((a: Arreglo) => (
                  <tr key={a.arreglo_id ?? Math.random()} style={{ borderBottom: "1px solid #eee", padding: "8px 12px" }}>
                    <td style={styles.rowCell}>
                      {a.fecha ? new Date(a.fecha).toLocaleDateString() : "-"}
                    </td>
                    <td style={styles.rowCell}>
                      {patenteVehiculo[a.vehiculo_id] ?? "-"}
                    </td>
                    <td style={styles.rowCell}>{a.observaciones ?? "-"}</td>
                    <td style={styles.rowCell}>
                      {typeof a.precio_final === "number"
                        ? `$${new Intl.NumberFormat("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(a.precio_final)}`
                        : a.precio_final ?? "-"}
                    </td>
                    <td style={styles.rowCell}>{a.esta_pago == true ? "Pagado" : "No Pagado"}</td>
                    <td style={{ ...styles.rowCell, gap: 8, display: "flex", alignItems: "center" }}>
                      <button
                        //onClick={}
                        style={{
                          cursor: "pointer",
                        }}>
                        <PencilLine size={18} style={{ color: ACCENT_PRIMARY }} />
                      </button>
                      <button
                        //onClick={}
                        style={{
                          cursor: "pointer",
                        }}>
                        <Trash size={18} style={{ color: ACCENT_NEGATIVE }} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ padding: 12, textAlign: "center" }}>
                    No hay arreglos registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

function loadingScreen() {
  return (

    <div style={{ maxHeight: "100%", minHeight: '0vh' }}>
      <Theme style={{ height: "100%", minHeight: '0vh' }}>

        <ScreenHeader
          title="Clientes"
          breadcrumbs={["Detalle"]}
        />

        <div style={{ flex: 1, marginTop: 16, gap: 16, display: "flex", flexDirection: "row", alignItems: "center" }}>
          <Skeleton width="64px" height="64px" />
          <Skeleton width="256px" height="16px" />
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
          <div style={{ flex: 1, marginTop: 16, gap: 16, display: "flex", flexDirection: "column", alignItems: "start", width: "50%" }}>
            <Skeleton width="80%" height="16px" />
            <Skeleton width="95%" height="16px" />
            <Skeleton width="95%" height="16px" />
          </div>
          <div style={{ flex: 1, marginTop: 16, gap: 16, display: "flex", flexDirection: "column", alignItems: "start", width: "50%" }}>
            <Skeleton width="80%" height="16px" />
            <Skeleton width="95%" height="16px" />
            <Skeleton width="90%" height="16px" />
          </div>
        </div>
        <div style={{ flex: 1, marginTop: 32, gap: 24, display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
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
  rowCell: {
    padding: "8px 12px",
  }
} as const;