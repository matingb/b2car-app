"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Card from "@/app/components/ui/Card";
import IconLabel from "@/app/components/ui/IconLabel";
import ArregloModal from "@/app/components/arreglos/ArregloModal";
import { Arreglo } from "@/model/types";
import { COLOR } from "@/theme/theme";
import {
  Calendar,
  Wrench,
  Gauge,
  User,
  FileText,
  CheckCircle2,
  XCircle,
  Pencil,
} from "lucide-react";

type Props = {
  arreglo: Arreglo;
  onClick?: (arreglo: Arreglo) => void;
};

export default function ArregloItem({
  arreglo: initialArreglo,
  onClick,
}: Props) {
  const router = useRouter();
  const [openEditModal, setOpenEditModal] = useState(false);
  const [arreglo, setArreglo] = useState<Arreglo>(initialArreglo);

  useEffect(() => {
    setArreglo(initialArreglo);
  }, [initialArreglo]);

  const reloadArreglo = async () => {
    try {
      const res = await fetch(`/api/arreglos/${arreglo.id}`);
      if (res.ok) {
        const response = await res.json();
        if (response.data && response.vehiculo) {
          const updatedArreglo: Arreglo = {
            ...response.data,
            vehiculo: {
              id: response.vehiculo.id,
              nombre_cliente: arreglo.vehiculo.nombre_cliente,
              patente: response.vehiculo.patente,
              marca: response.vehiculo.marca,
              modelo: response.vehiculo.modelo,
              fecha_patente: response.vehiculo.fecha_patente,
            },
          };
          setArreglo(updatedArreglo);
        }
      }
    } catch (err) {
      console.error("Error recargando arreglo:", err);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <>
      <Card
        onClick={() => {
          if (onClick) return onClick(arreglo);
          router.push(`/arreglos/${arreglo.id}`);
        }}
        style={{ cursor: "pointer" }}
      >
      <div style={styles.container}>
        {/* Header superior con badges y precio */}
        <div style={styles.topHeader}>
          <div style={styles.leftBadges}>
            <div style={styles.titleSection}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={styles.mainTitle}>{arreglo.descripcion}</span>
                {arreglo.esta_pago ? (
                  <>
                    <CheckCircle2 size={18} color={COLOR.ACCENT.PRIMARY} />{" "}
                    Pagado
                  </>
                ) : (
                  <>
                    <XCircle size={18} color={COLOR.ICON.DANGER} /> Pendiente
                  </>
                )}
              </div>
              <p style={styles.subtitle}>
                {arreglo.vehiculo.patente} - {arreglo.vehiculo.marca}{" "}
                {arreglo.vehiculo.modelo}
              </p>
            </div>
          </div>

          <div style={styles.rightSection}>
            <div style={styles.priceSection}>
              <span style={styles.priceLabel}>Precio Final</span>
              <span style={styles.priceValue}>
                {formatPrice(arreglo.precio_final)}
              </span>
            </div>
            <button
              style={styles.editButton}
              onClick={(e) => {
                e.stopPropagation();
                setOpenEditModal(true);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = COLOR.ACCENT.PRIMARY;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = COLOR.TEXT.SECONDARY;
              }}
              title="Editar arreglo"
            >
              <Pencil size={18} />
            </button>
          </div>
        </div>

        {/* Divisor */}
        <div style={styles.divider} />

        {/* Grid de información */}
        <div style={styles.infoGrid}>
          <div style={styles.infoColumn}>
            <span style={styles.infoLabel}>Tipo</span>
            <IconLabel
              icon={<Wrench size={18} color={COLOR.ACCENT.PRIMARY} />}
              label={arreglo.tipo || "N/A"}
            />
          </div>

          <div style={styles.infoColumn}>
            <span style={styles.infoLabel}>Fecha</span>
            <IconLabel
              icon={<Calendar size={18} color={COLOR.ACCENT.PRIMARY} />}
              label={formatDate(arreglo.fecha)}
            />
          </div>

          <div style={styles.infoColumn}>
            <span style={styles.infoLabel}>Kilometraje</span>
            <IconLabel
              icon={<Gauge size={18} color={COLOR.ACCENT.PRIMARY} />}
              label={
                arreglo.kilometraje_leido
                  ? `${arreglo.kilometraje_leido.toLocaleString()} km`
                  : "N/A"
              }
            />
          </div>

          <div style={styles.infoColumn}>
            <span style={styles.infoLabel}>Cliente</span>
            <IconLabel
              icon={<User size={18} color={COLOR.ACCENT.PRIMARY} />}
              label={arreglo.vehiculo.nombre_cliente}
            />
          </div>
        </div>

        {/* Observaciones */}
        {arreglo.observaciones && (
          <>
            <div style={styles.divider} />
            <div style={styles.observaciones}>
              <IconLabel
                icon={<FileText size={18} color={COLOR.ACCENT.PRIMARY} />}
                label={`Observaciones: ${arreglo.observaciones}`}
              />
            </div>
          </>
        )}
      </div>
      </Card>
      
      <ArregloModal
        open={openEditModal}
        onClose={async (updated) => {
          setOpenEditModal(false);
          if (updated) {
            await reloadArreglo();
          }
        }}
        vehiculoId={arreglo.vehiculo.id}
        initial={{
          id: arreglo.id,
          tipo: arreglo.tipo,
          fecha: arreglo.fecha,
          kilometraje_leido: arreglo.kilometraje_leido,
          precio_final: arreglo.precio_final,
          observaciones: arreglo.observaciones,
          descripcion: arreglo.descripcion,
          esta_pago: arreglo.esta_pago,
          extra_data: arreglo.extra_data,
        }}
      />
    </>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  topHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  leftBadges: {
    display: "flex",
    gap: 12,
    alignItems: "center",
  },
  statusBadge: {
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
  },
  statusPaid: {
    backgroundColor: COLOR.ACCENT.PRIMARY,
    color: COLOR.TEXT.CONTRAST,
  },
  statusPending: {
    backgroundColor: COLOR.ACCENT.PRIMARY,
    color: COLOR.TEXT.CONTRAST,
  },
  rightSection: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  priceSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2,
  },
  priceLabel: {
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 400,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: 700,
    color: COLOR.ACCENT.PRIMARY,
  },
  divider: {
    height: 1,
    backgroundColor: COLOR.BORDER.SUBTLE,
    margin: "2px 0",
  },
  titleSection: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    margin: 0,
    lineHeight: 1.3,
  },
  subtitle: {
    fontSize: 14,
    color: COLOR.TEXT.SECONDARY,
    margin: 0,
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
  },
  infoColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  observaciones: {
    fontSize: 14,
    color: COLOR.TEXT.PRIMARY,
  },
  editButton: {
    background: "transparent",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: COLOR.TEXT.SECONDARY,
  },
} as const;
