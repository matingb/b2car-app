import React from "react";
import type { TipoOperacion } from "@/model/types";
import type { GastoFinanciero } from "@/model/finanzas";
import type { OperacionLineaDraft } from "./OperacionLineaEditor";
import { Receipt, Truck, WalletCards } from "lucide-react";
import { generateUuidV4 } from "@/lib/uuid";

export type TallerLite = {
  id: string;
  nombre: string;
};

export type ProductoLite = {
  id: string;
  nombre: string;
  codigo: string;
  precio_unitario: number;
  costo_unitario: number;
};

export type OperacionModalProps = {
  open: boolean;
  talleres: TallerLite[];
  onClose: () => void;
  initialTipo?: TipoOperacion;
  initialCuentaId?: string | null;
  gasto?: GastoFinanciero | null;
};

export type TipoOperacionConfig = {
  tipo: TipoOperacion;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
};

export const TIPOS_UI: TipoOperacionConfig[] = [
  { tipo: "VENTA", label: "Venta", icon: <Receipt size={16} /> },
  { tipo: "COMPRA", label: "Compra", icon: <Truck size={16} /> },
  { tipo: "GASTO", label: "Gasto", icon: <WalletCards size={16} /> },
];

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function getDefaultUnitario(item: ProductoLite, tipo: TipoOperacion | null): number {
  if (tipo === "VENTA") return item.precio_unitario;
  if (tipo === "COMPRA") return item.costo_unitario;
  return 0;
}

export function createEmptyLinea(): OperacionLineaDraft {
  return {
    id: generateUuidV4(),
    stockId: "",
    cantidad: 1,
    unitario: 0,
    total: 0,
  };
}

export function buildOperacionCreatedMessage(
  tipo: TipoOperacion,
  tallerNombre: string,
  tipoConfigById: Map<TipoOperacion, TipoOperacionConfig>
): string {
  const tipoLabel = tipoConfigById.get(tipo)?.label.toLowerCase() ?? "operación";
  return `La ${tipoLabel} se registró correctamente para ${tallerNombre}.`;
}
