"use client";

import DocumentosAsociadosList from "@/app/components/documentos/DocumentosAsociadosList";
import { useDocumentosAsociados } from "@/app/components/documentos/useDocumentosAsociados";
import { COLOR } from "@/theme/theme";

type Props = {
  arregloId: string;
};

/**
 * Sección "Documentos asociados" del detalle de un arreglo. Muestra sus títulos mientras carga
 * y se oculta si el arreglo no tiene documentos.
 */
export default function ArregloDocumentosAsociados({ arregloId }: Props) {
  const { documentos, cargando } = useDocumentosAsociados({ tipo: "ARREGLO", id: arregloId });

  if (!cargando && documentos.length === 0) return null;

  return (
    <section style={styles.section} aria-labelledby="arreglo-documentos-asociados">
      <div>
        <h3 id="arreglo-documentos-asociados" style={styles.title}>Documentos asociados</h3>
        <div style={styles.subtitle}>Facturas y remitos emitidos a partir de este arreglo</div>
      </div>
      <DocumentosAsociadosList documentos={documentos} cargando={cargando} />
    </section>
  );
}

const styles = {
  section: { marginTop: 16, display: "flex", flexDirection: "column" as const, gap: 12 },
  title: { fontSize: 20, fontWeight: 600, margin: 0 },
  subtitle: { color: COLOR.TEXT.SECONDARY, marginTop: 2 },
} as const;
