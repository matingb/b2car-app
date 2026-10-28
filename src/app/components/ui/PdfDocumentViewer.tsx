"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import { COLOR } from "@/theme/theme";

export interface PdfDocumentViewerProps {
  /** URL temporal (`blob:`) del PDF; quien la crea es responsable de revocarla. */
  url: string | null;
  title: string;
  status: "loading" | "ready" | "error";
  errorMessage?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
  openLabel?: string;
  style?: React.CSSProperties;
}

/**
 * Muestra un PDF con el visor nativo del navegador. Si el navegador no lo
 * incrusta (por ejemplo, en algunos móviles), ofrece abrirlo aparte.
 */
export default function PdfDocumentViewer({
  url,
  title,
  status,
  errorMessage,
  onRetry,
  retryLabel = "Reintentar",
  openLabel = "Abrir PDF",
  style,
}: PdfDocumentViewerProps) {
  return (
    <div style={{ ...styles.container, ...style }} data-testid="pdf-document-viewer" aria-busy={status === "loading"}>
      {status === "loading" ? (
        <div style={styles.placeholder} role="status">Generando vista previa…</div>
      ) : null}
      {status === "error" ? (
        <div style={styles.placeholder} role="alert">
          <span>{errorMessage || "No se pudo generar la vista previa."}</span>
          {onRetry ? (
            <button type="button" style={styles.linkButton} onClick={onRetry}>{retryLabel}</button>
          ) : null}
        </div>
      ) : null}
      {status === "ready" && url ? (
        <>
          <object data={url} type="application/pdf" title={title} aria-label={title} style={styles.frame}>
            <div style={styles.placeholder}>
              <span>Este navegador no puede mostrar el PDF dentro de la página.</span>
              <a href={url} target="_blank" rel="noopener noreferrer" style={styles.link}>{openLabel}</a>
            </div>
          </object>
          <a href={url} target="_blank" rel="noopener noreferrer" style={styles.openLink} data-testid="pdf-document-viewer-open">
            <ExternalLink size={14} aria-hidden="true" />
            {openLabel}
          </a>
        </>
      ) : null}
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    minHeight: 0,
    background: COLOR.BACKGROUND.SUBTLE,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: 12,
  },
  frame: {
    width: "100%",
    flex: 1,
    minHeight: 480,
    border: "none",
    borderRadius: 4,
    background: COLOR.BACKGROUND.PRIMARY,
  },
  placeholder: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 240,
    padding: 16,
    textAlign: "center" as const,
    color: COLOR.TEXT.SECONDARY,
    fontSize: 13,
    lineHeight: 1.4,
  },
  linkButton: {
    border: 0,
    padding: 0,
    background: "transparent",
    color: COLOR.ACCENT.PRIMARY,
    cursor: "pointer",
    font: "inherit",
    fontWeight: 600,
    textDecoration: "underline",
  },
  link: { color: COLOR.ACCENT.PRIMARY, fontWeight: 600 },
  openLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    color: COLOR.ACCENT.PRIMARY,
    fontSize: 13,
    fontWeight: 600,
  },
} as const;
