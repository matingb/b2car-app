import React, { useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { css } from "@emotion/react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { useArreglos } from "@/app/providers/ArreglosProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { Arreglo } from "@/model/types";
import CobroArregloModal from "@/app/components/arreglos/CobroArregloModal";
import { generateUuidV4 } from "@/lib/uuid";

type Props = {
  estaPago: boolean;
  arregloId?: string | number;
  onClick?: (e: React.MouseEvent) => void;
  onPagoUpdated?: (updatedArreglo: Arreglo) => void;
  size?: "sm" | "md";
  hideTextOnMobile?: boolean;
};

export default function ArregloPagoBadge({ estaPago, arregloId, onClick, onPagoUpdated, size = "md", hideTextOnMobile }: Props) {
  const { anularCobro } = useArreglos();
  const { success, error } = useToast();
  const { confirm } = useModalMessage();
  const [loading, setLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [cobroOpen, setCobroOpen] = useState(false);

  const isInteractive = Boolean(onClick || arregloId);
  const badgeSize = size === "sm" ? 14 : 16;
  const padding = size === "sm" ? "4px 10px" : "6px 10px";
  const fontSize = size === "sm" ? 12 : 13;

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (onClick) {
      onClick(e);
      return;
    }

    if (!arregloId || loading) return;

    if (!estaPago) {
      setCobroOpen(true);
      return;
    }

    const confirmed = await confirm({
      title: "Anular cobro",
      message: "Se generará un reverso del ingreso registrado. ¿Querés continuar?",
      acceptLabel: "Anular cobro",
      cancelLabel: "Cancelar",
    });
    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await anularCobro(
        arregloId,
        generateUuidV4(),
      );
      if (response) {
        onPagoUpdated?.(response);
        success("Estado de pago", "El estado se actualizó correctamente.");
      }
    } catch (err) {
      console.error(err);
      error("Error", "No se pudo actualizar el estado de pago.");
    } finally {
      setLoading(false);
    }
  };

  const textStyles = hideTextOnMobile ? css({
    display: "none",
    [`@media (min-width: ${BREAKPOINTS.sm}px)`]: {
      display: "inline",
    }
  }) : undefined;

  const content = loading ? (
    <>
      <Loader2 size={badgeSize} color={COLOR.TEXT.SECONDARY} className="animate-spin" />
      <span css={textStyles}>Actualizando...</span>
    </>
  ) : estaPago ? (
    <>
      <CheckCircle2 size={badgeSize} color={COLOR.SEMANTIC.SUCCESS} />
      <span css={textStyles}>Pagado</span>
    </>
  ) : (
    <>
      <XCircle size={badgeSize} color={COLOR.SEMANTIC.DANGER} />
      <span css={textStyles}>Pago pendiente</span>
    </>
  );

  const baseBg = "transparent";

  const activeColor = estaPago ? COLOR.SEMANTIC.SUCCESS : COLOR.SEMANTIC.DANGER;
  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: size === "sm" ? 6 : 8,
    whiteSpace: "nowrap",
    fontSize,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    backgroundColor: baseBg,
    padding,
    height: size === "sm" ? 26 : 32,
    borderRadius: 8,
    border: `1px solid ${isHovered && isInteractive && !loading ? activeColor : COLOR.BORDER.SUBTLE
      }`,
    filter: isHovered && isInteractive && !loading ? "brightness(0.97)" : "none",
    cursor: isInteractive && !loading ? "pointer" : "default",
    transition: "all 0.18s ease-in-out",
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInteractive && !loading) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInteractive) {
      setIsHovered(false);
    }
  };

  if (isInteractive) {
    return (
      <>
        <button
          onClick={handleToggle}
          type="button"
          disabled={loading}
          data-isolate-hover="true"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseOver={(e) => e.stopPropagation()}
          onMouseOut={(e) => e.stopPropagation()}
          title={estaPago ? "Marcar como pendiente" : "Marcar como pagado"}
          style={{
            ...style,
            color: COLOR.TEXT.PRIMARY,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {content}
        </button>
        {arregloId ? (
          <CobroArregloModal
            open={cobroOpen}
            arregloId={arregloId}
            onClose={() => setCobroOpen(false)}
            onPaid={(updated) => {
              onPagoUpdated?.(updated);
              success("Cobro registrado", "El ingreso se registró correctamente.");
            }}
          />
        ) : null}
      </>
    );
  }

  return <span style={style}>{content}</span>;
}
