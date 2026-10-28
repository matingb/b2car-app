"use client";

import React, { useState } from "react";
import { Vehiculo } from "@/model/types";
import ClienteTabsNav, { type ClienteTabKey } from "./ClienteTabsNav";
import VehiculosAsociadosCard from "./VehiculosAsociadosCard";
import ClienteArreglosTab from "./ClienteArreglosTab";
import ClienteVentasTab from "./ClienteVentasTab";
import ClienteCuentaCorrienteTab from "./ClienteCuentaCorrienteTab";
import Can from "@/app/components/auth/Can";
import { Permission } from "@/lib/permissions";

export type ClienteTabsContentProps = {
  activeTab: ClienteTabKey;
  clienteId: string;
  clienteNombre?: string;
  vehiculos: Vehiculo[];
  onAddVehiculo?: () => void;
  /** Se invoca al cobrar o anular un cobro desde el tab de arreglos. */
  onArregloPagoUpdated?: () => void;
  onVentaUpdated?: () => void;
};

export function ClienteTabsContent({
  activeTab,
  clienteId,
  clienteNombre,
  vehiculos,
  onAddVehiculo,
  onArregloPagoUpdated,
  onVentaUpdated,
}: ClienteTabsContentProps) {
  return (
    <>
      {activeTab === "vehiculos" && (
        <VehiculosAsociadosCard
          vehiculos={vehiculos}
          onAddVehiculo={onAddVehiculo}
        />
      )}

      {activeTab === "arreglos" && (
        <ClienteArreglosTab
          clienteId={clienteId}
          onPagoUpdated={onArregloPagoUpdated}
        />
      )}

      {activeTab === "ventas" && (
        <Can permission={Permission.OperacionesView}>
          <ClienteVentasTab
            clienteId={clienteId}
            clienteNombre={clienteNombre ?? ""}
            onVentaUpdated={onVentaUpdated ?? onArregloPagoUpdated}
          />
        </Can>
      )}

      {activeTab === "cuenta_corriente" && (
        <Can permission={Permission.ClientesFinanzasView}>
          <ClienteCuentaCorrienteTab
            clienteId={clienteId}
          />
        </Can>
      )}
    </>
  );
}

export type ClienteTabsSectionProps = {
  clienteId: string;
  clienteNombre?: string;
  vehiculos: Vehiculo[];
  onAddVehiculo?: () => void;
  activeTab?: ClienteTabKey;
  onChangeTab?: (tab: ClienteTabKey) => void;
  defaultTab?: ClienteTabKey;
  onArregloPagoUpdated?: () => void;
  onVentaUpdated?: () => void;
};

export default function ClienteTabsSection({
  clienteId,
  clienteNombre,
  vehiculos,
  onAddVehiculo,
  activeTab: controlledActiveTab,
  onChangeTab: controlledOnChangeTab,
  defaultTab = "vehiculos",
  onArregloPagoUpdated,
  onVentaUpdated,
}: ClienteTabsSectionProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<ClienteTabKey>(defaultTab);

  const activeTab = controlledActiveTab ?? internalActiveTab;
  const handleTabChange = controlledOnChangeTab ?? setInternalActiveTab;

  return (
    <>
      <ClienteTabsNav
        activeTab={activeTab}
        onChangeTab={handleTabChange}
      />

      <ClienteTabsContent
        activeTab={activeTab}
        clienteId={clienteId}
        clienteNombre={clienteNombre}
        vehiculos={vehiculos}
        onAddVehiculo={onAddVehiculo}
        onArregloPagoUpdated={onArregloPagoUpdated}
        onVentaUpdated={onVentaUpdated}
      />
    </>
  );
}

