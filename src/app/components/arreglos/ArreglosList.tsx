"use client";

import React from "react";
import { Arreglo } from "@/model/types";
import ArregloItem from "./ArregloItem";

type Props = {
  arreglos: Arreglo[];
  onItemClick?: (arreglo: Arreglo) => void;
  onUpdated?: () => Promise<void> | void;
};

export default function ArreglosList({
  arreglos,
  onItemClick,
  onUpdated,
}: Props) {
  return (
    <>
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
              onClick={onItemClick}
              onUpdated={onUpdated}
            />
          ))}
        </div>
      )}
    </>
  );
}
