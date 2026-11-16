"use client";

import { useEffect, useState } from "react";
import DocumentosAsociadosList from "@/app/components/documentos/DocumentosAsociadosList";
import { comprobantesRecibidosClient } from "@/clients/comprobantesRecibidosClient";
import type { ComprobanteRecibido, ComprobanteRecibidoResumen } from "@/lib/comprobantesRecibidos/types";
import type { DocumentoListado } from "@/lib/documentos/types";
import { logger } from "@/lib/logger";
import { COLOR } from "@/theme/theme";

type Props = {
  operacionId: string;
  /** Cambia cuando se adjunta un documento desde la cabecera: fuerza la recarga. */
  refreshKey?: number;
};

export function comprobanteRecibidoResumen(comprobante: ComprobanteRecibido): ComprobanteRecibidoResumen {
  return {
    id: comprobante.id,
    operacionId: comprobante.operacionId,
    operacionTipo: comprobante.operacionTipo,
    tipoDocumento: comprobante.tipoDocumento,
    clase: comprobante.clase,
    numero: comprobante.numero,
    fecha: comprobante.fecha,
    emisorRazonSocial: comprobante.emisor.razonSocial ?? "",
    emisorCuit: comprobante.emisor.cuit,
    total: comprobante.total,
    createdAt: comprobante.createdAt,
  };
}

/**
 * Sección "Documentos asociados" del detalle de una compra o un gasto: facturas y retenciones
 * recibidas del proveedor. Cada ítem abre el detalle del documento. Se oculta si no hay documentos.
 */
export default function OperacionDocumentosAsociados({ operacionId, refreshKey = 0 }: Props) {
  const [documentos, setDocumentos] = useState<DocumentoListado[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setCargando(true);
    comprobantesRecibidosClient
      .listByOperacion(operacionId)
      .then((datos) => {
        if (cancelled) return;
        setDocumentos(datos.comprobantes.map((comprobante) => ({
          tipo: "RECIBIDO" as const,
          id: comprobante.id,
          fecha: comprobante.fecha,
          comprobante: comprobanteRecibidoResumen(comprobante),
        })));
      })
      .catch((cause: unknown) => {
        logger.error("Error cargando los documentos recibidos de la operación", cause);
        if (!cancelled) setDocumentos([]);
      })
      .finally(() => {
        if (!cancelled) setCargando(false);
      });
    return () => {
      cancelled = true;
    };
  }, [operacionId, refreshKey]);

  if (!cargando && documentos.length === 0) return null;

  return (
    <section style={styles.section} aria-labelledby="operacion-documentos-asociados" data-testid="operacion-documentos-asociados">
      <div>
        <h3 id="operacion-documentos-asociados" style={styles.title}>Documentos asociados</h3>
        <div style={styles.subtitle}>Facturas y retenciones recibidas del proveedor</div>
      </div>
      <DocumentosAsociadosList documentos={documentos} cargando={cargando} />
    </section>
  );
}

const styles = {
  section: { display: "flex", flexDirection: "column" as const, gap: 12 },
  title: { fontSize: 20, fontWeight: 600, margin: 0 },
  subtitle: { color: COLOR.TEXT.SECONDARY, marginTop: 2 },
} as const;
