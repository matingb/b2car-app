"use client";

import React from "react";
import { Divider } from "@mui/material";
import { Mail, Phone, TextSearch, Car, Trash2 } from "lucide-react";
import { ACCENT_PRIMARY, ACCENT_NEGATIVE } from "@/theme/theme";
import { redirect } from "next/navigation";
import { Cliente } from "@/model/types";

export default function ClienteList({ clientes: clientes }: { clientes: Cliente[] }) {
  return (
    <div style={styles.list}>
      {clientes.map((cliente, index) => (
        <div key={cliente.id}>
          <div style={styles.itemContainer}>
            <div
              style={styles.leftGroup}
              onClick={() => redirect(`/clientes/${cliente.id}`)}
            >
              <div style={styles.avatar}>
                {(cliente.nombre?.[0] ?? "") || "?"}
              </div>

              <div>
                <div style={styles.name}>{`${cliente.nombre}`}</div>

                <div style={styles.contact}>
                  {cliente.email && (
                    <div style={styles.contactRow}>
                      <Mail size={14} />
                      <span>{cliente.email}</span>
                    </div>
                  )}

                  {cliente.telefono && (
                    <div
                      style={
                        cliente.email ? styles.contactRowWithTop : styles.contactRow
                      }
                    >
                      <Phone size={14} />
                      <span>{cliente.telefono}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>

              <div style={styles.tipoCliente}>
                <span style={styles.tipoClienteText}>{cliente.tipo_cliente === "persona" ? "Particular" : "Empresa"}</span>
              </div>

              <button aria-label="detalle" style={styles.actionButton}>
                <TextSearch size={styles.iconSize} />
              </button>

              <button aria-label="auto" style={styles.actionButton}>
                <Car size={styles.iconSize} />
              </button>

              <button
                aria-label="borrar"
                style={{ ...styles.actionButton, color: ACCENT_NEGATIVE }}
              >
                <Trash2 size={styles.iconSize} />
              </button>
            </div>
          </div>

          {index !== clientes.length - 1 && (
            <Divider />
          )}
        </div>
      ))}
    </div>
  );
}

const styles = {
  iconSize: 20,
  list: {
    width: "100%",
  },
  itemContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderRadius: 8,
    background: "white",
  },
  leftGroup: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    cursor: "pointer",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: ACCENT_PRIMARY,
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    fontSize: 16,
  },
  name: {
    fontWeight: 600,
  },
  contact: {
    display: "flex",
    flexDirection: "row",
    marginTop: 4,
    color: "rgba(0,0,0,0.7)",
    fontSize: 14,
  },
  contactRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  contactRowWithTop: {
    display: "flex",
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginLeft: 6,
  },
  actionButton: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: 6,
    borderRadius: 6,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  tipoCliente: {
    background: "#007995",
    padding: "4px",
    alignItems: "center",
    borderRadius: 8,
  },
  tipoClienteText: {
    fontSize: 12,
    fontWeight: 600,
    color: "white",
  },
} as const;
