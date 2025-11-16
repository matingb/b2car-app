"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Card from "@/app/components/ui/Card";
import { Divider } from "@mui/material";
import { Plus } from "lucide-react";
import { Vehiculo } from "@/model/types";
import { ROUTES } from "@/routing/routes";
import { COLOR } from "@/theme/theme";

type Props = {
  vehiculos: Vehiculo[];
  onAddVehiculo?: () => void;
};

export default function VehiculosAsociadosCard({ vehiculos, onAddVehiculo }: Props) {
  const router = useRouter();

  return (
    <Card style={styles.contentPanel}>
      <div style={styles.header}>
        <h2>Vehículos asociados</h2>
        {onAddVehiculo && (
          <button
            onClick={onAddVehiculo}
            style={styles.iconButton}
            title="Agregar vehículo"
          >
            <Plus size={18} color={COLOR.ACCENT.PRIMARY} />
          </button>
        )}
      </div>
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
                cursor: "pointer",
              }}
              onClick={() => {
                router.push(ROUTES.vehiculos + "/" + vehiculo.id);
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
  );
}

const styles = {
  contentPanel: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    width: "50%",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconButton: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    transition: "background 0.2s",
  },
} as const;

