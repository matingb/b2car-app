"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useClienteById } from "@/app/providers/ClientesProvider";

export default function ClientesPage() {
  const params = useParams<{ cliente_id: string }>();
  const { cliente, loading, refetch } = useClienteById(Number(params.cliente_id));



  if (loading) return <div>Loading...</div>;

  return (
    <div>
        <h1 >Clientes</h1>
        <pre>{JSON.stringify(cliente, null, 2)}</pre>
    </div>
  );
}

const styles = {
  
};