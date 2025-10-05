"use client";

import React from "react";
import {
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  IconButton,
  Divider,
  Box,
} from "@mui/material";
import { Mail, Phone, TextSearch, Car, Trash2 } from "lucide-react";
import { Persona } from "@/model/types";
import { ACCENT_PRIMARY, ACCENT_NEGATIVE } from "@/theme/theme";
import { redirect } from "next/navigation";

export default function PersonasList({ personas }: { personas: Persona[] }) {
  return (
    <div style={styles.list}>
      {personas.map((p) => (
        <div key={p.persona_id}>
          <div style={styles.itemContainer}>
            <div 
              style={styles.leftGroup}
              onClick={() => redirect(`/clientes/${p.persona_id}`)}
            >
              <div style={styles.avatar}>
                {((p.nombre?.[0] ?? "") + (p.apellido?.[0] ?? "")) || "?"}
              </div>

              <div>
                <div style={styles.name}>
                  {`${p.nombre} ${p.apellido}`}
                </div>

                <div style={styles.contact}>
                  {p.email && (
                    <div style={styles.contactRow}>
                      <Mail size={14} />
                      <span>{p.email}</span>
                    </div>
                  )}

                  {p.telefono && (
                    <div style={p.email ? styles.contactRowWithTop : styles.contactRow} >
                      <Phone size={14} />
                      <span>{p.telefono}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button aria-label="detalle" style={styles.actionButton}>
                <TextSearch size={styles.iconSize} />
              </button>

              <button aria-label="auto" style={styles.actionButton}>
                <Car size={styles.iconSize} />
              </button>

              <button aria-label="borrar" style={{ ...styles.actionButton, color: ACCENT_NEGATIVE }}>
                <Trash2 size={styles.iconSize} />
              </button>
            </div>
          </div>

          {personas[personas.length - 1]?.persona_id !== p.persona_id && <Divider />}
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
    marginLeft: 6
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
} as const;
