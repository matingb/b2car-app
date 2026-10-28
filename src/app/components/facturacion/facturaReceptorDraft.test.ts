import { describe, expect, it } from "vitest";
import {
  applyCondicionAutofill,
  applyPadronAutofill,
  clienteReceptorState,
  editReceptorCampo,
  editReceptorCondicion,
  otroReceptorState,
  receptorIdentityKey,
  selectReceptorCuil,
  setReceptorDocumento,
  setReceptorTipoDocumento,
} from "./facturaReceptorDraft";
import { validateFacturaForm, type FacturaFormValidationInput } from "./facturaFormValidation";
import { toISODateAppTimeZone } from "@/lib/fechas";

const CUIT_A = "30712345671";
const CUIT_B = "20123456786";
const precarga = clienteReceptorState({
  clienteId: "cliente", nombre: "Juan Pérez", domicilio: "Calle 1",
  tipoDocumento: 86, numeroDocumento: CUIT_B, condicionIvaReceptorId: 5,
});

describe("receptor fiscal del formulario de factura", () => {
  it("empieza otro receptor vacío y restaura la precarga del cliente al volver", () => {
    const otro = otroReceptorState();
    expect(otro.draft).toEqual({ modo: "OTRO", tipoDocumento: "80", numeroDocumento: "", nombre: "", domicilio: "", condicionIvaReceptorId: "" });
    expect(precarga.draft).toMatchObject({ modo: "CLIENTE", nombre: "Juan Pérez", domicilio: "Calle 1", condicionIvaReceptorId: "5" });
  });

  it("no infiere consumidor final cuando ARCA no confirmó la condición del cliente", () => {
    const sinCondicion = clienteReceptorState({ clienteId: "c", nombre: "Ana", domicilio: null, tipoDocumento: 96, numeroDocumento: "12345678", condicionIvaReceptorId: null });
    expect(sinCondicion.draft.condicionIvaReceptorId).toBe("");
  });

  it("al cambiar de CUIT A a B borra la identidad de A, incluso lo cargado a mano", () => {
    let receptor = setReceptorDocumento(otroReceptorState(), "80", CUIT_A);
    receptor = applyPadronAutofill(receptor, `cuit:${CUIT_A}`, { nombre: "Empresa A", domicilio: "Domicilio A" });
    receptor = editReceptorCampo(receptor, "domicilio", "Domicilio corregido A");
    receptor = applyCondicionAutofill(receptor, `cuit:${CUIT_A}`, { condicionIvaReceptorId: 1, cuit: CUIT_A });

    receptor = setReceptorDocumento(receptor, "80", CUIT_B);

    expect(receptor.draft).toMatchObject({ numeroDocumento: CUIT_B, nombre: "", domicilio: "", condicionIvaReceptorId: "" });
    // Una respuesta tardía de A ya no corresponde al receptor vigente.
    expect(applyPadronAutofill(receptor, `cuit:${CUIT_A}`, { nombre: "Empresa A", domicilio: "Domicilio A" })).toBe(receptor);
    expect(applyCondicionAutofill(receptor, `cuit:${CUIT_A}`, { condicionIvaReceptorId: 1, cuit: CUIT_A })).toBe(receptor);
  });

  it("autocompleta una sola vez por identidad y respeta las correcciones manuales", () => {
    let receptor = setReceptorDocumento(otroReceptorState(), "80", CUIT_A);
    receptor = editReceptorCampo(receptor, "nombre", "Nombre corregido");
    receptor = editReceptorCondicion(receptor, "6");

    receptor = applyPadronAutofill(receptor, `cuit:${CUIT_A}`, { nombre: "Empresa A", domicilio: null });
    receptor = applyCondicionAutofill(receptor, `cuit:${CUIT_A}`, { condicionIvaReceptorId: 1, cuit: CUIT_A });
    expect(receptor.draft).toMatchObject({ nombre: "Nombre corregido", domicilio: "", condicionIvaReceptorId: "6" });

    receptor = editReceptorCampo(receptor, "domicilio", "");
    expect(applyPadronAutofill(receptor, `cuit:${CUIT_A}`, { nombre: "Empresa A", domicilio: "Domicilio A" }).draft.domicilio).toBe("");
  });

  it("conserva lo cargado mientras el documento está incompleto y lo asigna al documento completo", () => {
    let receptor = editReceptorCampo(otroReceptorState(), "nombre", "Empresa SA");
    receptor = setReceptorDocumento(receptor, "80", CUIT_A.slice(0, 6));
    receptor = setReceptorDocumento(receptor, "80", CUIT_A);
    expect(receptor.draft.nombre).toBe("Empresa SA");
    expect(receptor.identidad).toBe(`cuit:${CUIT_A}`);
  });

  it("pasa de DNI al CUIL de la misma persona cuando ARCA informa una condición que exige CUIT", () => {
    let receptor = setReceptorDocumento({ ...otroReceptorState(), draft: { ...otroReceptorState().draft, tipoDocumento: "96" } }, "96", "12345678");
    receptor = applyPadronAutofill(receptor, "dni:12345678", { nombre: "Juan Pérez", domicilio: "Calle 1" });
    receptor = applyCondicionAutofill(receptor, "dni:12345678", { condicionIvaReceptorId: 6, cuit: CUIT_B });
    expect(receptor.draft).toMatchObject({ tipoDocumento: "80", numeroDocumento: CUIT_B, nombre: "Juan Pérez", condicionIvaReceptorId: "6" });
    expect(receptor.identidad).toBe(`cuit:${CUIT_B}`);
  });

  it("exige elegir el CUIL de un DNI ambiguo sin tomar el primero", () => {
    const ambiguo = clienteReceptorState({ clienteId: "c", nombre: "Ana", domicilio: null, tipoDocumento: 96, numeroDocumento: "12345678", condicionIvaReceptorId: null });
    const elegido = selectReceptorCuil(ambiguo, CUIT_B);
    expect(elegido.draft).toMatchObject({ tipoDocumento: "86", numeroDocumento: CUIT_B, nombre: "Ana" });
  });

  it("anonimiza al consumidor final y, al volver al tipo del cliente, restaura su precarga", () => {
    const anonimo = setReceptorTipoDocumento(precarga, "99", precarga);
    expect(anonimo.draft).toMatchObject({ tipoDocumento: "99", numeroDocumento: "", nombre: "Consumidor final", domicilio: "", condicionIvaReceptorId: "5" });
    expect(setReceptorTipoDocumento(anonimo, "86", precarga)).toBe(precarga);
    expect(setReceptorDocumento(anonimo, "80", CUIT_A).draft).toMatchObject({ nombre: "", condicionIvaReceptorId: "" });
  });

  it("identifica CUIT y CUIL del mismo número como la misma persona", () => {
    expect(receptorIdentityKey("80", CUIT_B)).toBe(receptorIdentityKey("86", CUIT_B));
    expect(receptorIdentityKey("80", "20123456787")).toBeNull();
    const cuit = setReceptorTipoDocumento(precarga, "80", precarga);
    expect(cuit.draft).toMatchObject({ tipoDocumento: "80", nombre: "Juan Pérez" });
  });
});

