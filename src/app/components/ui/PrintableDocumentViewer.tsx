"use client";

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { COLOR } from "@/theme/theme";
import { useGestureZoom } from "@/app/hooks/useGestureZoom";

export interface PrintableDocumentViewerProps {
  htmlContent: string;
  title?: string;
  style?: React.CSSProperties;
}

const BASE_WIDTH = 794;
const MIN_A4_HEIGHT = 1123;

const PrintableDocumentViewer = forwardRef<
  HTMLIFrameElement,
  PrintableDocumentViewerProps
>(function PrintableDocumentViewer(
  { htmlContent, title = "Vista previa de documento", style },
  forwardedRef
) {
  const internalIframeRef = useRef<HTMLIFrameElement | null>(null);
  useImperativeHandle(forwardedRef, () => internalIframeRef.current as HTMLIFrameElement);

  const { zoom, showBadge, containerRef, resetZoom } = useGestureZoom({
    initialZoom: 1,
    minZoom: 0.4,
    maxZoom: 2.5,
  });

  const [docHeight, setDocHeight] = useState(MIN_A4_HEIGHT);

  // Ajusta automáticamente el alto del iframe al alto real del documento para que nunca se corte
  const handleIframeLoad = useCallback(() => {
    const iframe = internalIframeRef.current;
    if (!iframe?.contentDocument) return;
    const scrollH = Math.max(
      iframe.contentDocument.documentElement?.scrollHeight || 0,
      iframe.contentDocument.body?.scrollHeight || 0,
      MIN_A4_HEIGHT
    );
    setDocHeight(scrollH);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        ...styles.container,
        ...style,
      }}
      data-testid="printable-document-viewer"
      data-zoom={zoom}
    >
      <div
        style={{
          ...styles.scalerOuter,
          width: `${BASE_WIDTH * zoom}px`,
          height: `${docHeight * zoom}px`,
        }}
      >
        <div
          style={{
            ...styles.scalerInner,
            width: `${BASE_WIDTH}px`,
            height: `${docHeight}px`,
            transform: `scale(${zoom})`,
          }}
        >
          <iframe
            ref={internalIframeRef}
            srcDoc={htmlContent}
            title={title}
            onLoad={handleIframeLoad}
            style={{
              ...styles.iframe,
              width: `${BASE_WIDTH}px`,
              height: `${docHeight}px`,
            }}
          />
        </div>
      </div>

      {/* Indicador flotante sutil de zoom */}
      <div
        onClick={() => resetZoom(1)}
        style={{
          ...styles.zoomBadge,
          opacity: showBadge ? 1 : 0,
          pointerEvents: showBadge ? "auto" : "none",
        }}
        title="Tocar para restablecer tamaño (100%)"
        data-testid="zoom-level-badge"
      >
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
});

export default PrintableDocumentViewer;

const styles = {
  container: {
    position: "relative" as const,
    flex: 1,
    minHeight: 0,
    height: "100%",
    overflow: "auto" as const,
    WebkitOverflowScrolling: "touch" as const,
    background: COLOR.BACKGROUND.SUBTLE,
    borderRadius: 8,
    padding: "20px 16px",
  },
  scalerOuter: {
    margin: "0 auto",
    position: "relative" as const,
    transition: "width 0.05s ease, height 0.05s ease",
  },
  scalerInner: {
    transformOrigin: "top left",
  },
  iframe: {
    border: "none",
    borderRadius: 4,
    boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
    background: "#ffffff",
    display: "block",
    pointerEvents: "none" as const, // Evita que el iframe intercepte los gestos del trackpad y toques
  },
  zoomBadge: {
    position: "sticky" as const,
    bottom: 12,
    marginLeft: "auto",
    marginRight: "auto",
    width: "fit-content",
    padding: "4px 10px",
    borderRadius: 16,
    background: "rgba(17, 24, 39, 0.75)",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 600,
    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
    cursor: "pointer",
    transition: "opacity 0.2s ease",
    zIndex: 10,
  },
};
