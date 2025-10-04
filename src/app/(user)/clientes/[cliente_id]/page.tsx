"use client";

import React from "react";
import { useParams } from "next/navigation";

export default function ClientesPage() {
  const params = useParams<{ cliente_id: string }>();

  return (
    <div>
        <h1 >Clientes</h1>
        <h1>Cliente ID: {params.cliente_id}</h1>
    </div>
  );
}

const styles = {
  
};