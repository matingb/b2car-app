"use client";

import React from "react";
import { Mail, Phone, TextSearch, Car, Trash2 } from "lucide-react";
import { redirect } from "next/navigation";
import { Cliente, TipoCliente } from "@/model/types";
import Avatar from "./Avatar";
import Card from "./Card";
import { ROUTES } from "@/routing/routes";
import { COLOR } from "@/theme/theme";

export default function ClienteList({
  clientes: clientes,
}: {
  clientes: Cliente[];
}) {
  const handleDelete = (event: React.MouseEvent<HTMLButtonElement>, id: number) => {
    event.stopPropagation();
    console.log("delete", id);
  };

  return (
    <div style={styles.list}>
      {clientes.map((cliente) => (
        <Card
          key={cliente.id}
          onClick={() => redirect(ROUTES.clientes + "/" + cliente.id)}
        >
          <div style={styles.container}>
            <div style={styles.leftGroup}>
              <Avatar nombre={cliente.nombre} />

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
                        cliente.email
                          ? styles.contactRowWithTop
                          : styles.contactRow
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
                <span style={styles.tipoClienteText}>
                  {cliente.tipo_cliente === TipoCliente.PARTICULAR
                    ? "Particular"
                    : "Empresa"}
                </span>
              </div>

              <button aria-label="detalle" style={styles.actionButton}>
                <TextSearch size={styles.iconSize} />
              </button>

              <button aria-label="auto" style={styles.actionButton}>
                <Car size={styles.iconSize} />
              </button>

              <button
                aria-label="borrar"
                style={{ ...styles.actionButton, color: COLOR.ICON.DANGER }}
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => handleDelete(event, cliente.id)}
              >
                <Trash2 size={styles.iconSize} />
              </button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

const styles = {
  iconSize: 20,
  list: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    gap: 12,
  },
  container: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leftGroup: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    cursor: "pointer",
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
    background: COLOR.ACCENT.PRIMARY,
    padding: "4px",
    alignItems: "center",
    borderRadius: 8,
  },
  tipoClienteText: {
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.TEXT.CONTRAST,
  },
} as const;
