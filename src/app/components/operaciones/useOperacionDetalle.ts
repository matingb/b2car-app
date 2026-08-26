import { Building2, Package, Tag, WalletCards } from "lucide-react";
import type { Operacion } from "@/model/types";
import type { StockItem } from "@/model/stock";

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
    const firstLine = lineas[0];
    const stockInfo = stocksById?.[firstLine.stock_id];
    const productName = firstLine.nombre || stockInfo?.nombre || "Producto";
    const qtySuffix = firstLine.cantidad > 1 ? ` (x${firstLine.cantidad})` : "";
    if (totalLineas === 1) {
      return `Compra · ${productName}${qtySuffix}`;
    }
    return `Compra · ${productName}${qtySuffix} + ${totalLineas - 1} más`;
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

  const { totalLineas, totalMonto } = getTotals(operacion);
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
        labelDesktop: "Movimiento financiero",
        labelMobile: "Movimiento",
      }
    : {
        icon: Package,
        labelDesktop: `${totalLineas} productos`,
        labelMobile: `${totalLineas}`,
      };

  const accountOrWorkshop = isMovimientoFinanciero
    ? {
        icon: WalletCards,
        labelDesktop: operacion.cuenta_financiera_nombre ?? "Cuenta financiera",
        labelMobile: operacion.cuenta_financiera_nombre ?? "Cuenta",
      }
    : {
        icon: Building2,
        labelDesktop: tallerLabel,
        labelMobile: tallerLabel,
      };

  return {
    title,
    isGasto,
    isMovimientoFinanciero,
    totalLineas,
    totalMonto,
    metaBadge,
    accountOrWorkshop,
    deleteTitle: isGasto ? "Eliminar gasto" : "Eliminar movimiento",
  };
}
