"use client";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import SearchBar from "@/app/components/ui/SearchBar";
import VehiculoCard from "@/app/components/vehiculos/VehiculoCard";
import { Vehiculo } from "@/model/types";
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
        style={{ width: "100%" , marginBottom: 16, marginTop: 8}}
      />
      {loading ? (
        <ListSkeleton />
      ) : (
        <div style={styles.vehiclesList}>
          {vehiculosFiltrados.map((vehiculo: Vehiculo) => (
            <VehiculoCard
              key={vehiculo.id}
              vehiculo={vehiculo}
              onClick={() => router.push(`/vehiculos/${vehiculo.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  vehiclesList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: 16,
  },
} as const;
