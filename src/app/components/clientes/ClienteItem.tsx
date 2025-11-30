"use client";

import React from "react";
import { Mail, Phone, Trash2, FileText, Eye, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { Cliente, TipoCliente } from "@/model/types";
import Avatar from "@/app/components/ui/Avatar";
import Card from "@/app/components/ui/Card";
import { ROUTES } from "@/routing/routes";
import { COLOR } from "@/theme/theme";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useClientes } from "@/app/providers/ClientesProvider";
import IconButton from "../ui/IconButton";

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
      await deleteCliente(cliente.id);
      toast.success(
        "Cliente eliminado",
        typeof nombre === "string" ? nombre : undefined
      );
    } catch (err: any) {
      toast.error(
        "No se pudo eliminar el cliente",
        err?.message || "Error de red"
      );
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
    <Card onClick={handleOnClick}>
      <div style={styles.container}>
        <div style={styles.leftGroup}>
          <Avatar nombre={cliente.nombre} />

          <div>
            <div style={styles.name}>{`${cliente.nombre}`}</div>

            <div style={styles.direccionRow}>
              <MapPin size={14} color={COLOR.ICON.MUTED} />
              <span style={styles.direccionText}>{cliente.direccion}</span>
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
                    cliente.email ? styles.contactRowWithTop : styles.contactRow
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

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={styles.tipoCliente}>
            <span style={styles.tipoClienteText}>
              {cliente.tipo_cliente === TipoCliente.PARTICULAR
                ? "Particular"
                : "Empresa"}
            </span>
          </div>

          <IconButton icon={<Eye />} onClick={handleOnClick} size={20} />
          <IconButton icon={<Trash2 />} onClick={handleDelete} size={20} />
        </div>
      </div>
    </Card>
  );
}

const styles = {
  iconSize: 20,
  container: {
    padding: "16px 0px",
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
  tipoCliente: {
    background: COLOR.ACCENT.PRIMARY,
    padding: "4px",
    alignItems: "center",
    borderRadius: 8,
  },
  tipoClienteText: {
    fontSize: 14,
    fontWeight: 600,
    color: COLOR.TEXT.CONTRAST,
  },
  direccionText: {
    fontSize: 14,
    color: COLOR.ICON.MUTED,
  },
} as const;
