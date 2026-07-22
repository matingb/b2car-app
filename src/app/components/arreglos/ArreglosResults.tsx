"use client";

import type { Arreglo } from "@/model/types";
import ListSkeleton from "@/app/components/ui/ListSkeleton";
import ArregloItem from "@/app/components/arreglos/ArregloItem";

type Props = {
  loading: boolean;
  items: Arreglo[];
  onSelect: (arreglo: Arreglo) => void;
  showObservaciones?: boolean;
  mostrarObservaciones?: boolean;
};

export default function ArreglosResults({
  loading,
  items,
  onSelect,
  showObservaciones,
  mostrarObservaciones,
}: Props) {
  if (loading) return <ListSkeleton rows={6} />;

  const shouldShowObs = showObservaciones ?? mostrarObservaciones;

  return (
    <div style={styles.listContainer} data-testid="arreglos-results">
      {items.map((arreglo) => (
        <div key={arreglo.id} data-testid={`arreglo-item-${arreglo.id}`}>
          <ArregloItem
            arreglo={arreglo}
            onClick={onSelect}
            showObservaciones={shouldShowObs}
          />
        </div>
      ))}
    </div>
  );
}

const styles = {
  listContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
} as const;


