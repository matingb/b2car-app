"use client";
import Card from "@/app/components/Card";
import { Vehiculo } from "@/model/types";
import { useEffect, useState } from "react";

export default function VehiculosPage() {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);

  useEffect(() => {
    const fetchVehiculos = async () => {
      const res = await fetch("/api/vehiculos");
      const { data, error } = await res.json();
      if (error) {
        console.error(error);
      }
      setVehiculos(data ?? []);
    };
    fetchVehiculos();
  }, []);

  return (
    <div>
      <h1 style={styles.title}>Vehículos</h1>
      <p style={styles.subtitle}>Listado y gestión de vehículos.</p>
      <div style={styles.vehiclesList}>
        {vehiculos.map((vehiculo) => (
          <Card key={vehiculo.id}>
            <div>
              <div style={styles.vehicleInfo}>
                <h2>{vehiculo.patente}</h2>
                <span>-</span>
                <p>
                  {vehiculo.marca} {vehiculo.modelo}
                </p>
              </div>
              <div style={styles.vehicleSubInfo}>
                <p>Año {vehiculo.fecha_patente}</p>
                <p>{vehiculo.nombre_cliente}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

const styles = {
  title: {
    fontSize: "24px",
    lineHeight: "32px",
    fontWeight: 600,
  },
  subtitle: {
    marginTop: "0.5rem",
    color: "#6b7280",
  },
  vehiclesList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  vehicleInfo: {
    alignItems: "center",
    display: "flex",
    gap: 4,
  },
  vehicleSubInfo: {
    display: "flex",
    gap: 8,
    color: "#7F7F7F",
  },
} as const;
