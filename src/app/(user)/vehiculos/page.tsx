"use client";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import SearchBar from "@/app/components/ui/SearchBar";
import VehiculoCard from "@/app/components/vehiculos/VehiculoCard";
import { Vehiculo } from "@/model/types";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/components/ui/Button";
import { PlusIcon } from "lucide-react";
import CreateVehiculoModal from "@/app/components/vehiculos/CreateVehiculoModal";
import { vehiculoClient } from "@/clients/vehiculoClient";
import { useVehiculos } from "@/app/providers/VehiculosProvider";


export default function VehiculosPage() {
  const router = useRouter();
  const {vehiculos, loading} = useVehiculos();
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  return (
    
    <div>
      <ScreenHeader title="Vehículos" />
      <div style={styles.searchBarContainer}>
        <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Buscar vehículos..."
        style={styles.searchBar}
      />
        <Button icon={<PlusIcon size={20}/>} text="Crear vehiculo" onClick={() => setIsModalOpen(true)} style={styles.newButton} />
      </div>
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
      <CreateVehiculoModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
        }}
      />
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
  searchBarContainer: {
    marginBottom: 16,
    display: "flex",
    justifyContent: "start",
    marginTop: 8,
    gap: 16,
  },
  searchBar: {
    width: "100%",
  },
  newButton: {
    height: '40px',
    width: '48px',
  }
} as const;
