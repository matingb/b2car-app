"use client";

import React, { useMemo } from "react";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { TipoCliente } from "@/model/types";
import "@radix-ui/themes/styles.css";
import ParticularDetails from "@/app/components/screens/ParticularDetails";
import EmpresaDetails from "@/app/components/screens/EmpresaDetails";
import { useClientes } from "@/app/providers/ClientesProvider";
import LoadingScreen from "@/app/components/ui/LoadingScreen";

export default function ClientesDetailsPage() {
  const { loading } = useClientes();
  const tipo = useMemo(
    () =>
      (localStorage.getItem("tipo_cliente")?.toLowerCase() as TipoCliente) ??
      null,
    []
  );

  return (
    <>
    <div style={{ opacity: loading ? 1 : 0 }}> 
      <LoadingScreen />
    </div>
    <div style={{ opacity: loading ? 0 : 1 }}>
      <ScreenHeader title="Clientes" breadcrumbs={["Detalle"]} hasBackButton />
      {tipo === TipoCliente.EMPRESA ? (
        <EmpresaDetails />
      ) : (
        <ParticularDetails />
      )}
    </div>
    </>
  );
}
