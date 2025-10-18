"use client";
import Card from "@/app/components/Card";
import ScreenHeader from "@/app/components/ScreenHeader";
import { Arreglo } from "@/model/types";
import { useEffect, useMemo, useState } from "react";
import SearchBar from "@/app/components/SearchBar";

export default function ArreglosPage() {
  const [arreglos, setArreglos] = useState<Arreglo[]>([]);

  const [search, setSearch] = useState("");
  const arreglosFiltrados = useMemo(() => {
    if (!arreglos) return [];
    const q = search.trim().toLowerCase();
    if (!q) return arreglos;
    return arreglos.filter((a: Arreglo) =>
      Object.values(a ?? {}).some((v) =>
        String(v ?? "").toLowerCase().includes(q)
      )
    );
  }, [arreglos, search]);

  useEffect(() => {
    const fetchArreglos = async () => {
      const res = await fetch("/api/arreglos");
      const { data, error } = await res.json();
      if (error) {
        console.error(error);
      }
      setArreglos(data ?? []);
    };
    fetchArreglos();
  }, []);


  return (
    <div>
      <ScreenHeader title="Arreglos" />
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Buscar arreglos..."
        style={{ width: "100%" }}
      />
      <div style={styles.arreglosList}>
        {arreglosFiltrados.map(arreglo => (
          <Card key={arreglo.id}>
            <div>
              <h2>{arreglo.vehiculo.patente}</h2>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

const styles = {
  searchContainer: {
    marginBottom: "1rem",
  },
  searchInput: {
    width: "100%",
    padding: "0.5rem",
    borderRadius: "0.25rem",
    border: "1px solid #ccc",
  },
  arreglosList: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
} as const;