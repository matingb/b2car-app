"use client";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { Arreglo } from "@/model/types";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SearchBar from "@/app/components/ui/SearchBar";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import { Plus } from "lucide-react";
import Button from "@/app/components/ui/Button";
import { useArreglos } from "@/app/providers/ArreglosProvider";
import ArregloItem from "@/app/components/arreglos/ArregloItem";
import ArregloModal from "@/app/components/arreglos/ArregloModal";

export default function ArreglosPage() {
  return <ArreglosPageContent />;
}

function ArreglosPageContent() {
  const router = useRouter();
  const { arreglos, loading } = useArreglos();
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  return (
    <div>
      <ScreenHeader title="Arreglos" />
      <div
        style={styles.searchBarContainer}
      >
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Buscar arreglos..."
        />
        <Button
          style={styles.newButton}
          icon={<Plus size={18} />}
          text="Crear arreglo"
          onClick={() => setIsModalOpen(true)}
        />
      </div>
      {loading ? (
        <ListSkeleton rows={6} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {arreglosFiltrados.map((arreglo) => (
            <ArregloItem
              key={arreglo.id}
              arreglo={arreglo}
              onClick={(a: Arreglo) => router.push(`/arreglos/${a.id}`)}
            />
          ))}
        </div>
      )}

      <ArregloModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}

const styles = {
  searchBarContainer: {
    marginBottom: 16,
    display: "flex",
    justifyContent: "start",
    marginTop: 8,
    gap: 16,
  },
  newButton: {
    height: '40px',
    width: '48px',
  }
} as const;