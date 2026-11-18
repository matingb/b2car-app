"use client";

import { useEffect, useState } from "react";
import Dropdown from "@/app/components/ui/Dropdown";
import Modal from "@/app/components/ui/Modal";
import { useOperaciones } from "@/app/providers/OperacionesProvider";
import { comprobantesRecibidosClient } from "@/clients/comprobantesRecibidosClient";
import {
  comprobanteRecibidoTitulo,
  resolverPercepcion,
  type ComprobanteRecibido,
} from "@/lib/comprobantesRecibidos/types";
import { validarCargos } from "@/lib/operaciones/cargos";
import type { Operacion } from "@/model/types";
import { OperacionPercepcionesEditor } from "./OperacionFacturaPercepciones";
import { nuevaPercepcion, type PercepcionDraft } from "./useFacturaCompraDraft";

type Props = {
  operacion: Operacion;
  montoBase: number;
  canViewRecibidos: boolean;
  onClose: () => void;
  onSaved: (operacion: Operacion) => void;
};

export default function OperacionCargosModal({ operacion, montoBase, canViewRecibidos, onClose, onSaved }: Props) {
  const { update } = useOperaciones();
  const [percepciones, setPercepciones] = useState<PercepcionDraft[]>(() =>
    (operacion.cargos ?? []).map((cargo) => ({
      key: cargo.id,
      percepcion: cargo.percepcion_codigo && cargo.percepcion_codigo !== "OTRA"
        ? cargo.percepcion_codigo
        : cargo.descripcion,
      importe: String(cargo.importe).replace(".", ","),
    })),
  );
  const [facturas, setFacturas] = useState<ComprobanteRecibido[]>([]);
  const [errorFacturas, setErrorFacturas] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canViewRecibidos) return;
    let cancelled = false;
    comprobantesRecibidosClient.listByOperacion(operacion.id)
      .then(({ comprobantes }) => {
        if (cancelled) return;
        setFacturas(comprobantes.filter(
          (doc) => doc.tipoDocumento === "FACTURA" && doc.lineas.some((linea) => linea.tipo === "PERCEPCION"),
        ));
      })
      .catch(() => {
        if (!cancelled) setErrorFacturas(true);
      });
    return () => { cancelled = true; };
  }, [canViewRecibidos, operacion.id]);

  const copiarPercepciones = (id: string) => {
    const factura = facturas.find((doc) => doc.id === id);
    if (!factura) return;
    setError(null);
    setPercepciones(factura.lineas.filter((linea) => linea.tipo === "PERCEPCION").map((linea) => ({
      ...nuevaPercepcion(),
      percepcion: linea.percepcionCodigo && linea.percepcionCodigo !== "OTRA"
        ? linea.percepcionCodigo
        : linea.descripcion,
      importe: String(linea.importe).replace(".", ","),
    })));
  };

  const guardar = async () => {
    if (submitting) return;
    const cargos = percepciones.map((linea) => {
      const percepcion = resolverPercepcion(linea.percepcion);
      return {
        percepcion_codigo: percepcion?.codigo ?? "OTRA",
        descripcion: percepcion?.descripcion ?? "",
        importe: Number(linea.importe.replace(",", ".")),
      };
    });
    const validationError = validarCargos(cargos);
    setError(validationError);
    if (validationError) return;

    setSubmitting(true);
    try {
      const updated = await update(operacion.id, { cargos });
      if (!updated) throw new Error("No se pudo actualizar la compra");
      onSaved(updated);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron guardar los cargos");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      title="Editar cargos"
      onClose={onClose}
      onSubmit={guardar}
      submitting={submitting}
      modalStyle={{ maxWidth: 780 }}
      modalError={error ? { titulo: "No se pudieron guardar los cargos", descripcion: error } : null}
    >
      <div style={{ display: "grid", gap: 16 }}>
        <p style={{ margin: 0 }}>Al guardar se actualizan el total y el saldo de la compra.</p>
        {canViewRecibidos && facturas.length > 0 && (
          <div>
            <Dropdown
              options={facturas.map((doc) => ({
                value: doc.id,
                label: `${comprobanteRecibidoTitulo(doc)} · ${doc.emisor.razonSocial}`,
              }))}
              value=""
              onChange={copiarPercepciones}
              disabled={submitting}
              ariaLabel="Copiar percepciones de una factura"
              placeholder="Copiar percepciones de una factura"
              style={{ width: "100%" }}
            />
            <small>Elegir una factura reemplaza la lista de cargos en este formulario.</small>
          </div>
        )}
        {canViewRecibidos && errorFacturas && <p role="status">No se pudieron consultar las facturas asociadas.</p>}
        <OperacionPercepcionesEditor
          contexto="compra"
          percepciones={percepciones}
          montoBase={montoBase}
          disabled={submitting}
          addPercepcion={() => {
            const linea = nuevaPercepcion();
            setPercepciones((current) => [...current, linea]);
            return linea.key;
          }}
          updatePercepcion={(key, patch) => {
            setPercepciones((current) => current.map((linea) => linea.key === key ? { ...linea, ...patch } : linea));
          }}
          removePercepcion={(key) => {
            setPercepciones((current) => current.filter((linea) => linea.key !== key));
          }}
        />
      </div>
    </Modal>
  );
}
