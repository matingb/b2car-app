"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import ProveedorModal from "@/app/components/proveedores/ProveedorModal";
import Can from "@/app/components/auth/Can";
import { Permission } from "@/lib/permissions";
import { ROUTES } from "@/routing/routes";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { useProveedores } from "@/app/providers/ProveedoresProvider";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { proveedoresClient } from "@/clients/proveedores/proveedoresClient";
import { openWhatsapp } from "@/lib/whatsapp";
import { formatDateLabel } from "@/lib/fechas";
import type { Proveedor } from "@/model/types";
import {
  Building2,
  Calendar,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { css } from "@emotion/react";

export default function ProveedorDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const modal = useModalMessage();
  const toast = useToast();
  const { updateProveedor, deleteProveedor } = useProveedores();

  const [proveedor, setProveedor] = useState<Proveedor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    proveedoresClient
      .getById(params.id)
      .then((res) => {
        if (cancelled) return;
        if (res.error || !res.data) {
          setError(res.error || "Proveedor no encontrado");
        } else {
          setProveedor(res.data);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const handleDelete = async () => {
    if (!proveedor) return;
    const ok = await modal.confirm({
      title: "Eliminar proveedor",
      message: `¿Estás seguro de que querés eliminar a "${proveedor.nombre}"? Esta acción no se puede deshacer.`,
      acceptLabel: "Eliminar",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;

    try {
      await deleteProveedor(proveedor.id);
      toast.success("Proveedor eliminado", "El proveedor se eliminó correctamente.");
      router.push(ROUTES.proveedores);
    } catch (err: unknown) {
      toast.error(
        "No se pudo eliminar el proveedor",
        err instanceof Error ? err.message : "Error inesperado"
      );
    }
  };

  const handleEditSubmit = async (values: {
    nombre: string;
    cuit?: string | null;
    telefono?: string | null;
    email?: string | null;
    direccion?: string | null;
  }) => {
    if (!proveedor) return;
    const updated = await updateProveedor(proveedor.id, values);
    setProveedor(updated);
    toast.success("Proveedor actualizado", "Los datos se guardaron correctamente.");
  };

  if (loading) {
    return (
      <div>
        <ScreenHeader title="Proveedor" breadcrumbs={["Detalle"]} hasBackButton />
        <div style={styles.loadingContainer}>Cargando datos del proveedor...</div>
      </div>
    );
  }

  if (error || !proveedor) {
    return (
      <div>
        <ScreenHeader title="Proveedor" breadcrumbs={["Detalle"]} hasBackButton />
        <Card style={styles.errorCard}>
          <div style={styles.errorTitle}>Proveedor no encontrado</div>
          <div style={styles.errorSub}>
            {error || "El proveedor solicitado no existe o fue eliminado."}
          </div>
          <div style={{ marginTop: 16 }}>
            <Button
              text="Volver a Proveedores"
              onClick={() => router.push(ROUTES.proveedores)}
            />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader
        title={proveedor.nombre}
        breadcrumbs={["Proveedores", "Detalle"]}
        hasBackButton
      />

      <div css={styles.topActionsRow}>
        <div style={styles.badgeRow}>
          {proveedor.cuit ? (
            <span style={styles.cuitBadge}>CUIT: {proveedor.cuit}</span>
          ) : (
            <span style={styles.noCuitBadge}>Sin CUIT registrado</span>
          )}
        </div>

        <div style={styles.actionButtons}>
          {proveedor.telefono && (
            <Button
              icon={<MessageCircle size={18} color="#25D366" />}
              text="WhatsApp"
              onClick={() =>
                openWhatsapp(
                  proveedor.telefono!,
                  `Hola ${proveedor.nombre}, me comunico desde el taller.`
                )
              }
              outline
              dataTestId="proveedor-detail-whatsapp"
            />
          )}

          <Can permission={Permission.ProveedoresEdit}>
            <Button
              icon={<Pencil size={18} />}
              text="Editar"
              onClick={() => setEditModalOpen(true)}
              outline
              dataTestId="proveedor-detail-edit"
            />
            <Button
              icon={<Trash2 size={18} color={COLOR.SEMANTIC.DANGER} />}
              text="Eliminar"
              onClick={handleDelete}
              outline
              style={{ color: COLOR.SEMANTIC.DANGER, borderColor: COLOR.SEMANTIC.DANGER }}
              dataTestId="proveedor-detail-delete"
            />
          </Can>
        </div>
      </div>

      <div css={styles.grid}>
        {/* Ficha de datos fiscales y de contacto */}
        <Card style={styles.detailCard}>
          <div style={styles.cardHeader}>
            <Building2 size={20} color={COLOR.ACCENT.PRIMARY} />
            <h3 style={styles.cardTitle}>Datos del Proveedor</h3>
          </div>

          <div style={styles.dataGrid}>
            <div style={styles.dataItem}>
              <span style={styles.dataLabel}>Razón Social / Nombre</span>
              <strong style={styles.dataValue}>{proveedor.nombre}</strong>
            </div>

            <div style={styles.dataItem}>
              <span style={styles.dataLabel}>CUIT</span>
              <span style={styles.dataValue}>{proveedor.cuit || "—"}</span>
            </div>

            <div style={styles.dataItem}>
              <span style={styles.dataLabel}>Teléfono</span>
              {proveedor.telefono ? (
                <a
                  href={`tel:${proveedor.telefono}`}
                  style={{ ...styles.dataValue, color: COLOR.ACCENT.PRIMARY, textDecoration: "none" }}
                >
                  <Phone size={14} style={{ display: "inline", marginRight: 6 }} />
                  {proveedor.telefono}
                </a>
              ) : (
                <span style={styles.dataValue}>—</span>
              )}
            </div>

            <div style={styles.dataItem}>
              <span style={styles.dataLabel}>Correo Electrónico</span>
              {proveedor.email ? (
                <a
                  href={`mailto:${proveedor.email}`}
                  style={{ ...styles.dataValue, color: COLOR.ACCENT.PRIMARY, textDecoration: "none" }}
                >
                  <Mail size={14} style={{ display: "inline", marginRight: 6 }} />
                  {proveedor.email}
                </a>
              ) : (
                <span style={styles.dataValue}>—</span>
              )}
            </div>

            <div style={{ ...styles.dataItem, gridColumn: "1 / -1" }}>
              <span style={styles.dataLabel}>Dirección</span>
              <span style={styles.dataValue}>
                {proveedor.direccion ? (
                  <>
                    <MapPin size={14} style={{ display: "inline", marginRight: 6 }} />
                    {proveedor.direccion}
                  </>
                ) : (
                  "—"
                )}
              </span>
            </div>

            {proveedor.created_at && (
              <div style={{ ...styles.dataItem, gridColumn: "1 / -1" }}>
                <span style={styles.dataLabel}>Fecha de registro</span>
                <span style={styles.dataValueMuted}>
                  <Calendar size={14} style={{ display: "inline", marginRight: 6 }} />
                  {formatDateLabel(proveedor.created_at)}
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* Card informativo de Próxima Etapa: Historial y Cuenta Corriente */}
        <Card style={styles.infoCard}>
          <div style={styles.cardHeader}>
            <TrendingUp size={20} color={COLOR.ACCENT.PRIMARY} />
            <h3 style={styles.cardTitle}>Cuenta Corriente & Operaciones</h3>
          </div>

          <div style={styles.infoCardBody}>
            <div style={styles.infoCallout}>
              <p style={styles.infoText}>
                <strong>Próximamente disponible:</strong> En las siguientes etapas podrás vincular
                operaciones de compra a este proveedor, visualizar su saldo deudor en cuenta corriente
                y liquidar pagos directamente desde las cuentas financieras.
              </p>
            </div>

            <div style={styles.statPreviewRow}>
              <div style={styles.statPreview}>
                <span style={styles.statLabel}>Saldo Adeudado</span>
                <strong style={styles.statNumber}>$ 0,00</strong>
              </div>
              <div style={styles.statPreview}>
                <span style={styles.statLabel}>Total Comprado</span>
                <strong style={styles.statNumber}>$ 0,00</strong>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <ProveedorModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSubmit={handleEditSubmit}
        initialValues={proveedor}
      />
    </div>
  );
}

const styles = {
  loadingContainer: {
    padding: "32px 0",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 14,
  },
  errorCard: {
    padding: 32,
    textAlign: "center" as const,
    background: COLOR.BACKGROUND.SECONDARY,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    marginBottom: 8,
  },
  errorSub: {
    fontSize: 14,
    color: COLOR.TEXT.SECONDARY,
  },
  topActionsRow: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 12,
  }),
  badgeRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  cuitBadge: {
    fontSize: 13,
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: 8,
    background: "rgba(59, 130, 246, 0.12)",
    color: COLOR.ACCENT.PRIMARY,
    border: `1px solid rgba(59, 130, 246, 0.25)`,
  },
  noCuitBadge: {
    fontSize: 13,
    fontWeight: 500,
    padding: "4px 10px",
    borderRadius: 8,
    background: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.SECONDARY,
  },
  actionButtons: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap" as const,
  },
  grid: css({
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr",
    gap: 20,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      gridTemplateColumns: "1fr",
    },
  }),
  detailCard: {
    padding: 24,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
    paddingBottom: 14,
    borderBottom: `1px solid ${COLOR.BORDER.DEFAULT}`,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    margin: 0,
  },
  dataGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px 20px",
  },
  dataItem: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  dataLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: COLOR.TEXT.SECONDARY,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  dataValue: {
    fontSize: 14,
    fontWeight: 500,
    color: COLOR.TEXT.PRIMARY,
  },
  dataValueMuted: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
  },
  infoCard: {
    padding: 24,
    background: COLOR.BACKGROUND.SECONDARY,
  },
  infoCardBody: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },
  infoCallout: {
    padding: "12px 14px",
    borderRadius: 8,
    background: COLOR.BACKGROUND.PRIMARY,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
  },
  infoText: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    lineHeight: 1.5,
    margin: 0,
  },
  statPreviewRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  statPreview: {
    padding: 16,
    borderRadius: 10,
    background: COLOR.BACKGROUND.PRIMARY,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLOR.TEXT.SECONDARY,
    fontWeight: 500,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 700,
    color: COLOR.TEXT.PRIMARY,
  },
};
