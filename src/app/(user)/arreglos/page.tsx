"use client";
import Card from "@/app/components/Card";
import ScreenHeader from "@/app/components/ScreenHeader";
import { Arreglo } from "@/model/types";
import { useEffect, useState } from "react";

export default function ArreglosPage() {
  const [arreglos, setArreglos] = useState<Arreglo[]>([]);

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
      <div style={styles.arreglosList}>
        {arreglos.map(arreglo => (
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
  arreglosList: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
} as const;