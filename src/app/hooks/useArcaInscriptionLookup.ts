"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isValidCuitCuil, normalizeDocumentNumber } from "@/lib/facturacion/arcaPayload";
import type {
  ArcaInscriptionLookupResult,
  ArcaInscriptionVatCondition,
} from "@/lib/arcaInscripcion/types";

export type ArcaInscriptionLookupState =
  | { status: "IDLE" }
  | { status: "LOADING" }
  | { status: "FOUND"; condition: ArcaInscriptionVatCondition }
  | { status: "UNDETERMINED"; cuit: string; message: string }
  | { status: "NOT_FOUND"; message: string }
  | { status: "ERROR"; message: string };

export function normalizeArcaCuit(value: string): string {
  return normalizeDocumentNumber(value);
}

export function isArcaInscriptionLookupReady(cuit: string): boolean {
  return isValidCuitCuil(normalizeArcaCuit(cuit));
}

type Params = {
  enabled?: boolean;
  cuit: string;
};

/** Consulta Constancia de Inscripción sólo para el CUIT completo del receptor. */
export function useArcaInscriptionLookup({ enabled = true, cuit }: Params): ArcaInscriptionLookupState & { retry: () => void } {
  const normalizedCuit = useMemo(() => normalizeArcaCuit(cuit), [cuit]);
  const ready = isArcaInscriptionLookupReady(normalizedCuit);
  const [state, setState] = useState<ArcaInscriptionLookupState>({ status: "IDLE" });
  const [retryVersion, setRetryVersion] = useState(0);
  const retry = useCallback(() => setRetryVersion((previous) => previous + 1), []);

  useEffect(() => {
    if (!enabled || !ready) {
      setState({ status: "IDLE" });
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState({ status: "LOADING" });
      try {
        const response = await fetch(
          `/api/fiscal/condicion-iva?${new URLSearchParams({ cuit: normalizedCuit })}`,
          { cache: "no-store", signal: controller.signal },
        );
        const body = await response.json().catch(() => ({})) as {
          data?: ArcaInscriptionLookupResult;
          error?: string;
        };

        if (controller.signal.aborted) return;
        if (!response.ok) {
          setState(
            response.status === 404
              ? { status: "NOT_FOUND", message: body.error ?? "No se encontró el CUIT en ARCA" }
              : { status: "ERROR", message: body.error ?? "No se pudo verificar la condición IVA en ARCA" },
          );
          return;
        }
        if (body.data?.status === "FOUND") {
          setState({ status: "FOUND", condition: body.data.condition });
          return;
        }
        if (body.data?.status === "UNDETERMINED") {
          setState({ status: "UNDETERMINED", cuit: body.data.cuit, message: body.data.message });
          return;
        }
        setState({ status: "ERROR", message: "ARCA devolvió una respuesta inválida" });
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            status: "ERROR",
            message: error instanceof Error ? error.message : "No se pudo verificar la condición IVA en ARCA",
          });
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [enabled, normalizedCuit, ready, retryVersion]);

  return { ...state, retry };
}
