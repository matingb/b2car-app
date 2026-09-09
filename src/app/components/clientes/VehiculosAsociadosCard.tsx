"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import { Plus, Car } from "lucide-react";
import { Vehiculo } from "@/model/types";
import { ROUTES } from "@/routing/routes";
import { COLOR } from "@/theme/theme";
import VehiculoCard from "@/app/components/vehiculos/VehiculoCard";

type Props = {
  vehiculos: Vehiculo[];
  onAddVehiculo?: () => void;
};

export default function VehiculosAsociadosCard({ vehiculos, onAddVehiculo }: Props) {
  const router = useRouter();
  const hasVehiculos = Array.isArray(vehiculos) && vehiculos.length > 0;

  return (
    <div style={styles.main}>
      <div style={styles.toolbar}>
        <span style={styles.totalText}>
          {vehiculos.length} vehículo{vehiculos.length === 1 ? "" : "s"} asociado{vehiculos.length === 1 ? "" : "s"}
        </span>
        {onAddVehiculo && (
          <Button
            icon={<Plus size={16} />}
            text="Agregar vehículo"
            onClick={onAddVehiculo}
          />
        )}
      </div>

      {hasVehiculos ? (
        <div style={styles.list}>
          {vehiculos.map((vehiculo: Vehiculo) => (
            <VehiculoCard
              key={vehiculo.id ?? vehiculo.patente}
              vehiculo={vehiculo}
              onClick={() => {
                router.push(`${ROUTES.vehiculos}/${vehiculo.id}`);
              }}
              showCliente={false}
            />
          ))}
        </div>
      ) : (
        <Card style={styles.emptyCard}>
          <Car size={36} color={COLOR.TEXT.TERTIARY} />
          <span style={styles.emptyTitle}>No hay vehículos asociados</span>
          <span style={styles.emptySubtitle}>
            Este cliente aún no tiene vehículos registrados en el sistema.
          </span>
          {onAddVehiculo && (
            <Button
              icon={<Plus size={16} />}
              text="Agregar vehículo"
              onClick={onAddVehiculo}
              style={{ marginTop: 12 }}
            />
          )}
        </Card>
      )}
    </div>
  );
}

const styles = {
  main: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  totalText: {
    fontSize: 14,
    color: "var(--color-text-secondary, #64748b)",
    fontWeight: 500,
  },
  list: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
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
} as const;

