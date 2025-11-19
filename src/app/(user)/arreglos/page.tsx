"use client";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { Arreglo } from "@/model/types";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SearchBar from "@/app/components/ui/SearchBar";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import ArreglosList from "@/app/components/arreglos/ArreglosList";
import { Plus } from "lucide-react";
import Button from "@/app/components/ui/Button";

export default function ArreglosPage() {
  const router = useRouter();
  const [arreglos, setArreglos] = useState<Arreglo[]>([]);

  const [search, setSearch] = useState("");
  const arreglosFiltrados = useMemo(() => {
    if (!arreglos) return [];
    const q = search.trim().toLowerCase();
    if (!q) return arreglos;
    return arreglos.filter((a: Arreglo) =>
      Object.values(a ?? {}).some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(q)
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
        console.error("Error cargando arreglos", err);
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "16px 0",
        }}
      >
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Buscar arreglos..."
        />
        <Button
          style={{ width: "180px" }}
          icon={<Plus size={18} />}
          text="Crear arreglo"
          onClick={() => router.push("/arreglos/new")}
        />
      </div>
      {loading ? (
        <ListSkeleton rows={6} />
      ) : (
        <ArreglosList
          arreglos={arreglosFiltrados}
          onItemClick={(a: Arreglo) => router.push(`/arreglos/${a.id}`)}
        />
      )}
    </div>
  );
}
