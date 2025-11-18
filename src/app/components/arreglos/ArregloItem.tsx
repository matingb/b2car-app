"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Card from "@/app/components/ui/Card";
import IconLabel from "@/app/components/ui/IconLabel";
import { Arreglo } from "@/model/types";
import { COLOR } from "@/theme/theme";
import {
  Calendar,
  Wrench,
  Coins,
  FileText,
  CheckCircle2,
  XCircle,
  Pencil,
} from "lucide-react";

type Props = {
  arreglo: Arreglo;
  onTogglePago: (arreglo: Arreglo) => void;
  onEdit: (arreglo: Arreglo) => void;
  onClick?: (arreglo: Arreglo) => void;
};

export default function ArregloItem({ arreglo, onTogglePago, onEdit, onClick }: Props) {
  const router = useRouter();
  return (
    <div
      onClick={() => {
        if (onClick) return onClick(arreglo);
        router.push(`/arreglos/${arreglo.id}`);
      }}
      style={{ cursor: "pointer" }}
    >
      <Card>
        <div style={styles.arregloRow}>
        <div style={styles.arregloHeader}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {arreglo.esta_pago ? (
              <IconLabel
                icon={<CheckCircle2 size={18} color={COLOR.ACCENT.PRIMARY} />}
                label="Pagado"
              />
            ) : (
              <IconLabel
                icon={<XCircle size={18} color={COLOR.ICON.DANGER} />}
                label="Pendiente"
              />
            )}
          </div>
          {arreglo.tipo && arreglo.tipo.trim() !== "" && (
            <IconLabel
              icon={<Wrench size={18} color={COLOR.ACCENT.PRIMARY} />}
              label={arreglo.tipo}
            />
          )}
        </div>
        <div style={styles.arregloMeta}>
          <IconLabel
            icon={<Calendar size={18} color={COLOR.ACCENT.PRIMARY} />}
            label={
              arreglo.fecha
                ? new Date(arreglo.fecha).toLocaleString("es-ES", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })
                : ""
            }
          />
          <IconLabel
            icon={<Coins size={18} color={COLOR.ACCENT.PRIMARY} />}
            label={`$${arreglo.precio_final}`}
          />
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button
              aria-label="toggle pago"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePago(arreglo);
              }}
              style={styles.iconBtn}
            >
              {arreglo.esta_pago ? (
                <XCircle size={18} color={COLOR.ICON.DANGER} />
              ) : (
                <CheckCircle2 size={18} color={COLOR.ACCENT.PRIMARY} />
              )}
            </button>
            <button
              aria-label="editar"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(arreglo);
              }}
              style={styles.iconBtn}
            >
              <Pencil size={18} />
            </button>
          </div>
        </div>
        {arreglo.observaciones && (
          <div style={styles.infoLine}>
            <IconLabel
              icon={<FileText size={18} color={COLOR.ACCENT.PRIMARY} />}
              label={arreglo.observaciones}
            />
          </div>
        )}
        {arreglo.descripcion && (
          <div style={styles.infoLine}>
            <IconLabel
              icon={<FileText size={18} color={COLOR.ACCENT.PRIMARY} />}
              label={arreglo.descripcion}
            />
          </div>
        )}
      </div>
    </Card>
    </div>
  );
}

const styles = {
  arregloRow: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "0px 0",
  },
  arregloMeta: {
    display: "flex",
    gap: 16,
    color: "rgba(0,0,0,0.8)",
    fontSize: 16,
    flexWrap: "wrap",
  },
  arregloHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "start",
    fontSize: 16,
    marginBottom: 4,
    gap: 16,
  },
  infoLine: {
    fontSize: 16,
    color: "rgba(0,0,0,0.8)",
  },
  iconBtn: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: 4,
    borderRadius: 6,
  },
} as const;

