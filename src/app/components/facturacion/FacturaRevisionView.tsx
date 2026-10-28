"use client";

import { CircleAlert } from "lucide-react";
import PdfDocumentViewer from "@/app/components/ui/PdfDocumentViewer";
import { COLOR } from "@/theme/theme";
import type { FacturaRevision } from "@/lib/facturacion/types";

export type FacturaRevisionPdf = {
  status: "loading" | "ready" | "error";
  url: string | null;
  error?: string | null;
};

type Props = {
  revision: FacturaRevision;
  pdf: FacturaRevisionPdf;
  onRetryPdf: () => void;
};

/** Vista previa del PDF borrador del documento a emitir, con los avisos no bloqueantes de la revisión. */
export default function FacturaRevisionView({ revision, pdf, onRetryPdf }: Props) {
  const advertencias = revision.issues.filter((issue) => issue.severidad === "advertencia");

  return (
    <div style={styles.container}>
      {advertencias.length ? (
        <div style={styles.warning} role="note">
          <CircleAlert size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>{advertencias.map((issue) => issue.mensaje).join(" ")}</span>
        </div>
      ) : null}
      <PdfDocumentViewer
        url={pdf.url}
        status={pdf.status}
        errorMessage={pdf.error}
        onRetry={onRetryPdf}
        retryLabel="Reintentar vista previa"
        openLabel="Abrir borrador"
        title="Vista previa del comprobante (borrador sin validez fiscal)"
        style={styles.viewer}
      />
    </div>
  );
}

const styles = {
  container: { display: "flex", flexDirection: "column" as const, gap: 12, minWidth: 0 },
  viewer: { minHeight: "min(70dvh, 760px)" },
  warning: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    background: COLOR.BACKGROUND.ALERT_TINT,
    border: `1px solid ${COLOR.SEMANTIC.ALERT}`,
    color: COLOR.SEMANTIC.WARNING,
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    lineHeight: 1.4,
  },
} as const;
