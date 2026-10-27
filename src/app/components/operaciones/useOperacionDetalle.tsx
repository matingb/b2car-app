import React from "react";
import Color from "color";
import {
  ArrowLeftRight,
  Building2,
  CircleDollarSign,
  Package,
  Receipt,
  SlidersHorizontal,
  Tag,
  Truck,
  WalletCards,
  Wrench,
} from "lucide-react";
import { COLOR } from "@/theme/theme";
import type { Operacion, TipoOperacion } from "@/model/types";
import type { StockItem } from "@/model/stock";

export const tipoConfig: Record<
  TipoOperacion,
  { label: string; icon: React.ReactNode; color: string; bg: string }
> = {
  COMPRA: {
    label: "Compra",
    icon: <Truck size={18} />,
    color: COLOR.SEMANTIC.DANGER,
    bg: Color(COLOR.SEMANTIC.DANGER).alpha(0.12).toString(),
  },
  VENTA: {
    label: "Venta",
    icon: <Receipt size={18} />,
    color: COLOR.SEMANTIC.SUCCESS,
    bg: Color(COLOR.SEMANTIC.SUCCESS).alpha(0.12).toString(),
  },
  GASTO: {
    label: "Gasto",
    icon: <WalletCards size={18} />,
    color: COLOR.SEMANTIC.DANGER,
    bg: Color(COLOR.SEMANTIC.DANGER).alpha(0.12).toString(),
  },
  ASIGNACION_ARREGLO: {
    label: "Asignación",
    icon: <Wrench size={18} />,
    color: COLOR.SEMANTIC.INFO,
    bg: Color(COLOR.SEMANTIC.INFO).alpha(0.12).toString(),
  },
  COBRO_ARREGLO: {
    label: "Cobro de arreglo",
    icon: <CircleDollarSign size={18} />,
    color: COLOR.SEMANTIC.SUCCESS,
    bg: Color(COLOR.SEMANTIC.SUCCESS).alpha(0.12).toString(),
  },
  AJUSTE: {
    label: "Ajuste",
    icon: <SlidersHorizontal size={18} />,
    color: COLOR.SEMANTIC.WARNING,
    bg: Color(COLOR.SEMANTIC.WARNING).alpha(0.12).toString(),
  },
  INGRESO: {
    label: "Ingreso manual",
    icon: <CircleDollarSign size={18} />,
    color: COLOR.SEMANTIC.SUCCESS,
    bg: Color(COLOR.SEMANTIC.SUCCESS).alpha(0.12).toString(),
  },
  APERTURA_CUENTA: {
    label: "Apertura de cuenta",
    icon: <WalletCards size={18} />,
    color: COLOR.SEMANTIC.INFO,
    bg: Color(COLOR.SEMANTIC.INFO).alpha(0.12).toString(),
  },
  TRANSFERENCIA: {
    label: "Transferencia",
    icon: <ArrowLeftRight size={18} />,
    color: COLOR.ACCENT.PRIMARY,
    bg: Color(COLOR.ACCENT.PRIMARY).alpha(0.12).toString(),
  },
  MOVIMIENTO_CUENTA: {
    label: "Movimiento",
    icon: <WalletCards size={18} />,
    color: COLOR.SEMANTIC.INFO,
    bg: Color(COLOR.SEMANTIC.INFO).alpha(0.12).toString(),
  },
};

export function getTotals(operacion: Operacion) {
  if (
    [
      "GASTO",
      "COBRO_ARREGLO",
      "INGRESO",
      "APERTURA_CUENTA",
      "TRANSFERENCIA",
      "MOVIMIENTO_CUENTA",
    ].includes(operacion.tipo)
  ) {
    return { totalLineas: 0, totalMonto: Number(operacion.monto) || 0 };
  }

  const totalLineas = operacion.lineas?.length ?? 0;
  const totalMonto = (operacion.lineas ?? []).reduce(
    (acc, linea) => acc + (linea.cantidad || 0) * (linea.monto_unitario || 0),
    0
  );
  return { totalLineas, totalMonto };
}

