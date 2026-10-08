"use client";

import { useState } from "react";
import Modal from "@/app/components/ui/Modal";
import RemitoForm from "@/app/components/remitos/RemitoForm";

type Props = {
  open: boolean;
  facturaId?: string | null;
  arregloId?: string | null;
  onClose: () => void;
  onEmitted: (remitoId: string) => void;
};

/** Modal de emisión con el mismo formato amplio del formulario de creación de arreglos. */
export default function RemitoCreateModal({ open, facturaId = null, arregloId = null, onClose, onEmitted }: Props) {
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Crear remito"
      onClose={handleClose}
      submitting={submitting}
      hideFooter
      showCloseButton
      wrapInForm={false}
      modalStyle={{
        width: "min(1100px, 92vw)",
        maxHeight: "90dvh",
        overflow: "auto",
      }}
    >
      <RemitoForm
        facturaId={facturaId}
        arregloId={arregloId}
        onEmitted={onEmitted}
        onCancel={handleClose}
        onSubmittingChange={setSubmitting}
      />
    </Modal>
  );
}
