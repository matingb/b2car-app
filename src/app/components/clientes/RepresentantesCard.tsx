"use client";

import React from "react";
import Card from "@/app/components/ui/Card";
import { Plus, User, X } from "lucide-react";
import { COLOR } from "@/theme/theme";
import { Representante } from "@/model/types";
import IconButton from "../ui/IconButton";

type Props = {
  representantes: Representante[];
  onAddRepresentante?: () => void;
  onDeleteRepresentante?: (representanteId: number) => void;
};

export default function RepresentantesCard({ representantes, onAddRepresentante, onDeleteRepresentante }: Props) {
  return (
    <div>
      <div style={styles.header}>
        <h3>Representantes</h3>
        <IconButton
            icon={<Plus/>}
            size={18}
            onClick={onAddRepresentante}
            title="Editar cliente"
            ariaLabel="Editar cliente"
          />
      </div>
    <Card style={styles.contentPanel}>
      <div style={styles.grid}>
        {representantes && representantes.length > 0 ? (
          representantes.map((r) => (
            <Card
              key={r.id}
              style={styles.itemSquare}
              aria-label={`Representante ${r.nombre} ${r.apellido}`}
            >
              {onDeleteRepresentante ? (
                <div style={styles.deleteButton}>
                  <IconButton
                    icon={<X />}
                    size={16}
                    onClick={() => onDeleteRepresentante(r.id)}
                    title="Eliminar representante"
                    ariaLabel="Eliminar representante"
                    hoverColor={COLOR.ICON.DANGER}
                  />
                </div>
              ) : null}
              <User size={28} color={COLOR.ACCENT.PRIMARY} />
              <div style={{ fontWeight: 700, marginTop: 0, textAlign: 'center' }}>
                {(r.nombre + ' ' + (r.apellido || '')).trim()}
              </div>
              <div style={{ color: 'rgba(0,0,0,0.7)', fontSize: 13 }}>
                {r.telefono || '-'}
              </div>
            </Card>
          ))
        ) : (
          <span>No hay representantes</span>
        )}
      </div>
    </Card>
    </div>
  );
}

const styles = {
  contentPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    width: '100%',
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 20,
    marginBottom: 8,
    fontWeight: 600,
  },
  iconButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    transition: 'background 0.2s',
  },
  grid: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  itemSquare: {
    width: 120,
    height: 120,
    position: "relative",
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    borderRadius: 8,
    background: 'rgba(0,0,0,0.02)',
    cursor: 'default',
    padding: 8,
    boxSizing: 'border-box',
    textAlign: 'center',
  },
  deleteButton: {
    position: "absolute",
    top: 0,
    right: 0,
  },
} as const;
