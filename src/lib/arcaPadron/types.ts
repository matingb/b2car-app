export type ArcaPadronDocumentType = 80 | 86 | 96;

export type ArcaPadronPerson = {
  cuit: string;
  tipoPersona: string | null;
  estadoClave: string | null;
  nombre: string;
  apellido: string | null;
  razonSocial: string | null;
  nombreCompleto: string;
  direccion: string | null;
};

export type ArcaPadronLookupResult =
  | {
    status: "FOUND";
    person: ArcaPadronPerson;
  }
  | {
    status: "MULTIPLE";
    candidates: string[];
  };