describe("validación agrupada del formulario de factura", () => {
  const today = toISODateAppTimeZone(new Date());
  const base: FacturaFormValidationInput = {
    origenTipo: "ARREGLO",
    receptor: precarga.draft,
    clienteAsociado: { clienteId: "cliente", nombre: "Juan Pérez", documento: "12345678" },
    condicionIvaEmisor: "MONOTRIBUTISTA",
    concepto: 2,
    fechas: { fechaComprobante: today, fechaServicioDesde: today, fechaServicioHasta: today, fechaVencimientoPago: today },
    fce: false,
    detalleSimplificado: false,
    descripcionDetalleSimplificado: "",
  };

  it("acepta el cliente con su CUIL resuelto desde el DNI de la ficha", () => {
    expect(validateFacturaForm(base)).toEqual([]);
  });

  it("reporta juntos los errores independientes con su grupo y campo", () => {
    const issues = validateFacturaForm({
      ...base,
      receptor: { ...otroReceptorState().draft, numeroDocumento: "123" },
      fechas: { fechaComprobante: today, fechaServicioDesde: "", fechaServicioHasta: today, fechaVencimientoPago: "" },
      detalleSimplificado: true,
    });
    expect(issues.map(({ grupo, campo }) => `${grupo}:${campo}`)).toEqual([
      "RECEPTOR:receptor.numeroDocumento",
      "RECEPTOR:receptor.nombre",
      "RECEPTOR:receptor.condicionIva",
      "COMPROBANTE:fechas.fechaServicioDesde",
      "COMPROBANTE:fechas.fechaVencimientoPago",
      "DETALLE:detalle.descripcion",
    ]);
  });

  it("no deja facturar a otro documento como si fuera el cliente del arreglo", () => {
    const issues = validateFacturaForm({ ...base, receptor: { ...precarga.draft, tipoDocumento: "80", numeroDocumento: CUIT_A, condicionIvaReceptorId: "1" } });
    expect(issues).toEqual([expect.objectContaining({ codigo: "DOCUMENTO_NO_CORRESPONDE_AL_CLIENTE", campo: "receptor.numeroDocumento" })]);
  });
});
