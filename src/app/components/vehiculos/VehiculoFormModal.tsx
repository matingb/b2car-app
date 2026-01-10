"use client";

import React, { useEffect, useMemo, useState } from "react";
import Autocomplete, { AutocompleteOption } from "../ui/Autocomplete";
import Modal from "../ui/Modal";
import { COLOR } from "@/theme/theme";
import { useToast } from "@/app/providers/ToastProvider";
import { useClientes } from "@/app/providers/ClientesProvider";

export type VehiculoFormValues = {
  cliente_id?: string | number;
  patente: string;
  marca: string;
  modelo: string;
  fecha_patente: string; // YYYY
  nro_interno: string;
};

type Props<TResult> = {
  open: boolean;
  title: string;
  submitText: string;
  onClose: (result?: TResult) => void;
  onSubmit: (values: VehiculoFormValues) => Promise<TResult>;
  initialValues: Pick<VehiculoFormValues, "patente" | "marca" | "modelo" | "fecha_patente" | "nro_interno">;
  showClienteInput?: boolean;
  clienteId?: string | number;
  tipoCliente?: "particular" | "empresa";
};

export default function VehiculoFormModal<TResult = void>({
  open,
  title,
  submitText,
  onClose,
  onSubmit,
  initialValues,
  showClienteInput = false,
  clienteId,
  tipoCliente
}: Props<TResult>) {
  const [patente, setPatente] = useState(initialValues.patente ?? "");
  const [marca, setMarca] = useState(initialValues.marca ?? "");
  const [modelo, setModelo] = useState(initialValues.modelo ?? "");
  const [fechaPatente, setFechaPatente] = useState(initialValues.fecha_patente ?? "");
  const [nroInterno, setNroInterno] = useState(initialValues.nro_interno ?? "");
  const [selectedClienteId, setSelectedClienteId] = useState<string>(clienteId ? String(clienteId) : "");
  const [clientesOptions, setClientesOptions] = useState<AutocompleteOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { error: toastError } = useToast();
  const {clientes} = useClientes();

  const selectedCliente = useMemo(() => {
    if (!selectedClienteId) return undefined;
    return clientes.find((c) => String(c.id) === selectedClienteId);
  }, [clientes, selectedClienteId]);

  useEffect(() => {
    if (!open) return;
    setPatente(initialValues.patente ?? "");
    setMarca(initialValues.marca ?? "");
    setModelo(initialValues.modelo ?? "");
    setFechaPatente(initialValues.fecha_patente ?? "");
    setNroInterno(initialValues.nro_interno ?? "");
    setSelectedClienteId(clienteId ? String(clienteId) : "");
    setSubmitting(false);
  }, [
    open,
    clienteId,
    initialValues.patente,
    initialValues.marca,
    initialValues.modelo,
    initialValues.fecha_patente,
    initialValues.nro_interno,
  ]);

  useEffect(() => {
    if (!open) return;
    if (!showClienteInput) return;
    const opts = clientes.map((c) => ({
      value: String(c.id),
      label: String(
        tipoCliente === "empresa"
          ? c.nombre
          : `${c.nombre} ${"apellido" in c && c.apellido ? c.apellido : ""}`.trim()
      ),
      secondaryLabel: String(c.email || ""),  
    }));
    setClientesOptions(opts);  

  }, [open, showClienteInput, clientes, tipoCliente]);

  const isValid = useMemo(() => {
    const okPatente = patente.trim().length > 0;
    const okCliente = showClienteInput ? selectedClienteId.trim().length > 0 : true;
    return okPatente && okCliente;
  }, [patente, showClienteInput, selectedClienteId]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    try {
      const result = await onSubmit({
        cliente_id: showClienteInput ? selectedClienteId : clienteId,
        patente: patente.trim().toUpperCase(),
        marca: marca.trim() || "",
        modelo: modelo.trim() || "",
        fecha_patente: fechaPatente || "",
        nro_interno: nroInterno.trim() || "",
      });
      onClose(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ocurrió un error";
      toastError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={() => onClose()}
      onSubmit={handleSubmit}
      submitText={submitText}
      submitting={submitting}
      disabledSubmit={!isValid}
    >
      {showClienteInput && (
        <div style={{ marginBottom: 12 }}>
          <label style={styles.label}>
            Cliente <span style={{ color: "#d00" }}>*</span>
          </label>
          <Autocomplete
            options={clientesOptions}
            value={selectedClienteId}
            onChange={(v) => {
              setSelectedClienteId(v);
            }}
            placeholder="Buscar cliente..."
          />
        </div>
      )}

      <div style={{ padding: "4px 0 12px" }}>
        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>
              Patente <span style={{ color: "#d00" }}>*</span>
            </label>
            <input
              style={styles.input}
              placeholder="AAA000 ~ AA000AA"
              value={patente}
              onChange={(e) => {
                const noSpaces = e.target.value.replace(/\s/g, "");
                setPatente(noSpaces.toUpperCase());
              }}
              inputMode="text"
              maxLength={7}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Año patente</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              style={styles.input}
              placeholder="YYYY"
              value={fechaPatente}
              onChange={(e) => {
                const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 4);
                setFechaPatente(onlyDigits);
              }}
            />
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Marca</label>
            <input
              style={styles.input}
              placeholder="Toyota"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Modelo</label>
            <input
              style={styles.input}
              placeholder="Corolla"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
            />
          </div>
          {(( selectedCliente?.tipo_cliente === "empresa" || tipoCliente === "empresa") || initialValues.nro_interno!="") && (
              <div style={styles.field}>
                <label style={styles.label}>Nro interno</label>
                <input
                  style={styles.input}
                  placeholder="123"
                  value={nroInterno}
                  onChange={(e) => setNroInterno(e.target.value)}
                />
              </div>  
            )}
        </div>
      </div>
    </Modal>
  );
}

const styles = {
  row: {
    display: "flex",
    gap: 16,
    marginTop: 10,
  },
  field: {
    flex: 1,
  },
  label: {
    display: "block",
    fontSize: 13,
    marginBottom: 6,
    color: COLOR.TEXT.SECONDARY,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
  },
  error: {
    color: "#b00020",
    fontSize: 13,
    marginTop: 6,
  },
} as const;