export function getOperacionTitle(
  operacion: Operacion,
  tipoLabel: string,
  stocksById?: Record<string, StockItem>
): string {
  if (operacion.descripcion) {
    return operacion.descripcion;
  }

  const lineas = operacion.lineas ?? [];
  const totalLineas = lineas.length;

  if (operacion.tipo === "COMPRA") {
    if (totalLineas === 0) return tipoLabel;
    const isSinCargo = getTotals(operacion).totalMonto === 0;
    const prefix = isSinCargo ? "Adquisición sin cargo" : "Compra";
    const firstLine = lineas[0];
    const stockInfo = stocksById?.[firstLine.stock_id];
    const productName = firstLine.nombre || stockInfo?.nombre || "Producto";
    const qtySuffix = firstLine.cantidad > 1 ? ` (x${firstLine.cantidad})` : "";
    if (totalLineas === 1) {
      return `${prefix} · ${productName}${qtySuffix}`;
    }
    return `${prefix} · ${productName}${qtySuffix} + ${totalLineas - 1} más`;
  }

  if (operacion.tipo === "VENTA") {
    if (totalLineas === 0) return tipoLabel;
    const firstLine = lineas[0];
    const stockInfo = stocksById?.[firstLine.stock_id];
    const productName = firstLine.nombre || stockInfo?.nombre || "Producto";
    const qtySuffix = firstLine.cantidad > 1 ? ` (x${firstLine.cantidad})` : "";
    if (totalLineas === 1) {
      return `Venta · ${productName}${qtySuffix}`;
    }
    return `Venta · ${productName}${qtySuffix} + ${totalLineas - 1} más`;
  }

  if (operacion.tipo === "ASIGNACION_ARREGLO") {
    if (totalLineas === 0) return tipoLabel;
    const firstLine = lineas[0];
    const stockInfo = stocksById?.[firstLine.stock_id];
    const productName = firstLine.nombre || stockInfo?.nombre || "Repuesto";
    const qtySuffix = firstLine.cantidad > 1 ? ` (x${firstLine.cantidad})` : "";
    if (totalLineas === 1) {
      return `Asignación · ${productName}${qtySuffix}`;
    }
    return `Asignación · ${productName}${qtySuffix} + ${totalLineas - 1} más`;
  }

  return tipoLabel;
}

export function useOperacionDetalle({
  operacion,
  tipoLabel,
  tallerLabel,
  stocksById,
}: {
  operacion: Operacion;
  tipoLabel: string;
  tallerLabel: string;
  stocksById?: Record<string, StockItem>;
}) {
  const isGasto = operacion.tipo === "GASTO";
  const isMovimientoFinanciero = [
    "GASTO",
    "COBRO_ARREGLO",
    "INGRESO",
    "APERTURA_CUENTA",
    "TRANSFERENCIA",
    "MOVIMIENTO_CUENTA",
  ].includes(operacion.tipo);
  const esOperacionConCuenta =
    isMovimientoFinanciero || ["COMPRA", "VENTA"].includes(operacion.tipo);
  const hasCuentaFinanciera = Boolean(
    operacion.cuenta_financiera_id || operacion.cuenta_financiera_nombre?.trim()
  );

  const { totalLineas, totalMonto } = getTotals(operacion);
  const isSinCargo = operacion.tipo === "COMPRA" && totalLineas > 0 && totalMonto === 0;
  const title = getOperacionTitle(operacion, tipoLabel, stocksById);

  const metaBadge = isGasto
    ? {
        icon: Tag,
        labelDesktop: operacion.categoria_gasto ?? "Gasto",
        labelMobile: "Gasto",
      }
    : isMovimientoFinanciero
    ? {
        icon: WalletCards,
        labelDesktop: operacion.tipo === "INGRESO" ? "Ingreso manual" : "Movimiento financiero",
        labelMobile: operacion.tipo === "INGRESO" ? "Ingreso manual" : "Movimiento",
      }
    : {
        icon: Package,
        labelDesktop: `${totalLineas} ${totalLineas === 1 ? "producto" : "productos"}`,
        labelMobile: `${totalLineas}`,
      };

  const accountOrWorkshop = esOperacionConCuenta
    ? hasCuentaFinanciera
      ? {
        icon: WalletCards,
        labelDesktop: operacion.cuenta_financiera_nombre ?? "Cuenta financiera",
        labelMobile: operacion.cuenta_financiera_nombre ?? "Cuenta",
      }
      : isSinCargo
      ? {
        icon: Building2,
        labelDesktop: tallerLabel,
        labelMobile: tallerLabel,
      }
      : null
    : {
        icon: Building2,
        labelDesktop: tallerLabel,
        labelMobile: tallerLabel,
      };

  return {
    title,
    isGasto,
    isMovimientoFinanciero,
    isSinCargo,
    totalLineas,
    totalMonto,
    metaBadge,
    accountOrWorkshop,
    deleteTitle: isGasto ? "Eliminar gasto" : "Eliminar movimiento",
  };
}
