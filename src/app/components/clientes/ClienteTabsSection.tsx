"use client";

import React, { useState } from "react";
import { Vehiculo } from "@/model/types";
import ClienteTabsNav, { type ClienteTabKey } from "./ClienteTabsNav";
import VehiculosAsociadosCard from "./VehiculosAsociadosCard";
import ClienteArreglosTab from "./ClienteArreglosTab";
import ClienteCuentaCorrienteTab from "./ClienteCuentaCorrienteTab";
import Can from "@/app/components/auth/Can";
import { Permission } from "@/lib/permissions";

export type ClienteTabsContentProps = {
  activeTab: ClienteTabKey;
  clienteId: string;
  vehiculos: Vehiculo[];
  onAddVehiculo?: () => void;
};

export function ClienteTabsContent({
  activeTab,
  clienteId,
  vehiculos,
  onAddVehiculo,
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
        />
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
  vehiculos: Vehiculo[];
  onAddVehiculo?: () => void;
  activeTab?: ClienteTabKey;
  onChangeTab?: (tab: ClienteTabKey) => void;
  defaultTab?: ClienteTabKey;
  arreglosCount?: number;
};

export default function ClienteTabsSection({
  clienteId,
  vehiculos,
  onAddVehiculo,
  activeTab: controlledActiveTab,
  onChangeTab: controlledOnChangeTab,
  defaultTab = "vehiculos",
  arreglosCount,
}: ClienteTabsSectionProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<ClienteTabKey>(defaultTab);

  const activeTab = controlledActiveTab ?? internalActiveTab;
  const handleTabChange = controlledOnChangeTab ?? setInternalActiveTab;

  return (
    <>
      <ClienteTabsNav
        activeTab={activeTab}
        onChangeTab={handleTabChange}
        vehiculosCount={vehiculos.length}
        arreglosCount={arreglosCount}
      />

      <ClienteTabsContent
        activeTab={activeTab}
        clienteId={clienteId}
        vehiculos={vehiculos}
        onAddVehiculo={onAddVehiculo}
      />
    </>
  );
}
