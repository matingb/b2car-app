"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseComprobanteRecibidoInput, type ComprobanteInputResult } from "@/lib/comprobantesRecibidos/input";
import {
  MAX_LINEAS_COMPROBANTE,
  isCondicionIvaProveedor,
  resolverPercepcion,
  type ComprobanteRecibidoIdentidad,
  type CondicionIvaProveedor,
  type FacturaRecibidaClase,
} from "@/lib/comprobantesRecibidos/types";
import { generateUuidV4 } from "@/lib/uuid";
import type { Proveedor, TipoOperacion } from "@/model/types";

/*
 * Factura recibida cargada en el mismo formulario de alta de una compra o un gasto.
 * Los conceptos salen del detalle de la operación (productos o gasto); el usuario completa
 * los datos del documento, el emisor y las percepciones. El documento se guarda después de
 * crear la operación, por su circuito propio (no modifica pagos, saldos ni stock).
 */

export type PercepcionDraft = {
  key: string;
  /** Código sugerido o texto libre del selector abierto. */
  percepcion: string;
  importe: string;
};

export type FacturaCompraDraft = {
  clase: FacturaRecibidaClase | "";
  numero: string;
  /** Vacío: se usa la fecha de la operación. */
  fecha: string;
  emisorRazonSocial: string;
  emisorCuit: string;
  emisorCondicionIva: CondicionIvaProveedor | "";
  emisorDomicilio: string;
  /** Fecha de vencimiento de la factura (opcional). */
  fechaVencimiento: string;
  percepciones: PercepcionDraft[];
};

export type ConceptoFactura = { descripcion: string; importe: number };

const EMPTY_RECEPTOR: ComprobanteRecibidoIdentidad = { razonSocial: null, cuit: null, condicionIva: null };

/** Última posición del switch "Cargar con factura" en este navegador (preferencia por usuario). */
const PREFERENCIA_STORAGE_KEY = "b2car.operaciones.cargarConFactura";

