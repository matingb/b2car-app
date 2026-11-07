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
  /** Opciones que cambian el comprobante (detalle simplificado, observaciones, etc.); van en la columna lateral. */
  opciones?: ReactNode;
  /** La columna de opciones está plegada: queda un riel angosto y el visor toma el resto del ancho. */
  opcionesPlegadas?: boolean;
  /** Pantallas angostas: las opciones van arriba del visor en vez de al costado. */
  apilado?: boolean;
  /** La revisión se está recalculando con las opciones elegidas. */
  actualizando?: boolean;
};

const MIN_VIEWER_HEIGHT = 240;
/** Alto del visor en pantallas angostas: deja ver buena parte de la hoja sin ocupar toda la pantalla. */
const STACKED_VIEWER_HEIGHT = "min(70dvh, 560px)";
/** Ancho de la columna de opciones; el visor se queda con todo el resto. */
export const OPCIONES_COLUMN_WIDTH = 360;
export const OPCIONES_RAIL_WIDTH = 52;

/** Muestra el borrador con el mismo visor que el comprobante no fiscal, con las opciones en una columna lateral. */
export default function FacturaRevisionView({
  revision,
  html,
  opciones,
  opcionesPlegadas = false,
  apilado = false,
  actualizando = false,
}: Props) {
  const advertencias = revision.issues.filter((issue) => issue.severidad === "advertencia");
  const columns = !opciones || apilado
    ? "minmax(0, 1fr)"
    : `${opcionesPlegadas ? OPCIONES_RAIL_WIDTH : OPCIONES_COLUMN_WIDTH}px minmax(0, 1fr)`;

  return (
    <div style={{ ...styles.container, ...(apilado ? styles.naturalHeight : {}) }}>
      {advertencias.length ? (
        <div style={styles.warning} role="note">
          <CircleAlert size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>{advertencias.map((issue) => issue.mensaje).join(" ")}</span>
        </div>
      ) : null}
      <div
        style={{
          ...styles.layout,
          ...(apilado ? styles.layoutApilado : {}),
          gridTemplateColumns: columns,
        }}
        data-testid="factura-revision-layout"
      >
        {opciones ? <div style={apilado ? styles.opcionesApiladas : styles.opcionesColumn}>{opciones}</div> : null}
        <div style={styles.viewerColumn}>
          <div
            style={{ ...styles.viewerWrapper, ...(apilado ? styles.viewerWrapperApilado : {}) }}
            aria-busy={actualizando}
            data-testid="factura-revision-visor"
          >
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
      </div>
    </div>
  );
}

const styles = {
  container: { display: "flex", flexDirection: "column" as const, gap: 12, minWidth: 0, flex: "1 1 auto" },
  // Las dos columnas llenan el alto que deja el modal; el único scroll largo es el del documento.
  layout: {
    display: "grid",
    gap: 16,
    flex: "1 1 0px",
    minHeight: MIN_VIEWER_HEIGHT,
    gridTemplateRows: "minmax(0, 1fr)",
    transition: "grid-template-columns 0.2s ease",
  },
  // Apilado (mobile): cada bloque ocupa su alto natural y scrollea el modal entero. Achicar la grilla
  // al alto disponible hacía que las opciones desbordaran encima del aviso y del pie.
  naturalHeight: { flex: "0 0 auto" },
  layoutApilado: { flex: "0 0 auto", minHeight: "auto", gridTemplateRows: "auto auto" },
  // El visor no tiene alto propio (el documento va posicionado adentro), así que apilado lleva uno fijo.
  viewerWrapperApilado: { flex: "0 0 auto", height: STACKED_VIEWER_HEIGHT },
  // La columna sólo recorta: el panel de opciones tiene su propio scroll y, al abrirse, se descubre sin reacomodarse.
  opcionesColumn: { display: "flex", flexDirection: "column" as const, minWidth: 0, minHeight: 0, overflow: "hidden" as const },
  opcionesApiladas: { display: "flex", flexDirection: "column" as const, minWidth: 0 },
  viewerColumn: { display: "flex", flexDirection: "column" as const, gap: 12, minWidth: 0, minHeight: 0 },
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
