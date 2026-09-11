"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ArcaPadronDocumentType,
  ArcaPadronLookupResult,
} from "@/lib/arcaPadron/types";

export type ArcaPadronLookupState =
  | { status: "IDLE" }
  | { status: "LOADING" }
  | { status: "FOUND"; queryKey: string; person: Extract<ArcaPadronLookupResult, { status: "FOUND" }>['person'] }
  | { status: "MULTIPLE"; queryKey: string; candidates: string[] }
  | { status: "NOT_FOUND"; message: string }
  | { status: "ERROR"; message: string };

function documentLength(documentType: ArcaPadronDocumentType | null): number | null {
  if (documentType === 96) return 8;
  if (documentType === 80 || documentType === 86) return 11;
  return null;
}

export function isArcaPadronLookupReady(
  documentType: ArcaPadronDocumentType | null,
  documentNumber: string,
): boolean {
  const expected = documentLength(documentType);
  return expected !== null && documentNumber.replace(/\D/g, "").length === expected;
}

export function getArcaPadronLookupQueryKey(
  documentType: ArcaPadronDocumentType,
  documentNumber: string,
): string {
  return `${documentType}:${documentNumber.replace(/\D/g, "")}`;
}

type Params = {
  enabled?: boolean;
  documentType: ArcaPadronDocumentType | null;
  documentNumber: string;
};

/** Consulta sólo cuando el identificador está completo para evitar solicitudes por cada tecla. */
export function useArcaPadronLookup({
  enabled = true,
  documentType,
  documentNumber,
}: Params): ArcaPadronLookupState {
  const normalizedDocument = useMemo(
    () => documentNumber.replace(/\D/g, ""),
    [documentNumber],
  );
  const ready = isArcaPadronLookupReady(documentType, normalizedDocument);
  const queryKey = documentType === null
    ? ""
    : getArcaPadronLookupQueryKey(documentType, normalizedDocument);
  const [state, setState] = useState<ArcaPadronLookupState>({ status: "IDLE" });

  useEffect(() => {
    if (!enabled || !ready || documentType === null) {
      setState({ status: "IDLE" });
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState({ status: "LOADING" });
      try {
        const response = await fetch(
          `/api/fiscal/persona?${new URLSearchParams({
            tipoDocumento: String(documentType),
            numeroDocumento: normalizedDocument,
          })}`,
          { cache: "no-store", signal: controller.signal },
        );
        const body = await response.json().catch(() => ({})) as {
          data?: ArcaPadronLookupResult;
          error?: string;
        };

        if (controller.signal.aborted) return;
        if (!response.ok) {
          setState(
            response.status === 404
              ? { status: "NOT_FOUND", message: body.error ?? "No se encontraron datos en ARCA" }
              : { status: "ERROR", message: body.error ?? "No se pudo consultar ARCA" },
          );
          return;
        }
        if (body.data?.status === "FOUND") {
          setState({ status: "FOUND", queryKey, person: body.data.person });
          return;
        }
        if (body.data?.status === "MULTIPLE") {
          setState({ status: "MULTIPLE", queryKey, candidates: body.data.candidates });
          return;
        }
        setState({ status: "ERROR", message: "ARCA devolvió una respuesta inválida" });
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            status: "ERROR",
            message: error instanceof Error ? error.message : "No se pudo consultar ARCA",
          });
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [documentType, enabled, normalizedDocument, queryKey, ready]);

  return state;
}
