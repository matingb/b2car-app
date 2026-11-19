import { ALICUOTAS_IVA_ARCA } from "@/lib/facturacion/types";

export type FacturaConceptoIva = { key: string; importe: number; ivaAlicuotaId: number };
export type FacturaConceptoIvaCalculado = FacturaConceptoIva & { base: number; iva: number; total: number };
export type FacturaDesgloseIvaAlicuota = { ivaAlicuotaId: number; base: number; iva: number };

type ConceptoConCentavos = {
  index: number;
  importeCentavos: bigint;
  alicuotaDecimas: bigint;
};

function validarConceptos(conceptos: FacturaConceptoIva[]): Map<number, ConceptoConCentavos[]> {
  const porAlicuota = new Map<number, ConceptoConCentavos[]>();
  conceptos.forEach((concepto, index) => {
    const alicuota = ALICUOTAS_IVA_ARCA.find((rate) => rate.id === concepto.ivaAlicuotaId);
    const importeCentavos = Math.round(concepto.importe * 100);
    if (!alicuota || !Number.isFinite(concepto.importe) || concepto.importe < 0 || !Number.isSafeInteger(importeCentavos)) {
      throw new Error("No se pudo calcular el IVA de un concepto de factura");
    }
    const conceptosAlicuota = porAlicuota.get(concepto.ivaAlicuotaId) ?? [];
    conceptosAlicuota.push({
      index,
      importeCentavos: BigInt(importeCentavos),
      alicuotaDecimas: BigInt(Math.round(alicuota.porcentaje * 10)),
    });
    porAlicuota.set(concepto.ivaAlicuotaId, conceptosAlicuota);
  });
  return porAlicuota;
}

function importeDesdeCentavos(value: bigint) {
  if (value < BigInt(0) || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Importe de IVA fuera del rango numérico seguro");
  }
  return Number(value) / 100;
}

/** Calcula IVA adicional desde precios netos y agrupa el resultado por alícuota. */
export function calcularFacturaADesdeBases(conceptos: FacturaConceptoIva[]): {
  conceptos: FacturaConceptoIvaCalculado[];
  desgloseIva: FacturaDesgloseIvaAlicuota[];
} {
  const porAlicuota = validarConceptos(conceptos);
  const ivaPorConcepto = new Array<bigint>(conceptos.length).fill(BigInt(0));
  const desglosePorAlicuota = new Map<number, FacturaDesgloseIvaAlicuota>();

  for (const [ivaAlicuotaId, items] of porAlicuota) {
    const baseCentavos = items.reduce((total, item) => total + item.importeCentavos, BigInt(0));
    const alicuotaDecimas = items[0].alicuotaDecimas;
    const ivaCentavos = (baseCentavos * alicuotaDecimas + BigInt(500)) / BigInt(1000);
    const asignaciones = items.map((item) => ({
      index: item.index,
      centavos: (item.importeCentavos * item.alicuotaDecimas) / BigInt(1000),
      resto: (item.importeCentavos * item.alicuotaDecimas) % BigInt(1000),
    }));
    let centavosRestantes = ivaCentavos - asignaciones.reduce((total, item) => total + item.centavos, BigInt(0));
    const ordenAsignacion = [...asignaciones].sort((left, right) => {
      if (left.resto === right.resto) return left.index - right.index;
      return left.resto > right.resto ? -1 : 1;
    });
    for (const asignacion of ordenAsignacion) {
      if (centavosRestantes === BigInt(0)) break;
      asignacion.centavos += BigInt(1);
      centavosRestantes -= BigInt(1);
    }
    for (const asignacion of asignaciones) ivaPorConcepto[asignacion.index] = asignacion.centavos;
    desglosePorAlicuota.set(ivaAlicuotaId, {
      ivaAlicuotaId,
      base: importeDesdeCentavos(baseCentavos),
      iva: importeDesdeCentavos(ivaCentavos),
    });
  }

  return {
    conceptos: conceptos.map((concepto, index) => {
      const baseCentavos = BigInt(Math.round(concepto.importe * 100));
      const ivaCentavos = ivaPorConcepto[index];
      return {
        ...concepto,
        base: importeDesdeCentavos(baseCentavos),
        iva: importeDesdeCentavos(ivaCentavos),
        total: importeDesdeCentavos(baseCentavos + ivaCentavos),
      };
    }),
    desgloseIva: ALICUOTAS_IVA_ARCA.flatMap(({ id }) => {
      const desglose = desglosePorAlicuota.get(id);
      return desglose ? [desglose] : [];
    }),
  };
}

