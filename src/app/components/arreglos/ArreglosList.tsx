"use client";

import React from "react";
import Button from "@/app/components/ui/Button";
import { Arreglo } from "@/model/types";
import { Plus } from "lucide-react";
import ArregloItem from "./ArregloItem";

type Props = {
  arreglos: Arreglo[];
  onCreateArreglo?: () => void;
  onTogglePago?: (arreglo: Arreglo) => void;
  onEditArreglo?: (arreglo: Arreglo) => void;
  onItemClick?: (arreglo: Arreglo) => void;
};

export default function ArreglosList({
  arreglos,
  onCreateArreglo,
  onTogglePago,
  onEditArreglo,
  onItemClick,
}: Props) {
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 22 }}>Ultimos Arreglos</div>
        {onCreateArreglo ? (
          <Button
            icon={<Plus size={18} />}
            text="Crear arreglo"
            onClick={onCreateArreglo}
          />
        ) : null}
      </div>

      {arreglos.length === 0 ? (
        <div style={{ color: "rgba(0,0,0,0.7)" }}>
          Este vehículo no tiene arreglos registrados.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {arreglos.map((arreglo) => (
            <ArregloItem
              key={arreglo.id}
              arreglo={arreglo}
              onTogglePago={onTogglePago ?? (() => {})}
              onEdit={onEditArreglo ?? (() => {})}
              onClick={onItemClick}
            />
          ))}
        </div>
      )}
    </>
  );
}

