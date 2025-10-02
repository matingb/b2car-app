"use client";

import React from "react";
import { redirect } from 'next/navigation'
import { ClientesProvider } from "../providers/CllientesProvider";
import { useClientes } from "../providers/CllientesProvider";
import PersonasList from "../components/PersonasList";
import { ACCENT_PRIMARY } from "@/theme/theme";
import { useEffect, useState, useMemo } from "react";
import { createClient } from '@/supabase/client'

export default function ClientesPage() {
  return (
      <ClientesProvider>
        <ClientesPanel />
      </ClientesProvider>
  );
}

function ClientesPanel() {
  const { clientes, loading, refetch } = useClientes();

  const [search, setSearch] = useState("");
  const clientesFiltrados = useMemo(() => {
    if (!clientes) return [];
    const q = search.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c: any) =>
      Object.values(c ?? {}).some((v) =>
        String(v ?? "").toLowerCase().includes(q)
      )
    );
  }, [clientes, search]);

  useEffect(() => {
    const selector = 'input[placeholder="Buscar clientes..."]';
    const input = document.querySelector(selector) as HTMLInputElement | null;
    if (!input) return;
    const onInput = (e: Event) => setSearch((e.target as HTMLInputElement).value);
    input.addEventListener("input", onInput);
    // keep the DOM input value in sync if search changes programmatically
    input.value = search;
    return () => input.removeEventListener("input", onInput);
  }, [search]);

  return (
      <div>
        <h1 style={styles.title}>Clientes</h1>
        <div style={styles.searchContainer}>
          <input
            type="text"
            placeholder="Buscar clientes..."
            style={styles.searchInput}
          />
        </div>
        {loading ? (
          <p>Cargando clientes...</p>
        ) : (
          <PersonasList personas={clientesFiltrados} />
        )}        
      </div>
  );
}

const styles = {
  title: {
    fontSize: "24px",
    lineHeight: "32px",
    fontWeight: 600,
    marginBottom: "1rem",
  },
  subtitle: {
    marginTop: "0.5rem",
    color: "#6b7280",
  },
  refreshButton: {
    marginBottom: "1rem",
    padding: "0.5rem 1rem",
    backgroundColor: ACCENT_PRIMARY,
    color: "white",
    border: "none",
    borderRadius: "0.375rem",
    cursor: "pointer",
  },
  searchContainer: {
    marginBottom: "1rem",
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "center",
  },
  searchInput: {
    width: "100%",
    maxWidth: "420px",
    padding: "0.5rem 0.75rem",
    border: "1px solid #d1d5db",
    borderRadius: "0.375rem",
    fontSize: "1rem",
    lineHeight: "1.5",
    outline: "none",
    transition: "box-shadow 150ms ease, border-color 150ms ease",
    boxSizing: "border-box",
  },
} as const;


