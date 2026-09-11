import type { CondicionIvaReceptorId } from "@/lib/facturacion/types";

export type ArcaInscriptionVatCondition = {
  cuit: string;
  condicionIvaReceptorId: CondicionIvaReceptorId;
  condicionIvaLabel: string;
};

export type ArcaInscriptionLookupResult =
  | {
    status: "FOUND";
    condition: ArcaInscriptionVatCondition;
  }
  | {
    status: "UNDETERMINED";
    cuit: string;
    message: string;
  };
