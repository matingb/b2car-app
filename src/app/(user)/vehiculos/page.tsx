"use client"
import { Vehiculo } from "@/model/types";
import { useEffect, useState } from "react";

export default function VehiculosPage() {

  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])

  useEffect(() => {
    const fetchVehiculos = async () => {
      const res = await fetch('/api/vehiculos')
      const {data, error} = await res.json()
      if (error) {
        console.error(error)
      }
      setVehiculos(data ?? [])
    }
    fetchVehiculos()
  }, [])

  return (
    <div>
      <h1 style={styles.title}>Vehículos</h1>
      <p style={styles.subtitle}>Listado y gestión de vehículos.</p>
      {vehiculos.map((vehiculo) => (
        <div key={vehiculo.vehiculo_id}>
          <h2>{vehiculo.patente}</h2>
          <p>{vehiculo.marca}</p>
          <p>{vehiculo.modelo}</p>
        </div>
      ))}
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
} as const;


