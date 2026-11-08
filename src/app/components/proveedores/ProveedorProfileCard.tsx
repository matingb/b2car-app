"use client";

import React from "react";
import { ArrowDownLeft, ArrowUpRight, Building2 } from "lucide-react";
import { COLOR } from "@/theme/theme";
import type { Proveedor } from "@/model/types";
import type { ProveedorCuentaCorrienteResumen } from "@/model/dtos";
import EntityProfileCard from "@/app/components/ui/EntityProfileCard";
import Can from "@/app/components/auth/Can";
import IconButton from "@/app/components/ui/IconButton";
import { Permission } from "@/lib/permissions";

export type ProveedorProfileCardProps = {
  proveedor: Proveedor;
  resumenCuentaCorriente: ProveedorCuentaCorrienteResumen | null;
  loadingFinanzas?: boolean;
  onEditProveedor: () => void;
  onDeleteProveedor?: () => void;
  onRegistrarPago?: () => void;
  onRegistrarCobro?: () => void;
  rubro?: string | null;
  condicionPago?: string | null;
};

export default function ProveedorProfileCard({
  proveedor,
  resumenCuentaCorriente,
  loadingFinanzas = false,
  onEditProveedor,
  onDeleteProveedor,
  onRegistrarPago,
  onRegistrarCobro,
}: ProveedorProfileCardProps) {
  const registrarMovimientoActions =
    onRegistrarPago || onRegistrarCobro ? (
      <Can permission={Permission.ProveedoresFinanzasEdit}>
        {onRegistrarPago && (
          <IconButton
            icon={<ArrowUpRight size={18} />}
            size={18}
            onClick={(e) => {
              e.stopPropagation();
              onRegistrarPago();
            }}
            hoverColor={COLOR.ACCENT.PRIMARY}
            data-testid="proveedor-detail-registrar-pago"
            tooltip="Registrar Pago"
            ariaLabel="Registrar Pago"
          />
        )}
        {onRegistrarCobro && (
          <IconButton
            icon={<ArrowDownLeft size={18} />}
            size={18}
            onClick={(e) => {
              e.stopPropagation();
              onRegistrarCobro();
            }}
            hoverColor={COLOR.SEMANTIC.SUCCESS}
            data-testid="proveedor-detail-registrar-cobro"
            tooltip="Registrar Cobro"
            ariaLabel="Registrar Cobro"
          />
        )}
      </Can>
    ) : null;

  return (
    <EntityProfileCard
      title={proveedor.nombre}
      icon={<Building2 size={20} color={COLOR.ACCENT.PRIMARY} />}
      address={proveedor.direccion}
      saldo={resumenCuentaCorriente?.saldoAdeudado}
      loadingFinanzas={loadingFinanzas}
      finanzasPermission={Permission.OperacionesView}
      email={proveedor.email}
      telefono={proveedor.telefono}
      documentoLabel="CUIT"
      documentoValor={proveedor.cuit}
      showEmptyDocumento
      whatsappPhone={proveedor.telefono}
      whatsappMessage={`Hola ${proveedor.nombre}, me comunico desde el taller.`}
      onEdit={onEditProveedor}
      editTestId="proveedor-detail-edit"
      editPermission={Permission.ProveedoresEdit}
      onDelete={onDeleteProveedor}
      deleteTestId="proveedor-detail-delete"
      deletePermission={Permission.ProveedoresEdit}
      extraActions={registrarMovimientoActions}
      detailsTitle="DATOS DE CONTACTO Y FISCALES"
    />
  );
}


