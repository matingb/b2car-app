"use client";

import { useEffect, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import Button from "@/app/components/ui/Button";
import { comprobantesRecibidosClient } from "@/clients/comprobantesRecibidosClient";
import type {
  ComprobanteRecibido,
  ComprobanteRecibidoInput,
  ComprobanteRecibidoTipo,
  ComprobantesOperacion,
} from "@/lib/comprobantesRecibidos/types";
import { COLOR } from "@/theme/theme";
import ComprobanteRecibidoModal, { type ComprobanteRecibidoModalProps } from "./ComprobanteRecibidoModal";

type Props = {
  open: boolean;
  operacionId: string;
  initialTipo?: ComprobanteRecibidoTipo;
  onClose: () => void;
  onSaved?: (comprobante: ComprobanteRecibido) => void;
  /** Documento ya cargado (p. ej., en el alta de la operación) que no se pudo guardar. */
  initialInput?: ComprobanteRecibidoInput;
  initialConceptos?: ComprobanteRecibidoModalProps["initialConceptos"];
  /** Clave del intento anterior: reintentar no duplica el documento si ya se había guardado. */
  idempotencyKey?: string;
  initialError?: string;
};

/**
 * Alta de una factura o retención para una operación ya persistida (detalle de la operación o
 * reintento de la factura cargada junto con la operación). Si el documento falla, la operación se
 * conserva y el formulario queda abierto para reintentar con la misma clave, sin repetir pagos ni stock.
 */
export default function ComprobanteRecibidoOperacionModal({
  open,
  operacionId,
  initialTipo = "FACTURA",
  onClose,
  onSaved,
  initialInput,
  initialConceptos,
  idempotencyKey,
  initialError,
}: Props) {
  const [datos, setDatos] = useState<ComprobantesOperacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const requierePrecarga = !initialInput;

  useEffect(() => {
    if (!open || !requierePrecarga) return;
    let cancelled = false;
    setError(null);
    comprobantesRecibidosClient
      .listByOperacion(operacionId)
      .then((result) => { if (!cancelled) setDatos(result); })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "No se pudieron cargar los datos de la operación");
      });
    return () => { cancelled = true; };
  }, [open, operacionId, intento, requierePrecarga]);

  if (!open) return null;

  const precarga = initialInput ?? datos?.precarga;
  if (!precarga) {
    return (
      <Modal open={open} title="Cargar documento recibido" onClose={onClose} hideFooter showCloseButton wrapInForm={false}>
        <div style={styles.body}>
          {error ? (
            <>
              <p role="alert" style={styles.error}>{error}</p>
              <p style={styles.hint}>La operación ya quedó registrada. Podés reintentar o cargar el documento más tarde desde su detalle.</p>
              <div style={styles.actions}>
                <Button text="Reintentar" onClick={() => setIntento((value) => value + 1)} hideTextOnMobile={false} />
                <Button text="Cerrar" outline onClick={onClose} hideTextOnMobile={false} />
              </div>
            </>
          ) : (
            <p role="status" style={styles.hint}>Cargando datos de la operación…</p>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <ComprobanteRecibidoModal
      open={open}
      onClose={onClose}
      onSaved={onSaved}
      operacionId={operacionId}
      precarga={precarga}
      initialTipo={initialInput?.tipoDocumento ?? initialTipo}
      initialInput={initialInput}
      initialConceptos={initialConceptos}
      idempotencyKey={idempotencyKey}
      initialError={initialError}
    />
  );
}

const styles = {
  body: { display: "flex", flexDirection: "column" as const, gap: 10, padding: "8px 0 16px" },
  hint: { margin: 0, fontSize: 13, color: COLOR.TEXT.SECONDARY },
  error: { margin: 0, fontSize: 13, color: COLOR.STATUS.DANGER.TEXT },
  actions: { display: "flex", gap: 8 },
} as const;
