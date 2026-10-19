"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  DollarSign,
  Download,
  FileText,
  Loader2,
  Printer,
  X,
} from "lucide-react";
import Modal from "@/app/components/ui/Modal";
import Toggle from "@/app/components/ui/Toggle";
import Button from "@/app/components/ui/Button";
import PrintableDocumentViewer from "@/app/components/ui/PrintableDocumentViewer";
import {
  buildArregloPrintableInvoiceHtml,
  formatInvoiceNumber,
} from "@/lib/arregloPrintableInvoice";
import type { ArregloDetalleData } from "@/app/api/arreglos/[id]/route";
import type { Cliente } from "@/model/types";
import { vehiculoClient } from "@/clients/vehiculoClient";
import { useToast } from "@/app/providers/ToastProvider";
import { COLOR } from "@/theme/theme";

type Props = {
  open: boolean;
  onClose: () => void;
  data: ArregloDetalleData | null;
  cliente?: Cliente | null;
};

export default function ArregloPrintableInvoiceModal({
  open,
  onClose,
  data,
  cliente: initialCliente,
}: Props) {
  const [showPrices, setShowPrices] = useState(true);
  const [showObservations, setShowObservations] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [cliente, setCliente] = useState<Cliente | null>(initialCliente ?? null);

  const { error, success } = useToast();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const hasObservations = Boolean(data?.arreglo?.observaciones?.trim());

  useEffect(() => {
    if (!open) return;
    if (initialCliente) {
      setCliente(initialCliente);
      return;
    }
    const vehiculoId = data?.arreglo?.vehiculo?.id;
    if (vehiculoId) {
      let isMounted = true;
      vehiculoClient
        .getClienteForVehiculo(vehiculoId)
        .then((res) => {
          const clienteData = res.data;
          if (isMounted && clienteData) {
            setCliente((prev) => {
              if (prev?.nombre === clienteData.nombre) return prev;
              return clienteData;
            });
          }
        })
        .catch(() => {});

      return () => {
        isMounted = false;
      };
    }
  }, [open, data?.arreglo?.vehiculo?.id, initialCliente]);

  const tenantName = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return localStorage.getItem("tenant_name") || undefined;
  }, []);

  const invoiceNumber = useMemo(() => {
    return formatInvoiceNumber(data?.arreglo);
  }, [data?.arreglo]);

  const htmlContent = useMemo(() => {
    if (!data?.arreglo) return "";
    return buildArregloPrintableInvoiceHtml({
      data,
      tenantName,
      cliente,
      showPrices,
      showObservations,
    });
  }, [data, tenantName, cliente, showPrices, showObservations]);

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) {
      error("Error", "No se pudo iniciar la impresión");
      return;
    }
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  };

  const handleDownloadPdf = async () => {
    if (!data?.arreglo) return;
    try {
      setIsDownloading(true);
      const filename = `orden-de-trabajo-${invoiceNumber || "comprobante"}.pdf`;

      const iframe = iframeRef.current;
      const iframeDoc = iframe?.contentDocument || iframe?.contentWindow?.document;
      const targetElement = (iframeDoc?.querySelector(".page") || iframeDoc?.body || iframe) as HTMLElement | null;

      if (!targetElement) {
        throw new Error("No se pudo acceder al documento");
      }

      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(targetElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 794,
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      const totalPdfHeight = (canvas.height * pageWidth) / canvas.width;
      let heightLeft = totalPdfHeight;
      let position = 0;

      pdf.addImage(imgData, "JPEG", 0, position, pageWidth, totalPdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, pageWidth, totalPdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(filename);

      success("Descarga completada", `Se generó ${filename}`);
    } catch (err) {
      console.error("Error al generar PDF:", err);
      const msg = err instanceof Error ? err.message : "No se pudo generar el archivo PDF";
      error("Error", msg);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!open || !data?.arreglo) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      hideHeader
      hideFooter
      wrapInForm={false}
      modalStyle={styles.modal}
    >
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <h2 style={styles.title}>Comprobante de orden de trabajo</h2>
            {invoiceNumber && (
              <span style={styles.badge}>N° {invoiceNumber}</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={styles.closeBtn}
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar with Options and Action Buttons */}
        <div style={styles.toolbar}>
          <div style={styles.togglesGroup}>
            {/* Toggle Precios */}
            <label style={styles.toggleItem}>
              <div style={styles.toggleIconPill}>
                <DollarSign size={15} color={showPrices ? COLOR.ACCENT.PRIMARY : COLOR.TEXT.SECONDARY} />
              </div>
              <span style={styles.toggleLabel}>Mostrar precios</span>
              <Toggle
                checked={showPrices}
                onChange={setShowPrices}
                label="Mostrar precios"
                data-testid="toggle-show-prices"
              />
            </label>

            {hasObservations && (
              <label style={styles.toggleItem}>
                <div style={styles.toggleIconPill}>
                  <FileText size={15} color={showObservations ? COLOR.ACCENT.PRIMARY : COLOR.TEXT.SECONDARY} />
                </div>
                <span style={styles.toggleLabel}>Mostrar observaciones</span>
                <Toggle
                  checked={showObservations}
                  onChange={setShowObservations}
                  label="Mostrar observaciones"
                  data-testid="toggle-show-observations"
                />
              </label>
            )}
          </div>

          <div style={styles.actionsGroup}>
            <Button
              type="button"
              outline
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              icon={
                isDownloading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Download size={16} />
                )
              }
              text={isDownloading ? "Generando..." : "Descargar PDF"}
              hideTextOnMobile={false}
              style={styles.actionBtn}
              dataTestId="btn-download-pdf"
            />
            <Button
              type="button"
              onClick={handlePrint}
              disabled={isDownloading}
              icon={<Printer size={16} />}
              text="Imprimir"
              hideTextOnMobile={false}
              style={styles.actionBtn}
              dataTestId="btn-print-invoice"
            />
          </div>
        </div>

        <PrintableDocumentViewer
          ref={iframeRef}
          htmlContent={htmlContent}
          title="Vista previa de comprobante"
        />
      </div>
    </Modal>
  );
}

const styles = {
  modal: {
    width: "min(960px, 96vw)",
    height: "92dvh",
    maxHeight: "94dvh",
    padding: "16px 20px 20px",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    background: COLOR.BACKGROUND.PRIMARY,
    borderRadius: 12,
  },
  container: {
    display: "flex",
    flexDirection: "column" as const,
    height: "100%",
    minHeight: 0,
    gap: 12,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    paddingBottom: 12,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap" as const,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
    color: COLOR.TEXT.PRIMARY,
  },
  badge: {
    fontSize: 12,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 6,
    background: COLOR.BACKGROUND.SUBTLE,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    color: COLOR.TEXT.SECONDARY,
    letterSpacing: "0.5px",
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 6,
    borderRadius: 6,
    color: COLOR.TEXT.SECONDARY,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap" as const,
    padding: "10px 14px",
    background: COLOR.BACKGROUND.SUBTLE,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  togglesGroup: {
    display: "flex",
    alignItems: "center",
    gap: 20,
    flexWrap: "wrap" as const,
  },
  toggleItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    userSelect: "none" as const,
  },
  toggleIconPill: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    background: COLOR.BACKGROUND.PRIMARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    display: "grid",
    placeItems: "center",
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
  },
  actionsGroup: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap" as const,
  },
  actionBtn: {
    minWidth: 130,
    fontSize: 14,
    padding: "8px 14px",
  },

};
