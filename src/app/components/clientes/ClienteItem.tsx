"use client";

import React from "react";
import {
  Mail,
  Phone,
  Trash2,
  FileText,
  Eye,
  MapPin,
  Building2,
  User as UserIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Cliente, TipoCliente } from "@/model/types";
import Avatar from "@/app/components/ui/Avatar";
import Card from "@/app/components/ui/Card";
import { ROUTES } from "@/routing/routes";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useClientes } from "@/app/providers/ClientesProvider";
import IconButton from "../ui/IconButton";
import { css } from "@emotion/react";

export default function ClienteItem({ cliente }: { cliente: Cliente }) {
  const modal = useModalMessage();
  const router = useRouter();
  const toast = useToast();
  const { deleteCliente } = useClientes();

  const handleDelete = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const nombre = cliente.nombre || "este cliente";
    const ok = await modal.confirm({
      title: "Eliminar cliente",
      message: `¿Confirmás eliminar ${nombre}? Esta acción no se puede deshacer.`,
      acceptLabel: "Eliminar",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;

    try {
      await deleteCliente(cliente.id, cliente.tipo_cliente);
      toast.success(
        "Cliente eliminado",
        typeof nombre === "string" ? nombre : undefined
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error de red";
      toast.error("No se pudo eliminar el cliente", message);
    }
  };

  const handleOnClick = () => {
    const tipo =
      cliente.tipo_cliente === TipoCliente.PARTICULAR
        ? "PARTICULAR"
        : "EMPRESA";
    localStorage.setItem("tipo_cliente", tipo);
    router.push(ROUTES.clientes + "/" + cliente.id);
  };

  return (
    <Card style={{padding: '10px 12px'}} onClick={handleOnClick}>
      <div css={styles.container}>
        <div css={styles.leftGroup}>
          <Avatar nombre={cliente.nombre} />

          <div css={styles.details}>
            <div css={styles.name}>{`${cliente.nombre}`}</div>

            <div css={styles.infoBlock}>
              <div style={styles.direccionRow}>
                <MapPin size={16} color={COLOR.ICON.MUTED} />
                <span style={styles.direccionText}>
                  {cliente.direccion !== "" ? cliente.direccion : "-"}
                </span>
              </div>
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

                {cliente.tipo_cliente === TipoCliente.EMPRESA && cliente.cuit && (
                  <div
                    style={
                      cliente.email || cliente.telefono
                        ? styles.contactRowWithTop
                        : styles.contactRow
                    }
                  >
                    <FileText size={14} />
                    <span>CUIT: {cliente.cuit}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div css={styles.actions}>
          <div css={styles.tipoCliente}>
            <span css={styles.tipoClienteIcon}>
              {cliente.tipo_cliente === TipoCliente.PARTICULAR ? (
                <UserIcon size={16} color={COLOR.TEXT.CONTRAST} />
              ) : (
                <Building2 size={16} color={COLOR.TEXT.CONTRAST} />
              )}
            </span>
            <span css={styles.tipoClienteText}>
              {cliente.tipo_cliente === TipoCliente.PARTICULAR
                ? "Particular"
                : "Empresa"}
            </span>
          </div>

          <div css={styles.actionButtons}>
            <IconButton icon={<Trash2 />} onClick={handleDelete} size={20} hoverColor={COLOR.ICON.DANGER} />
          </div>
        </div>
      </div>
    </Card>
  );
}

const styles = {
  iconSize: 20,
  container: css({
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      alignItems: "center",
      gap: 8,
      padding: "0px 0px",
    },
  }),
  leftGroup: css({
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    cursor: "pointer",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      gap: 10,
    },
  }),
  details: css({
    display: "flex",
    flexDirection: "column",
  }),
  name: css({
    fontSize: 18,
    fontWeight: 600,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      fontSize: 16,
    },
  }),
  infoBlock: css({
    display: "flex",
    flexDirection: "column",
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "none",
    },
  }),
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
  direccionRow: {
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
  actions: css({
    display: "flex",
    gap: 8,
    alignItems: "center",
  }),
  actionButtons: css({
    display: "inline-flex",
    gap: 8,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "none",
    },
  }),
  tipoCliente: css({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: COLOR.ACCENT.PRIMARY,
    padding: "6px 12px",
    borderRadius: 8,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      gap: 4,
      padding: "8px 8px",
    },
  }),
  tipoClienteIcon: css({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  }),
  tipoClienteText: css({
    fontSize: 14,
    fontWeight: 600,
    color: COLOR.TEXT.CONTRAST,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "none",
    },
  }),
  direccionText: {
    fontSize: 14,
    color: COLOR.ICON.MUTED,
  },
} as const;
