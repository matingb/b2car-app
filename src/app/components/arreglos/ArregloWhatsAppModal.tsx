"use client";

import React, { useMemo } from "react";
import { Check, Copy, RotateCcw, SlidersHorizontal, User } from "lucide-react";
import Modal from "@/app/components/ui/Modal";
import Checkbox from "@/app/components/ui/Checkbox";
import {
  useArregloWhatsAppModal,
  type WhatsAppContentConfig,
} from "./hooks/useArregloWhatsAppModal";
import { styles } from "./ArregloWhatsAppModal.styles";
import type { ArregloDetalleData } from "@/app/api/arreglos/[id]/route";
import { COLOR } from "@/theme/theme";

type Props = {
  open: boolean;
  onClose: () => void;
  data: ArregloDetalleData | null;
  initialPhone?: string | null;
  clienteNombre?: string | null;
};

interface CheckboxDefinition {
  key: keyof WhatsAppContentConfig;
  label: string;
  disabled?: (config: WhatsAppContentConfig) => boolean;
}

export default function ArregloWhatsAppModal({
  open,
  onClose,
  data,
  initialPhone,
  clienteNombre: initialClienteNombre,
}: Props) {
  const {
    config,
    updateConfig,
    mensaje,
    handleCustomTextChange,
    isCustomized,
    handleReset,
    copied,
    handleCopy,
    phone,
    setPhone,
    clienteNombre,
    loadingCliente,
    handleSubmit,
  } = useArregloWhatsAppModal({
    open,
    onClose,
    data,
    initialPhone,
    clienteNombre: initialClienteNombre,
  });

  const checkboxItems = useMemo<CheckboxDefinition[]>(() => {
    const items: CheckboxDefinition[] = [
      { key: "mostrarDetalleItems", label: "Detalle de repuestos y servicios" },
      {
        key: "mostrarPreciosItems",
        label: "Precios individuales por ítem",
        disabled: (c) => !c.mostrarDetalleItems,
      },
      { key: "mostrarSubtotales", label: "Subtotales por rubro" },
      { key: "mostrarTotal", label: "Total general" },
    ];

    if (data?.arreglo?.kilometraje_leido) {
      items.push({ key: "incluirKm", label: "Kilometraje actual" });
    }
    if (data?.arreglo?.observaciones) {
      items.push({ key: "incluirObservaciones", label: "Observaciones generales" });
    }

    return items;
  }, [data?.arreglo?.kilometraje_leido, data?.arreglo?.observaciones]);

  return (
    <Modal
      open={open}
      title="Compartir por WhatsApp"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitText="Enviar WhatsApp"
      modalStyle={{ maxWidth: 660 }}
    >
      <div style={styles.container}>
        {/* Destinatario y Teléfono */}
        <div style={styles.recipientCard}>
          <div style={styles.recipientHeader}>
            <User size={16} color={COLOR.TEXT.SECONDARY} />
            <span style={styles.recipientTitle}>
              {loadingCliente
                ? "Cargando contacto..."
                : clienteNombre
                ? `Contacto: ${clienteNombre}`
                : "Contacto"}
            </span>
          </div>
          <div style={styles.phoneInputRow}>
            <label htmlFor="whatsapp-phone-input" style={styles.phoneLabel}>
              Teléfono WhatsApp:
            </label>
            <input
              id="whatsapp-phone-input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej: 5491112345678"
              style={styles.phoneInput}
            />
          </div>
        </div>

        {/* Panel de Checkboxes: Opciones de visualización */}
        <div style={styles.checkboxCard}>
          <div style={styles.checkboxCardHeader}>
            <SlidersHorizontal size={15} color={COLOR.TEXT.SECONDARY} />
            <span style={styles.checkboxCardTitle}>Configuración del contenido:</span>
          </div>

          <div style={styles.checkboxGrid}>
            {checkboxItems.map(({ key, label, disabled }) => (
              <Checkbox
                key={key}
                label={label}
                checked={config[key]}
                disabled={disabled?.(config)}
                onChange={(checked) => updateConfig(key, checked)}
              />
            ))}
          </div>
        </div>

        {/* Previsualización y Edición */}
        <div style={styles.previewContainer}>
          <div style={styles.previewHeader}>
            <div style={styles.previewTitleRow}>
              <span style={styles.previewLabel}>Vista previa del mensaje:</span>
              {isCustomized && (
                <span style={styles.editedBadge}>Editado manualmente</span>
              )}
            </div>

            <div style={styles.previewActions}>
              {isCustomized && (
                <button
                  type="button"
                  onClick={handleReset}
                  style={styles.actionButton}
                  title="Restablecer mensaje original según toggles"
                >
                  <RotateCcw size={14} />
                  <span>Restablecer</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  ...styles.actionButton,
                  ...(copied ? styles.copiedButton : {}),
                }}
                title="Copiar texto al portapapeles"
              >
                {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                <span>{copied ? "¡Copiado!" : "Copiar"}</span>
              </button>
            </div>
          </div>

          <textarea
            value={mensaje}
            onChange={(e) => handleCustomTextChange(e.target.value)}
            rows={10}
            style={styles.textarea}
            placeholder="El mensaje de WhatsApp aparecerá aquí..."
          />
          <p style={styles.textareaHint}>
            Podés editar el texto libremente antes de enviarlo por WhatsApp.
          </p>
        </div>
      </div>
    </Modal>
  );
}
