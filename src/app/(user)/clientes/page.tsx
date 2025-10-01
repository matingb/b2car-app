
"use client";
import React from "react";
import { ClientesProvider } from "./clientesContext";
import { useClientes } from "./clientesContext";


export default function ClientesPage() {
  const { clientes, loading, refetch } = useClientes();
  console.log(clientes);
  return (
      <div>
        <h1 style={styles.title}>Clientes</h1>
        <p style={styles.subtitle}>Gestión de clientes.</p>
        {loading ? (
          <p>Cargando clientes...</p>
        ) : (
          <ul>
            {clientes.map((cliente) => (
              <li key={cliente.cliente_id}>
                {cliente.tipo_cliente} - {cliente.puntaje}
              </li>
            ))}
          </ul>
        )}
        <button onClick={refetch}>Refrescar</button>
      </div>
  );
}

const styles = {
  title: {
    fontSize: "24px",
    lineHeight: "32px",
    fontWeight: 600,
  },
  subtitle: {
    marginTop: "0.5rem",
    color: "#6b7280",
  },
} as const;


