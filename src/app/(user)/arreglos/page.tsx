"use client";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { Arreglo } from "@/model/types";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SearchBar from "@/app/components/ui/SearchBar";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import ArreglosList from "@/app/components/arreglos/ArreglosList";
import ArregloModal from "@/app/components/arreglos/ArregloModal";
import { Plus } from "lucide-react";
import Button from "@/app/components/ui/Button";
import { useArreglos } from "@/app/providers/ArreglosProvider";

export default function ArreglosPage() {
  return <ArreglosPageContent />;
}

function ArreglosPageContent() {
  const router = useRouter();
  const { arreglos, loading, fetchAll } = useArreglos();
  const [localArreglos, setLocalArreglos] = useState<Arreglo[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [search, setSearch] = useState("");
  const arreglosFiltrados = useMemo(() => {
    if (!localArreglos) return [];
    const q = search.trim().toLowerCase();
    if (!q) return localArreglos;
    return localArreglos.filter((a: Arreglo) =>
      Object.values(a ?? {}).some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(q)
      )
    );
  }, [localArreglos, search]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    setLocalArreglos(arreglos || []);
  }, [arreglos]);

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
          style={{ minWidth: "180px" }}
          icon={<Plus size={18} />}
          text="Crear arreglo"
          onClick={() => setIsModalOpen(true)}
        />
      </div>
      {loading ? (
        <ListSkeleton rows={6} />
      ) : (
        <ArreglosList
          arreglos={arreglosFiltrados}
          onItemClick={(a: Arreglo) => router.push(`/arreglos/${a.id}`)}
          onUpdated={fetchAll}
        />
      )}

      <ArregloModal
        open={isModalOpen}
        onClose={(updated) => {
          setIsModalOpen(false);
          if (updated) {
            fetchAll();
          }
        }}
      />
    </div>
  );
}
