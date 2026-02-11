"use client";

import { useCallback } from "react";
import { useToast } from "@/app/providers/ToastProvider";
import { buildWhatsappLink, normalizeWhatsappPhone } from "@/lib/whatsapp";

const ERRORS = {
  message_empty: "No se pudo generar el mensaje",
  phone_missing: "El cliente no tiene teléfono cargado",
  phone_invalid: "El teléfono del cliente no es válido",
  open_failed: "No se pudo abrir WhatsApp",
} as const;

export function useWhatsAppMessage() {
  const toast = useToast();

  const share = useCallback(
    async (message: string, phone: string | null | undefined): Promise<void> => {
      const normalizedMessage = String(message ?? "").trim();
      if (!normalizedMessage) {
        toast.error("Error", ERRORS.message_empty);
        return;
      }

      if (!phone) {
        toast.error("Error", ERRORS.phone_missing);
        return;
      }

      const cleanPhone = normalizeWhatsappPhone(phone);
      if (!cleanPhone) {
        toast.error("Error", ERRORS.phone_invalid);
        return;
      }

      const url = buildWhatsappLink(cleanPhone, normalizedMessage);
      try {
        const opened = window.open(url, "_blank");
        if (!opened) {
          toast.error("Error", ERRORS.open_failed);
          return;
        }
      } catch {
        toast.error("Error", ERRORS.open_failed);
        return;
      }
    },
    [toast]
  );

  return { share };
}

