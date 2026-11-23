"use client";

import { useRef, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import { useToast } from "@/app/providers/ToastProvider";
import { comprobantesRecibidosClient } from "@/clients/comprobantesRecibidosClient";
import { formatCalendarDateLabel } from "@/lib/fechas";
import { comprobanteRecibidoTitulo, type FacturaCompraConVencimiento } from "@/lib/comprobantesRecibidos/types";

type Props = {
  factura: FacturaCompraConVencimiento;
  onClose: () => void;
};

export default function VencimientoFacturaCompraModal({ factura, onClose }: Props) {
  const { success } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const fecha = formatCalendarDateLabel(factura.fechaVencimiento);

  const agregarVencimiento = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await comprobantesRecibidosClient.crearTurnoVencimiento(factura.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Intentá nuevamente.");
      return;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
    success("Vencimiento agregado", `Quedó agendado para el ${fecha}.`);
    onClose();
  };

  return (
    <Modal
      open
      title="Vencimiento de factura"
      onClose={onClose}
      onSubmit={agregarVencimiento}
      submitText="Agregar al calendario"
      submittingText="Agregando…"
      submitting={submitting}
      showCloseButton
      modalError={error ? { titulo: "Error al agendar el vencimiento", descripcion: error } : null}
    >
      <p>{comprobanteRecibidoTitulo(factura)} quedó guardada y vence el {fecha}. ¿Querés agendar el vencimiento de pago?</p>
    </Modal>
  );
}
