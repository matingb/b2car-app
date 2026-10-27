"use client";

import React from "react";
import { css } from "@emotion/react";
import { COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import Autocomplete from "@/app/components/ui/Autocomplete";
import Calendar from "@/app/components/ui/Calendar";
import CuentaFinancieraFormFields from "@/app/components/finanzas/CuentaFinancieraFormFields";
import CuentaFinancieraAutocomplete, {
  CREATE_CUENTA_VALUE,
} from "@/app/components/finanzas/CuentaFinancieraAutocomplete";
import { useOperacionForm } from "./OperacionFormContext";

export { CREATE_CUENTA_VALUE };

export default function OperacionHeaderFields() {
  const {
    talleres,
    tallerId,
    setTallerId,
    fecha,
    setFecha,
    cuentaFinancieraId,
    setCuentaFinancieraId,
    cuentaDraft,
    setCuentaDraft,
    tipo,
    isContextualStock,
    requiresCuenta,
    proveedorId,
    setProveedorId,
    disabledProveedor,
    proveedores,
    isProveedoresLoading,
    clienteId,
    setClienteId,
    disabledCliente,
    clientes,
    isClientesLoading,
    pagosDraft,
  } = useOperacionForm();

  const isCreatingCuenta = cuentaFinancieraId === CREATE_CUENTA_VALUE;
  const hasManyTalleres = talleres.length > 1;

  return (
    <>
      <div css={styles.headerRow} data-testid="operaciones-datos-principales">
        {tipo !== "GASTO" && hasManyTalleres && !isContextualStock ? (
          <div style={styles.headerCol}>
            <label style={styles.label}>Taller</label>
            <Autocomplete
              value={tallerId || ""}
              onChange={setTallerId}
              options={talleres.map((t) => ({ value: t.id, label: t.nombre }))}
              placeholder="Seleccionar taller"
              dataTestId="operaciones-create-taller"
              style={{ height: 38, fontSize: 14 }}
              hideClearButton
            />
          </div>
        ) : null}

        <div style={styles.headerCol}>
          <label style={styles.label}>Fecha</label>
          <Calendar
            value={fecha}
            onChange={setFecha}
            dataTestId="operaciones-create-fecha"
            style={{ height: 38 }}
          />
        </div>

        {tipo === "VENTA" && (
          <div style={styles.headerCol}>
            <label style={styles.label}>Cliente</label>
            <Autocomplete
              value={clienteId || ""}
              onChange={setClienteId}
              options={clientes.map((c) => ({
                value: c.id,
                label: c.nombre + (c.dni_cuil || c.cuit ? ` (${c.dni_cuil || c.cuit})` : ""),
              }))}
              placeholder={isClientesLoading ? "Cargando..." : "Seleccionar cliente"}
              dataTestId="operaciones-create-cliente"
              disabled={disabledCliente || isClientesLoading}
              style={{ height: 38, fontSize: 14 }}
            />
          </div>
        )}

        {(tipo === "COMPRA" || tipo === "GASTO") && (
          <div style={styles.headerCol}>
            <label style={styles.label}>Proveedor</label>
            <Autocomplete
              value={proveedorId || ""}
              onChange={setProveedorId}
              options={proveedores.map((p) => ({
                value: p.id,
                label: p.nombre + (p.cuit ? ` (${p.cuit})` : ""),
              }))}
              placeholder={isProveedoresLoading ? "Cargando..." : "Seleccionar proveedor"}
              dataTestId="operaciones-create-proveedor"
              disabled={disabledProveedor || isProveedoresLoading}
              style={{ height: 38, fontSize: 14 }}
            />
          </div>
        )}

        {tipo === "GASTO" && (
          <div style={styles.headerCol}>
            <label style={styles.label}>
              Cuenta financiera {requiresCuenta ? <span aria-hidden="true" style={styles.required}>*</span> : null}
            </label>
            <CuentaFinancieraAutocomplete
              value={cuentaFinancieraId}
              onChange={setCuentaFinancieraId}
              dataTestId="operaciones-create-cuenta-financiera"
              hideClearButton={requiresCuenta}
              placeholder="Seleccionar cuenta"
              style={{ height: 38, fontSize: 14 }}
            />
          </div>
        )}

        {tipo !== "GASTO" && (
          <input
            type="hidden"
            data-testid="operaciones-create-cuenta-financiera"
            value={pagosDraft[0]?.cuentaId ?? cuentaFinancieraId}
            readOnly
          />
        )}
      </div>

      {tipo === "GASTO" && isCreatingCuenta && (
        <CuentaFinancieraFormFields
          values={cuentaDraft}
          onChange={(patch) => setCuentaDraft({ ...cuentaDraft, ...patch })}
          showSaldoInicial={false}
          showActivo={false}
          compact
          dataTestIdPrefix="operaciones-cuenta"
        />
      )}
    </>
  );
}

const styles = {
  headerRow: css({
    display: "flex",
    gap: 12,
    alignItems: "flex-end",
    flexWrap: "wrap",
    marginBottom: 16,
    "@media (max-width: 680px)": {
      flexDirection: "column",
      alignItems: "stretch",
    },
  }),
  headerCol: {
    flex: "1 1 0",
    minWidth: 160,
  } as const,
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: COLOR.TEXT.SECONDARY,
    marginBottom: 6,
  },
  required: {
    color: REQUIRED_ICON_COLOR,
    fontWeight: 700,
    marginLeft: 2,
  },
} as const;
