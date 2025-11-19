"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Card from "@/app/components/ui/Card";
import { Divider } from "@mui/material";
import { Plus, Car } from "lucide-react";
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
    <Card style={styles.contentPanel} >
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
      <div style={styles.grid}>
        {vehiculos && vehiculos.length > 0 ? (
          vehiculos.map((vehiculo: Vehiculo) => (
            <Card
              key={vehiculo.id ?? vehiculo.patente ?? Math.random()}
              style={styles.itemSquare}
              onClick={() => {
                router.push(ROUTES.vehiculos + "/" + vehiculo.id);
              }}
              enableHover={true}
              aria-label={`Ver vehículo ${vehiculo.patente ?? "-"}`}
            >
              <Car size={28} color={COLOR.ACCENT.PRIMARY} />
              <div style={{ fontWeight: 700, marginTop: 8 }}>{vehiculo.patente.substring(0, 2) + " " + vehiculo.patente.substring(2, 5) + " " + vehiculo.patente.substring(5, 7)}</div>
              <div style={{ color: "rgba(0,0,0,0.7)", fontSize: 13 }}>{vehiculo.marca ?? "-"} {vehiculo.modelo ?? "-"}</div>
            </Card>
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
    width: "100%",
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
  grid: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 8,
  },
  itemSquare: {
    width: 120,
    height: 120,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 8,
    background: "rgba(0,0,0,0.02)",
    cursor: "pointer",
    padding: 8,
    boxSizing: "border-box",
  },
} as const;

