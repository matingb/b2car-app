"use client";

import React, { useEffect, useMemo, useState } from "react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { TipoCliente } from "@/model/types";
import "@radix-ui/themes/styles.css";
import ParticularDetails from "@/app/components/screens/ParticularDetails";
import EmpresaDetails from "@/app/components/screens/EmpresaDetails";
import { useClientes } from "@/app/providers/ClientesProvider";
import { VehiculosProvider } from "@/app/providers/VehiculosProvider";

export default function ClientesDetailsPage() {
  const { loading } = useClientes();
  const [tipo, setTipo] = useState<TipoCliente>(TipoCliente.PARTICULAR);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("tipo_cliente");
    if (raw) {
      const normalizado = raw.toUpperCase() as TipoCliente;
      if (Object.values(TipoCliente).includes(normalizado)) {
        setTipo(normalizado);
      }
    }
  }, []);

  return (
    <VehiculosProvider>
      <div style={{ opacity: loading ? 0 : 1 }}>
        <ScreenHeader title="Clientes" breadcrumbs={["Detalle"]} hasBackButton />
        {tipo === TipoCliente.EMPRESA ? (
          <EmpresaDetails />
        ) : (
          <ParticularDetails />
        )}
      </div>
    </VehiculosProvider>
  );
}
