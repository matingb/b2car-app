"use client";
import Card from "@/app/components/ui/Card";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { Arreglo } from "@/model/types";
import { useEffect, useMemo, useState } from "react";
import SearchBar from "@/app/components/ui/SearchBar";
import ArregloList from "@/app/components/arreglos/ArregloList";
import ListSkeleton from "@/app/components/ui/ListSkeleton";

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

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArreglos = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/arreglos");
        const { data, error } = await res.json();
        if (error) {
          console.error(error);
        }
        setArreglos(data ?? []);
      } catch (err) {
        console.error('Error cargando arreglos', err);
        setArreglos([]);
      } finally {
        setLoading(false);
      }
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
        style={styles.searchBar}
      />
      {loading ? (
        <ListSkeleton rows={6} />
      ) : (
        <ArregloList arreglos={arreglosFiltrados} onItemClick={(a) => console.log('clicked', a.id)} />
      )}
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
    marginTop: 16,
  },
  searchBar: {
    marginBottom: "1rem",
  }
} as const;