function leerPreferencia(): boolean {
  try {
    return window.localStorage.getItem(PREFERENCIA_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function guardarPreferencia(value: boolean) {
  try {
    window.localStorage.setItem(PREFERENCIA_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Sin almacenamiento (modo privado, bloqueado): el switch arranca apagado la próxima vez.
  }
}

function emptyDraft(): FacturaCompraDraft {
  return {
    clase: "",
    numero: "",
    fecha: "",
    emisorRazonSocial: "",
    emisorCuit: "",
    emisorCondicionIva: "",
    emisorDomicilio: "",
    fechaVencimiento: "",
    percepciones: [],
  };
}

export function nuevaPercepcion(): PercepcionDraft {
  return { key: generateUuidV4(), percepcion: "", importe: "" };
}

export function importePercepcion(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Arma y valida el documento con las mismas reglas que la API. */
export function buildFacturaCompraInput({
  draft,
  fechaOperacion,
  conceptos,
  proveedorId,
  receptor = EMPTY_RECEPTOR,
}: {
  draft: FacturaCompraDraft;
  fechaOperacion: string;
  conceptos: ConceptoFactura[];
  proveedorId: string | null;
  receptor?: ComprobanteRecibidoIdentidad;
}): ComprobanteInputResult {
  if (conceptos.length === 0) {
    return { error: "La factura necesita al menos un concepto con importe: completá el detalle de la operación" };
  }
  const percepciones = draft.percepciones.map((linea) => {
    const percepcion = resolverPercepcion(linea.percepcion);
    const importeTexto = linea.importe.trim().replace(",", ".");
    return {
      tipo: "PERCEPCION" as const,
      descripcion: percepcion?.descripcion ?? "",
      percepcionCodigo: percepcion?.codigo ?? "OTRA",
      importe: importeTexto ? Number(importeTexto) : Number.NaN,
    };
  });
  const percepcionInvalida = percepciones.findIndex((linea) => !linea.descripcion || !(linea.importe > 0));
  if (percepcionInvalida >= 0) {
    return { error: `Percepción ${percepcionInvalida + 1}: indicá la percepción y un importe mayor a 0` };
  }
  if (conceptos.length + percepciones.length > MAX_LINEAS_COMPROBANTE) {
    return { error: `La factura admite hasta ${MAX_LINEAS_COMPROBANTE} líneas entre conceptos y percepciones` };
  }

  return parseComprobanteRecibidoInput({
    tipoDocumento: "FACTURA",
    clase: draft.clase || null,
    numero: draft.numero,
    fecha: draft.fecha || fechaOperacion,
    proveedorId,
    emisor: {
      razonSocial: draft.emisorRazonSocial,
      cuit: draft.emisorCuit,
      condicionIva: draft.emisorCondicionIva || null,
      domicilio: draft.emisorDomicilio,
    },
    receptor,
    codigoAutorizacion: null,
    vencimientoAutorizacion: null,
    fechaVencimiento: draft.fechaVencimiento,
    observaciones: null,
    lineas: [
      ...conceptos.map((concepto) => ({
        tipo: "CONCEPTO",
        descripcion: concepto.descripcion,
        percepcionCodigo: null,
        importe: concepto.importe,
      })),
      ...percepciones,
    ],
  });
}

export function useFacturaCompraDraft({
  open,
  tipo,
  proveedor,
}: {
  open: boolean;
  tipo: TipoOperacion | null;
  proveedor: Proveedor | null;
}) {
  const [activa, setActiva] = useState(false);
  const [draft, setDraft] = useState<FacturaCompraDraft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  // Último proveedor copiado al emisor: cambiar de proveedor vuelve a precargar, pero
  // las correcciones manuales no se pisan mientras el proveedor sea el mismo.
  const proveedorPrecargadoRef = useRef<string | null>(null);

  useEffect(() => {
    if (open) {
      setActiva(leerPreferencia());
      return;
    }
    setActiva(false);
    setDraft(emptyDraft());
    setError(null);
    proveedorPrecargadoRef.current = null;
  }, [open]);

  useEffect(() => {
    if (tipo !== "COMPRA" || !proveedor) return;
    if (proveedorPrecargadoRef.current === proveedor.id) return;
    proveedorPrecargadoRef.current = proveedor.id;
    // Copia editable de la ficha: modificarla acá no actualiza el proveedor.
    setDraft((current) => ({
      ...current,
      emisorRazonSocial: proveedor.nombre ?? "",
      emisorCuit: proveedor.cuit ?? "",
      emisorCondicionIva: isCondicionIvaProveedor(proveedor.condicion_iva) ? proveedor.condicion_iva : "",
      emisorDomicilio: proveedor.direccion ?? "",
    }));
  }, [tipo, proveedor]);

  const update = useCallback((patch: Partial<Omit<FacturaCompraDraft, "percepciones">>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
  }, []);

  const addPercepcion = useCallback(() => {
    setDraft((current) => ({ ...current, percepciones: [...current.percepciones, nuevaPercepcion()] }));
  }, []);

  const updatePercepcion = useCallback((key: string, patch: Partial<Omit<PercepcionDraft, "key">>) => {
    setDraft((current) => ({
      ...current,
      percepciones: current.percepciones.map((linea) => (linea.key === key ? { ...linea, ...patch } : linea)),
    }));
    setError(null);
  }, []);

  const removePercepcion = useCallback((key: string) => {
    setDraft((current) => ({ ...current, percepciones: current.percepciones.filter((linea) => linea.key !== key) }));
    setError(null);
  }, []);

  const toggle = useCallback((value: boolean) => {
    setActiva(value);
    setError(null);
    guardarPreferencia(value);
  }, []);

  return {
    activa,
    setActiva: toggle,
    draft,
    update,
    addPercepcion,
    updatePercepcion,
    removePercepcion,
    error,
    setError,
  };
}

export type FacturaCompraState = ReturnType<typeof useFacturaCompraDraft>;