/** Extrae IVA incluido desde precios finales y agrupa base e impuesto por alícuota. */
export function calcularFacturaBDesdeImportesConIva(conceptos: FacturaConceptoIva[]): {
  conceptos: FacturaConceptoIvaCalculado[];
  desgloseIva: FacturaDesgloseIvaAlicuota[];
} {
  const porAlicuota = validarConceptos(conceptos);
  const basePorConcepto = new Array<bigint>(conceptos.length).fill(BigInt(0));
  const desglosePorAlicuota = new Map<number, FacturaDesgloseIvaAlicuota>();

  for (const [ivaAlicuotaId, items] of porAlicuota) {
    const importeBrutoCentavos = items.reduce((total, item) => total + item.importeCentavos, BigInt(0));
    const tasaDecimas = items[0].alicuotaDecimas;
    const divisor = BigInt(1000) + tasaDecimas;
    const baseCentavos = (importeBrutoCentavos * BigInt(1000) + divisor / BigInt(2)) / divisor;
    const ivaCentavos = importeBrutoCentavos - baseCentavos;
    const asignaciones = items.map((item) => ({
      index: item.index,
      centavos: (item.importeCentavos * BigInt(1000)) / (BigInt(1000) + item.alicuotaDecimas),
      resto: (item.importeCentavos * BigInt(1000)) % (BigInt(1000) + item.alicuotaDecimas),
    }));
    let centavosRestantes = baseCentavos - asignaciones.reduce((total, item) => total + item.centavos, BigInt(0));
    const ordenAsignacion = [...asignaciones].sort((left, right) => {
      if (left.resto === right.resto) return left.index - right.index;
      return left.resto > right.resto ? -1 : 1;
    });
    for (const asignacion of ordenAsignacion) {
      if (centavosRestantes === BigInt(0)) break;
      asignacion.centavos += BigInt(1);
      centavosRestantes -= BigInt(1);
    }
    for (const asignacion of asignaciones) basePorConcepto[asignacion.index] = asignacion.centavos;
    desglosePorAlicuota.set(ivaAlicuotaId, {
      ivaAlicuotaId,
      base: importeDesdeCentavos(baseCentavos),
      iva: importeDesdeCentavos(ivaCentavos),
    });
  }

  return {
    conceptos: conceptos.map((concepto, index) => {
      const importeCentavos = BigInt(Math.round(concepto.importe * 100));
      const baseCentavos = basePorConcepto[index];
      const ivaCentavos = importeCentavos - baseCentavos;
      return {
        ...concepto,
        base: importeDesdeCentavos(baseCentavos),
        iva: importeDesdeCentavos(ivaCentavos),
        total: importeDesdeCentavos(importeCentavos),
      };
    }),
    desgloseIva: ALICUOTAS_IVA_ARCA.flatMap(({ id }) => {
      const desglose = desglosePorAlicuota.get(id);
      return desglose ? [desglose] : [];
    }),
  };
}

/** Sugiere IVA redondeado a centavos desde una base neta y una alícuota seleccionada. */
export function sugerirIvaDesdeBase(base: string, ivaAlicuotaId: number): string {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(base.trim().replace(",", "."));
  const alicuota = ALICUOTAS_IVA_ARCA.find((rate) => rate.id === ivaAlicuotaId);
  if (!match || !alicuota) return "";

  const baseCentavos = BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0"));
  const alicuotaDecimas = BigInt(Math.round(alicuota.porcentaje * 10));
  const ivaCentavos = (baseCentavos * alicuotaDecimas + BigInt(500)) / BigInt(1000);
  return `${ivaCentavos / BigInt(100)}.${(ivaCentavos % BigInt(100)).toString().padStart(2, "0")}`;
}
