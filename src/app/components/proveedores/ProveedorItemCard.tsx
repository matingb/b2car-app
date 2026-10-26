"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Trash2,
} from "lucide-react";
import type { Proveedor } from "@/model/types";
import { ROUTES } from "@/routing/routes";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useProveedores } from "@/app/providers/ProveedoresProvider";
import { getInitials } from "@/lib/initials";
import { openWhatsapp } from "@/lib/whatsapp";
import { css } from "@emotion/react";
import Card from "@/app/components/ui/Card";
import IconButton from "@/app/components/ui/IconButton";
import Can from "@/app/components/auth/Can";
import { Permission } from "@/lib/permissions";

type Props = {
  proveedor: Proveedor;
  onEdit?: (proveedor: Proveedor) => void;
};

export default function ProveedorItemCard({ proveedor, onEdit }: Props) {
  const router = useRouter();
  const modal = useModalMessage();
  const toast = useToast();
  const { deleteProveedor } = useProveedores();

  const handleCardClick = () => {
    router.push(ROUTES.proveedorDetalle(proveedor.id));
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await modal.confirm({
      title: "Eliminar proveedor",
      message: `¿Estás seguro de que querés eliminar a "${proveedor.nombre}"?`,
      acceptLabel: "Eliminar",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;

    try {
      await deleteProveedor(proveedor.id);
      toast.success("Proveedor eliminado", `"${proveedor.nombre}" se eliminó correctamente.`);
    } catch (err: unknown) {
      toast.error(
        "No se pudo eliminar el proveedor",
        err instanceof Error ? err.message : "Error inesperado"
      );
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(proveedor);
  };

  const handleWhatsapp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!proveedor.telefono) return;
    openWhatsapp(proveedor.telefono, `Hola ${proveedor.nombre}, me comunico desde el taller.`);
  };

  const initials = getInitials(proveedor.nombre);

  return (
    <Card onClick={handleCardClick} data-testid={`proveedor-card-${proveedor.id}`}>
      <div css={styles.container}>
        <div style={styles.leftSection}>
          <div style={styles.avatar}>
            {initials ? initials : <Building2 size={20} color={COLOR.ACCENT.PRIMARY} />}
          </div>

          <div style={styles.infoCol}>
            <div style={styles.nameRow}>
              <span style={styles.name}>{proveedor.nombre}</span>
              {proveedor.cuit && (
                <span style={styles.cuitBadge} title="CUIT">
                  CUIT: {proveedor.cuit}
                </span>
              )}
            </div>

            <div css={styles.contactRow}>
              {proveedor.telefono && (
                <div style={styles.contactItem} title="Teléfono">
                  <Phone size={14} color={COLOR.ICON.MUTED} />
                  <span>{proveedor.telefono}</span>
                </div>
              )}
              {proveedor.email && (
                <div style={styles.contactItem} title="Email">
                  <Mail size={14} color={COLOR.ICON.MUTED} />
                  <span>{proveedor.email}</span>
                </div>
              )}
              {proveedor.direccion && (
                <div style={styles.contactItem} title="Dirección">
                  <MapPin size={14} color={COLOR.ICON.MUTED} />
                  <span style={styles.truncateText}>{proveedor.direccion}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={styles.actionsSection}>
          {proveedor.telefono && (
            <IconButton
              icon={<MessageCircle size={18} color="#25D366" />}
              title="WhatsApp"
              onClick={handleWhatsapp}
              data-testid={`proveedor-whatsapp-${proveedor.id}`}
            />
          )}

          <Can permission={Permission.ProveedoresEdit}>
            <IconButton
              icon={<Pencil size={18} />}
              title="Editar"
              onClick={handleEdit}
              data-testid={`proveedor-edit-${proveedor.id}`}
            />
            <IconButton
              icon={<Trash2 size={18} color={COLOR.SEMANTIC.DANGER} />}
              title="Eliminar"
              onClick={handleDelete}
              data-testid={`proveedor-delete-${proveedor.id}`}
            />
          </Can>
        </div>
      </div>
    </Card>
  );
}

const styles = {
  container: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    cursor: "pointer",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      flexDirection: "column",
      alignItems: "flex-start",
    },
  }),
  leftSection: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    minWidth: 0,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: COLOR.STATUS.INFO.BG_SUBTLE,
    color: COLOR.ACCENT.PRIMARY,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 16,
    flexShrink: 0,
  },
  infoCol: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    minWidth: 0,
  },
  nameRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap" as const,
  },
  name: {
    fontSize: 16,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
  },
  cuitBadge: {
    fontSize: 12,
    fontWeight: 500,
    padding: "2px 8px",
    borderRadius: 6,
    background: COLOR.BACKGROUND.SUBTLE,
    color: COLOR.TEXT.SECONDARY,
    border: `1px solid ${COLOR.BORDER.DEFAULT}`,
  },
  contactRow: css({
    display: "flex",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    marginTop: 2,
  }),
  contactItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
  },
  truncateText: {
    maxWidth: 260,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  actionsSection: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
};
