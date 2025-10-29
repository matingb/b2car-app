"use client";

import React from "react";
import Card from "@/app/components/ui/Card";
import IconLabel from "@/app/components/ui/IconLabel";
import { Arreglo } from "@/model/types";
import { Calendar, Wrench } from "lucide-react";
import { COLOR } from "@/theme/theme";

export default function ArregloList({
  arreglos,
  onItemClick,
}: {
  arreglos: Arreglo[];
  onItemClick?: (a: Arreglo) => void;
}) {
  return (
    <div style={styles.list}>
      {arreglos.map((a) => (
        <Card key={a.id} onClick={() => onItemClick?.(a)} style={{ cursor: onItemClick ? 'pointer' : 'default' }}>
          <div style={styles.row}>
            <div style={styles.left}>
              <div style={styles.topLine}>
                <IconLabel icon={<Calendar size={16} color={COLOR.ACCENT.PRIMARY} />} label={a.fecha ? new Date(a.fecha).toLocaleDateString('es-AR') : ''} />
                {a.tipo && a.tipo.trim() !== '' && (
                  <div style={styles.tipo}>
                    <Wrench size={14} />
                    <span style={{ marginLeft: 6 }}>{a.tipo}</span>
                  </div>
                )}
              </div>
              <div style={styles.patente}>{a.vehiculo?.patente ?? "-"}</div>
            </div>
            <div style={styles.right}>
              {/* reserved for actions or meta */}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

const styles = {
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 16,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  left: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  topLine: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    color: 'rgba(0,0,0,0.7)'
  },
  tipo: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '2px 8px',
    borderRadius: 8,
    background: 'rgba(0,0,0,0.03)',
    fontSize: 13,
  },
  patente: {
    fontSize: 16,
    fontWeight: 600,
  },
  right: {},
} as const;
