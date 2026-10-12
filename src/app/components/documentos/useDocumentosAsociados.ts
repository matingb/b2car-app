"use client";

import { useEffect, useState } from "react";
import { documentosClient } from "@/clients/documentosClient";
import { logger } from "@/lib/logger";
import type { DocumentoListado, DocumentosOrigen } from "@/lib/documentos/types";

export type DocumentosAsociadosEstado = {
  documentos: DocumentoListado[];
  cargando: boolean;
};

/**
 * Carga los documentos asociados a un arreglo o una venta. Con `origen` nulo no consulta;
 * cada vez que vuelve a recibir un origen recarga para reflejar emisiones recientes.
 * Ante un error deja la lista vacía: la sección asociada simplemente no se muestra.
 */
export function useDocumentosAsociados(origen: DocumentosOrigen | null): DocumentosAsociadosEstado {
  const tipo = origen?.tipo;
  const id = origen?.id;
  const [documentos, setDocumentos] = useState<DocumentoListado[]>([]);
  const [cargando, setCargando] = useState(Boolean(tipo && id));

  useEffect(() => {
    if (!tipo || !id) return;
    let cancelled = false;
    setCargando(true);
    documentosClient
      .asociados({ tipo, id })
      .then((data) => {
        if (!cancelled) setDocumentos(data);
      })
      .catch((cause: unknown) => {
        logger.error("Error cargando los documentos asociados", cause);
        if (!cancelled) setDocumentos([]);
      })
      .finally(() => {
        if (!cancelled) setCargando(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tipo, id]);

  return { documentos, cargando };
}
