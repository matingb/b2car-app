"use client";

import { useEffect, useState } from "react";
import Modal from "@/app/components/ui/Modal";
import { finanzasClient } from "@/clients/finanzasClient";
import type { ObtenerGastoFinancieroResponse } from "@/model/finanzas";
import OperacionCreateModal from "./OperacionCreateModal";
import type { OperacionModalProps } from "./operacionModalTypes";

type Props = Pick<OperacionModalProps, "talleres" | "onClose"> & { gastoId: string };

export default function OperacionEditGastoModal({ gastoId, talleres, onClose }: Props) {
  const [result, setResult] = useState<ObtenerGastoFinancieroResponse | null>(null);

  useEffect(() => {
    let active = true;
    void finanzasClient.obtenerGasto(gastoId).then((response) => {
      if (active) setResult(response);
    });
    return () => { active = false; };
  }, [gastoId]);

  if (result?.data) {
    return (
      <OperacionCreateModal open initialTipo="GASTO" gasto={result.data} talleres={talleres} onClose={onClose} />
    );
  }

  return (
    <Modal open title="Editar gasto" onClose={onClose} showCloseButton hideFooter>
      {result ? (
        <p role="alert">{result.error ?? "No se pudo cargar el gasto"}</p>
      ) : (
        <p role="status">Cargando gasto…</p>
      )}
    </Modal>
  );
}
