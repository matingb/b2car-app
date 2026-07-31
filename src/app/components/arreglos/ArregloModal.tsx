"use client";

import React, { useEffect, useMemo, useState } from "react";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import Modal from "@/app/components/ui/Modal";
import { Arreglo, Vehiculo } from "@/model/types";
import { useVehiculos } from "@/app/providers/VehiculosProvider";
import { useArreglos } from "@/app/providers/ArreglosProvider";
import { CreateArregloInput, UpdateArregloInput } from "@/clients/arreglosClient";
import { toDateInputFormat, toISODateLocal } from "@/lib/fechas";
import { formatPatenteConMarcaYModelo } from "@/lib/vehiculos";
import { assembleClientePhone, buildArregloWhatsappMessage } from "@/lib/whatsapp";
import { useTenant } from "@/app/providers/TenantProvider";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useWhatsAppMessage } from "@/app/hooks/useWhatsAppMessage";
import { useToast } from "@/app/providers/ToastProvider";
import { ESTADOS_ARREGLO, EstadoArreglo } from "@/model/types";
import ArregloFormFields, {
  type ArregloForm,
  type ArregloFormFieldsInternal,
  type ArregloFormFieldsValues,
} from "@/app/components/arreglos/ArregloFormFields";
import { finanzasClient } from "@/clients/finanzasClient";
import type { CuentaFinanciera } from "@/model/finanzas";
import { useInventario } from "@/app/providers/InventarioProvider";
import { COLOR } from "@/theme/theme";
import { isValidDate } from "@/lib/fechas";
import { generateUuidV4 } from "@/lib/uuid";

type Props = {
  open: boolean;
  vehiculoId?: number | string;
  initial?: Partial<ArregloForm> & { id?: string };
  onClose: (updated?: boolean) => void;
  onSubmitSuccess?: (arreglo: Arreglo) => void;
};

export function getArregloModalFecha(initialFecha?: string): string {
  return initialFecha ? toDateInputFormat(initialFecha) : toISODateLocal(new Date());
}

export function normalizeArregloObservaciones(observaciones: string, isEdit: boolean): string | undefined {
  const normalized = observaciones.trim();
  return isEdit ? normalized : normalized || undefined;
}

