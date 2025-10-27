"use client";
import Card from "@/app/components/ui/Card";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import SearchBar from "@/app/components/ui/SearchBar";
import { Vehiculo } from "@/model/types";
import { COLOR } from "@/theme/theme";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function VehiculosPage() {
  const router = useRouter();
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const vehiculosFiltrados = useMemo(() => {
    if (!vehiculos) return [];
    const q = search.trim().toLowerCase();
    if (!q) return vehiculos;
    return vehiculos.filter((v: Vehiculo) =>
      Object.values(v ?? {}).some((v) =>
        String(v ?? "").toLowerCase().includes(q)
      )
    );
  }, [vehiculos, search]);

  useEffect(() => {
    const fetchVehiculos = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/vehiculos");
        const { data, error } = await res.json();
        if (error) {
          console.error(error);
        }
        setVehiculos(data ?? []);
      } catch (e) {
        console.error("Error cargando vehículos", e);
        setVehiculos([]);
      } finally {
        setLoading(false);
      }
    };
    fetchVehiculos();
  }, []);

  return (
    
    <div>
      <ScreenHeader title="Vehículos" />
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Buscar vehículos..."
        style={{ width: "100%" , marginBottom: 16,}}
      />
      {loading ? (
        <ListSkeleton />
      ) : (
        <div style={styles.vehiclesList}>
          {vehiculosFiltrados.map((vehiculo: Vehiculo) => (
            <Card
              key={vehiculo.id}
              onClick={() => router.push(`/vehiculos/${vehiculo.id}`)}
              style={{ cursor: "pointer" }}
            >
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
      )}
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
    color: COLOR.TEXT.SECONDARY,
  },
  vehiclesList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: 16,
  },
  vehicleInfo: {
    alignItems: "center",
    display: "flex",
    gap: 4,
  },
  vehicleSubInfo: {
    display: "flex",
    gap: 8,
    color: COLOR.TEXT.SECONDARY,
  },
} as const;
