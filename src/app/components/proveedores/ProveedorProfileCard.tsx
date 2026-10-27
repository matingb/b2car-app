"use client";

import React from "react";
import { Building2 } from "lucide-react";
import { COLOR } from "@/theme/theme";
import type { Proveedor } from "@/model/types";
import type { ProveedorCuentaCorrienteResumen } from "@/model/dtos";
import EntityProfileCard from "@/app/components/ui/EntityProfileCard";
import { Permission } from "@/lib/permissions";

export type ProveedorProfileCardProps = {
  proveedor: Proveedor;
  resumenCuentaCorriente: ProveedorCuentaCorrienteResumen | null;
  loadingFinanzas?: boolean;
  onEditProveedor: () => void;
  onDeleteProveedor?: () => void;
  rubro?: string | null;
  condicionPago?: string | null;
};

export default function ProveedorProfileCard({
  proveedor,
  resumenCuentaCorriente,
  loadingFinanzas = false,
  onEditProveedor,
  onDeleteProveedor,
}: ProveedorProfileCardProps) {
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
      detailsTitle="DATOS DE CONTACTO Y FISCALES"
    />
  );
}