export default function ArregloModal({ open, onClose, vehiculoId, initial, onSubmitSuccess }: Props) {
  const { vehiculos, fetchAll: fetchVehiculos, fetchCliente } = useVehiculos();
  const { create, update, fetchById } = useArreglos();
  const { tallerSeleccionadoId } = useTenant();
  const { inventario, isLoading: isInventarioLoading } = useInventario(tallerSeleccionadoId ?? undefined);
  const { confirm } = useModalMessage();
  const { success, error: toastError } = useToast();
  const { share } = useWhatsAppMessage();

  const createEmptyInternal = (): ArregloFormFieldsInternal => ({
    serviciosDraft: [],
    repuestosDraft: [],
    detalleFormulario: null,
    subtotalServicios: 0,
    subtotalRepuestos: 0,
    totalCalculado: 0,
    totalCalculadoLabel: "0",
  });

  const isEdit = !!initial?.id;

  const [estado, setEstado] = useState<EstadoArreglo>(initial?.estado ?? "SIN_INICIAR");
  const [fecha, setFecha] = useState(getArregloModalFecha(initial?.fecha));
  const [km, setKm] = useState<string>(initial?.kilometraje_leido != null ? String(initial.kilometraje_leido) : "");
  const [observaciones, setObservaciones] = useState(initial?.observaciones ?? "");
  const [estaPago, setEstaPago] = useState<boolean>(!!initial?.esta_pago);
  const [cuentasFinancieras, setCuentasFinancieras] = useState<CuentaFinanciera[]>([]);
  const [cuentaFinancieraId, setCuentaFinancieraId] = useState("");
  const [fechaCobro, setFechaCobro] = useState(() => toISODateLocal(new Date()));
  const [isLoadingCuentas, setIsLoadingCuentas] = useState(false);
  const [extraData, setExtraData] = useState(initial?.extra_data ?? "");
  const [selectedVehiculoId, setSelectedVehiculoId] = useState<string>(vehiculoId ? String(vehiculoId) : "");
  const [submitting, setSubmitting] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internal, setInternal] = useState<ArregloFormFieldsInternal>(() =>
    createEmptyInternal()
  );

  useEffect(() => {
    if (!vehiculoId && open) {
      fetchVehiculos();
    }
  }, [open, vehiculoId, fetchVehiculos]);

  const vehiculoOptions: AutocompleteOption[] = useMemo(
    () =>
      vehiculos.map((v: Vehiculo) => {
        return {
          value: String(v.id),
          label: formatPatenteConMarcaYModelo(v),
          secondaryLabel: v.nombre_cliente,
        };
      }),
    [vehiculos]
  );

  useEffect(() => {
    if (!open) return;

    setEstado(initial?.estado ?? "SIN_INICIAR");
    setFecha(getArregloModalFecha(initial?.fecha));
    setKm(initial?.kilometraje_leido != null ? String(initial.kilometraje_leido) : "");
    setObservaciones(initial?.observaciones ?? "");
    setEstaPago(!!initial?.esta_pago);
    setCuentaFinancieraId("");
    setFechaCobro(toISODateLocal(new Date()));
    setExtraData(initial?.extra_data ?? "");
    setSelectedVehiculoId(vehiculoId ? String(vehiculoId) : "");
    setIsValid(false);

    if (!isEdit) {
      setInternal(createEmptyInternal());
    }
  }, [open, initial, vehiculoId, isEdit]);

  const requiereCompraAutomatica = useMemo(() => {
    if (isEdit) return false;
    return internal.repuestosDraft.some((repuesto) => {
      if (repuesto.tipo === "nuevo") return true;
      const stock = inventario.find((item) => item.id === repuesto.stock_id);
      return Boolean(stock && Number(repuesto.cantidad) > Number(stock.stockActual));
    });
  }, [inventario, internal.repuestosDraft, isEdit]);

  const requiereCuentaFinanciera = estaPago || requiereCompraAutomatica;

  useEffect(() => {
    if (!open || isEdit || !requiereCuentaFinanciera) return;

    let cancelled = false;
    setIsLoadingCuentas(true);
    void finanzasClient.listarCuentas().then((response) => {
      if (cancelled) return;
      if (response.error) {
        setError(response.error);
        setCuentasFinancieras([]);
      } else {
        setCuentasFinancieras((response.data ?? []).filter((cuenta) => cuenta.activo));
      }
    }).finally(() => {
      if (!cancelled) setIsLoadingCuentas(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isEdit, open, requiereCuentaFinanciera]);

  const cuentaOptions = useMemo<AutocompleteOption[]>(
    () => cuentasFinancieras.map((cuenta) => ({
      value: cuenta.id,
      label: cuenta.nombre,
      secondaryLabel: cuenta.tipo.replaceAll("_", " "),
    })),
    [cuentasFinancieras],
  );

  if (!open) return null;

  const fieldValues: ArregloFormFieldsValues = {

    estado,
    fecha,
    km,
    observaciones,
    estaPago,
    extraData,
    selectedVehiculoId,
  };

  const handleFieldsChange = (patch: Partial<ArregloFormFieldsValues>) => {
    const setters: Record<keyof ArregloFormFieldsValues, (value: unknown) => void> = {

      estado: (value) => {
        const next = String(value ?? "").trim().toUpperCase();
        if ((ESTADOS_ARREGLO as string[]).includes(next)) {
          setEstado(next as EstadoArreglo);
        }
      },
      fecha: (value) => setFecha(typeof value === "string" ? value : ""),
      km: (value) => setKm(typeof value === "string" ? value : ""),
      observaciones: (value) =>
        setObservaciones(typeof value === "string" ? value : ""),
      estaPago: (value) => setEstaPago(Boolean(value)),
      extraData: (value) => setExtraData(typeof value === "string" ? value : ""),
      selectedVehiculoId: (value) =>
        setSelectedVehiculoId(typeof value === "string" ? value : ""),
    };

    (Object.keys(patch) as (keyof ArregloFormFieldsValues)[]).forEach((key) => {
      setters[key](patch[key]);
    });
  };

  const handleShareArreglo = async (arregloId: string | number) => {
    try {
      const detalle = await fetchById(arregloId);
      if (!detalle?.arreglo?.vehiculo?.id) {
        toastError("Error", "No se pudo identificar el vehículo");
        return;
      }

      const tenantName = localStorage.getItem("tenant_name") || undefined;
      const mensaje = buildArregloWhatsappMessage(detalle, tenantName);
      if (!mensaje) {
        toastError("Error", "No se pudo generar el mensaje");
        return;
      }

      const cliente = await fetchCliente(String(detalle.arreglo.vehiculo.id));
      await share(mensaje, cliente ? assembleClientePhone(cliente) : undefined);
    } catch (err: unknown) {
      toastError("Error", err instanceof Error ? err.message : "No se pudo compartir el arreglo");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    if (requiereCuentaFinanciera && !cuentaFinancieraId) {
      setError("SeleccionÃ¡ la cuenta financiera que registrarÃ¡ el movimiento.");
      return;
    }
    if (estaPago && !isValidDate(fechaCobro)) {
      setError("IngresÃ¡ una fecha de cobro vÃ¡lida.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const payload: Partial<UpdateArregloInput> = {

        estado,
        fecha,
        kilometraje_leido: Number(km),
        // En edición, una cadena vacía es un cambio válido: elimina las observaciones previas.
        observaciones: normalizeArregloObservaciones(observaciones, isEdit),
        ...(!isEdit ? { esta_pago: !!estaPago } : {}),
        extra_data: extraData || undefined,
      };

      let response: Arreglo | null = null;

      if (isEdit && initial?.id) {
        response = await update(initial.id, payload);
      } else {
        if (!tallerSeleccionadoId) {
          throw new Error("Ocurrió un error al crear el arreglo");
        }
        const finalVehiculoId = vehiculoId || selectedVehiculoId;
        const precioFinalCalculado = Math.round(Number(internal.totalCalculado) || 0);
        const detalles = internal.serviciosDraft.map((s) => ({
          descripcion: String(s.descripcion ?? "").trim(),
          cantidad: Number(s.cantidad) || 0,
          valor: Number(s.valor) || 0,
          categoria_arreglo_id: s.categoriaArregloId || null,
          empleado_id: s.empleadoId || null,
        }));

        response = await create({
          vehiculo_id: finalVehiculoId!,
          taller_id: tallerSeleccionadoId,

          estado,
          fecha: fecha,
          kilometraje_leido: Number(km) || 0,
          precio_final: precioFinalCalculado,
          observaciones: payload.observaciones,
          esta_pago: payload.esta_pago,
          ...(requiereCuentaFinanciera ? {
            cuenta_financiera_id: cuentaFinancieraId,
            idempotency_key: generateUuidV4(),
          } : {}),
          ...(estaPago ? { fecha_cobro: fechaCobro } : {}),
          extra_data: payload.extra_data,
          detalles,
          repuestos: internal.repuestosDraft
            .filter((r) => r.tipo !== "nuevo")
            .map((r) => ({
              stock_id: String(r.stock_id ?? "").trim(),
              cantidad: Number(r.cantidad) || 0,
              monto_unitario: Number(r.monto_unitario) || 0,
              precio_compra: r.precioCompra,
              categoria_arreglo_id: r.categoriaArregloId || null,
              empleado_id: r.empleadoId || null,
            })),
          repuestos_nuevos: internal.repuestosDraft
            .filter((r) => r.tipo === "nuevo" && r.nuevoProducto)
            .map((r) => ({
              codigo: String(r.nuevoProducto?.codigo ?? "").trim(),
              nombre: String(r.nuevoProducto?.nombre ?? "").trim(),
              precio_compra: Number(r.nuevoProducto?.precioCompra) || 0,
              precio_venta: Number(r.nuevoProducto?.precioVenta) || 0,
              cantidad: Number(r.cantidad) || 0,
              categoria_arreglo_id: r.categoriaArregloId || null,
              empleado_id: r.empleadoId || null,
            })),
          detalle_formulario: internal.detalleFormulario ?? undefined,
        } as CreateArregloInput);
      }

      if (!response) {
        throw new Error(
          isEdit
            ? "No se pudo actualizar el arreglo"
            : "No se pudo crear el arreglo"
        );
      }
      onSubmitSuccess?.(response);

      onClose();
      if (!isEdit) {

        setEstado("SIN_INICIAR");
        setFecha(getArregloModalFecha());
        setKm("");
        setObservaciones("");
        setEstaPago(false);
        setExtraData("");
        setInternal(createEmptyInternal());
        success("Arreglo creado", "El arreglo se registró correctamente.");
      } else {
        success("Arreglo actualizado", "Los cambios del arreglo se guardaron correctamente.");
      }

      if (!isEdit && response) {
        const label = response.esta_pago ? "detalle" : "presupuesto";
        const confirmed = await confirm({
          title: "Compartir arreglo",
          message: `¿Querés compartir el ${label} del arreglo recién creado?`,
          acceptLabel: "Compartir",
          cancelLabel: "Ahora no",
        });
        if (confirmed) {
          await handleShareArreglo(response.id);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ocurrio un error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? "Editar arreglo" : "Crear arreglo"}
      onClose={() => onClose()}
      onSubmit={handleSubmit}
      submitText={isEdit ? "Guardar cambios" : "Crear"}
      submitting={submitting}
      disabledSubmit={!isValid || (requiereCuentaFinanciera && (!cuentaFinancieraId || isLoadingCuentas || (requiereCompraAutomatica && isInventarioLoading))) || (estaPago && !isValidDate(fechaCobro))}
      modalError={
        error
          ? {
            titulo: isEdit
              ? "No se pudo actualizar el arreglo"
              : "No se pudo crear el arreglo",
            descripcion: error,
          }
          : null
      }
      modalStyle={{
        width: isEdit ? "min(860px, 96vw)" : "min(1100px, 92vw)",
        maxHeight: "90dvh",
        overflow: "auto",
      }}
    >
      <div>
        <ArregloFormFields
          vehiculoId={vehiculoId}
          vehiculoOptions={vehiculoOptions}
          isEdit={isEdit}
          submitting={submitting}
          tallerId={tallerSeleccionadoId ?? null}
          values={fieldValues}
          onValuesChange={handleFieldsChange}
          onValidityChange={(next) => setIsValid(next)}
          onChange={(next) => setInternal(next)}
        />
        {!isEdit && requiereCuentaFinanciera ? (
          <div style={styles.finanzasBox}>
            <div style={styles.finanzasTitle}>
              {estaPago ? "Cobro del arreglo" : "Compra automÃ¡tica de repuestos"}
            </div>
            <div style={styles.finanzasHelp}>
              {estaPago
                ? "SeleccionÃ¡ la cuenta y la fecha que se usarÃ¡n para registrar el ingreso."
                : "Este arreglo requiere una compra de repuestos; seleccionÃ¡ la cuenta para registrar ese egreso."}
            </div>
            <div style={styles.finanzasRow}>
              <label style={styles.finanzasField}>
                Cuenta financiera
                <Autocomplete
                  value={cuentaFinancieraId}
                  onChange={setCuentaFinancieraId}
                  options={cuentaOptions}
                  placeholder={isLoadingCuentas ? "Cargando cuentas..." : "Seleccionar cuenta"}
                  disabled={isLoadingCuentas}
                  hideClearButton
                  dataTestId="arreglo-cuenta-financiera"
                />
              </label>
              {estaPago ? (
                <label style={styles.finanzasField}>
                  Fecha de cobro
                  <input
                    type="date"
                    value={fechaCobro}
                    onChange={(event) => setFechaCobro(event.target.value)}
                    style={styles.finanzasInput}
                    data-testid="arreglo-fecha-cobro"
                  />
                </label>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

const styles = {
  finanzasBox: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
    marginTop: 16,
    padding: 14,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    background: COLOR.BACKGROUND.SUBTLE,
  },
  finanzasTitle: {
    color: COLOR.TEXT.PRIMARY,
    fontWeight: 700,
    fontSize: 14,
  },
  finanzasHelp: {
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
    lineHeight: 1.4,
  },
  finanzasRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap" as const,
  },
  finanzasField: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    minWidth: 220,
    flex: 1,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
  },
  finanzasInput: {
    height: 42,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 10,
    padding: "0 12px",
    color: COLOR.TEXT.PRIMARY,
    background: COLOR.BACKGROUND.PRIMARY,
  } as const,
} as const;
