"use client";

import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import PrintableDocumentViewer from "@/app/components/ui/PrintableDocumentViewer";
import { COLOR } from "@/theme/theme";
import type { FacturaRevision } from "@/lib/facturacion/types";

type Props = {
  revision: FacturaRevision;
  /** HTML del borrador: el mismo layout del PDF fiscal, generado en el servidor sin armar el PDF. */
  html: string;
  /** Opciones que cambian el comprobante (por ejemplo, el detalle simplificado). */
  toolbar?: ReactNode;
  /** La revisión se está recalculando con las opciones elegidas. */
  actualizando?: boolean;
};

const MIN_VIEWER_HEIGHT = 240;

/** Muestra el borrador con el mismo visor que el comprobante no fiscal. */
export default function FacturaRevisionView({ revision, html, toolbar, actualizando = false }: Props) {
  const advertencias = revision.issues.filter((issue) => issue.severidad === "advertencia");

  return (
    <div style={styles.container}>
      {advertencias.length ? (
        <div style={styles.warning} role="note">
          <CircleAlert size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>{advertencias.map((issue) => issue.mensaje).join(" ")}</span>
        </div>
      ) : null}
      {toolbar}
      <div style={styles.draftBanner} role="note">
        BORRADOR — SIN VALIDEZ FISCAL — NO EMITIDO
      </div>
      <div style={styles.viewerWrapper} aria-busy={actualizando}>
        <PrintableDocumentViewer
          htmlContent={html}
          title="Vista previa del comprobante (borrador sin validez fiscal)"
          style={{ ...styles.viewer, ...(actualizando ? styles.viewerUpdating : {}) }}
        />
        {actualizando ? (
          <div style={styles.updating} role="status">Actualizando vista previa…</div>
        ) : null}
      </div>
    </div>
  );
}

const styles = {
  container: { display: "flex", flexDirection: "column" as const, gap: 12, minWidth: 0, flex: "1 1 auto" },
  draftBanner: {
    padding: "8px 12px",
    border: `1px solid ${COLOR.SEMANTIC.ALERT}`,
    borderRadius: 8,
    background: COLOR.BACKGROUND.ALERT_TINT,
    color: COLOR.SEMANTIC.WARNING,
    textAlign: "center" as const,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.04em",
  },
  // El visor llena el alto que dejan los demás bloques; con poco alto disponible no baja de MIN_VIEWER_HEIGHT.
  viewerWrapper: { position: "relative" as const, flex: "1 1 0px", minHeight: MIN_VIEWER_HEIGHT },
  viewer: { position: "absolute" as const, inset: 0, height: "auto", transition: "opacity 0.15s ease" },
  viewerUpdating: { opacity: 0.55 },
  updating: {
    position: "absolute" as const,
    top: 12,
    left: "50%",
    transform: "translateX(-50%)",
    padding: "6px 12px",
    borderRadius: 16,
    background: COLOR.BACKGROUND.PRIMARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 12,
    fontWeight: 600,
  },
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
