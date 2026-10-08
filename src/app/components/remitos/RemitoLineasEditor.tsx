"use client";

import { Plus, Trash2 } from "lucide-react";
import Button from "@/app/components/ui/Button";
import Dropdown from "@/app/components/ui/Dropdown";
import IconButton from "@/app/components/ui/IconButton";
import NumberInput from "@/app/components/ui/NumberInput";
import { generateUuidV4 } from "@/lib/uuid";
import { formatRemitoCantidad, REMITO_MAX_LINEAS, type RemitoFacturaLineaDisponible } from "@/lib/remitos/types";
import { COLOR } from "@/theme/theme";
import { remitoFormStyles } from "./remitoFormStyles";

export type LineaLibreForm = {
  key: string;
  facturaLineaId: string | null;
  codigo: string;
  descripcion: string;
  observaciones: string;
  cantidad: number;
};

export function nuevaLineaLibre(values: Partial<Omit<LineaLibreForm, "key">> = {}): LineaLibreForm {
  return { key: generateUuidV4(), facturaLineaId: null, codigo: "", descripcion: "", observaciones: "", cantidad: 1, ...values };
}

export function lineasLibresPayload(lineas: LineaLibreForm[]) {
  return lineas.map((linea) => ({
    facturaLineaId: linea.facturaLineaId,
    codigo: linea.codigo.trim() || null,
    descripcion: linea.descripcion.trim(),
    observaciones: linea.observaciones.trim() || null,
    cantidad: linea.cantidad,
  }));
}

type Props = {
  value: LineaLibreForm[];
  onChange: (next: LineaLibreForm[]) => void;
  lineasFactura?: RemitoFacturaLineaDisponible[];
  disabled?: boolean;
};

/** Detalle propio del remito; las referencias a factura solo controlan cantidades y nunca importes. */
export default function RemitoLineasEditor({ value, onChange, lineasFactura, disabled = false }: Props) {
  const update = (key: string, changes: Partial<LineaLibreForm>) =>
    onChange(value.map((linea) => (linea.key === key ? { ...linea, ...changes } : linea)));
  const lineasFacturaDisponibles = lineasFactura?.filter((linea) => linea.cantidadDisponible > 0) ?? [];
  const opcionesFactura = [
    { value: "", label: "Elegí una línea de factura" },
    ...lineasFacturaDisponibles.map((linea) => ({
      value: linea.id,
      label: `${linea.descripcion} · disponible ${formatRemitoCantidad(linea.cantidadDisponible)}`,
      selectedLabel: `${linea.descripcion} · disp. ${formatRemitoCantidad(linea.cantidadDisponible)}`,
    })),
  ];

  return (
    <div style={styles.container}>
      {value.map((linea, index) => (
        <div key={linea.key} style={styles.row} data-testid="remito-linea-libre">
          <span style={styles.ordinal}>{index + 1}</span>
          <div style={styles.fields}>
            {lineasFactura ? (
              <label style={{ ...remitoFormStyles.field, flex: "1 1 100%" }}>
                <span style={remitoFormStyles.label}>
                  Referencia de factura <span style={remitoFormStyles.required}>*</span>
                </span>
                <Dropdown
                  options={opcionesFactura}
                  value={linea.facturaLineaId ?? ""}
                  disabled={disabled || lineasFacturaDisponibles.length === 0}
                  onChange={(facturaLineaId) => {
                    const referencia = lineasFacturaDisponibles.find((item) => item.id === facturaLineaId);
                    update(linea.key, referencia ? {
                      facturaLineaId,
                      codigo: referencia.codigo ?? "",
                      descripcion: referencia.descripcion,
                      cantidad: Math.min(linea.cantidad, referencia.cantidadDisponible),
                    } : { facturaLineaId: null });
                  }}
                  style={{ width: "100%", height: 42, fontSize: 13 }}
                  dataTestId={`remito-linea-factura-${index + 1}`}
                />
                {linea.facturaLineaId ? (
                  <span style={styles.referenceHelp}>
                    Facturada {formatRemitoCantidad(lineasFactura.find((item) => item.id === linea.facturaLineaId)?.cantidadFacturada ?? 0)}
                    {" · "}Disponible {formatRemitoCantidad(lineasFactura.find((item) => item.id === linea.facturaLineaId)?.cantidadDisponible ?? 0)}
                  </span>
                ) : null}
              </label>
            ) : null}
            <label style={{ ...remitoFormStyles.field, flex: "0 1 140px" }}>
              <span style={remitoFormStyles.label}>Código</span>
              <input
                aria-label={`Código del ítem ${index + 1}`}
                maxLength={100}
                disabled={disabled}
                value={linea.codigo}
                onChange={(event) => update(linea.key, { codigo: event.target.value })}
                style={remitoFormStyles.input}
              />
            </label>
            <label style={{ ...remitoFormStyles.field, flex: "2 1 220px" }}>
              <span style={remitoFormStyles.label}>
                Artículo / descripción <span style={remitoFormStyles.required}>*</span>
              </span>
              <input
                aria-label={`Descripción del ítem ${index + 1}`}
                required
                maxLength={500}
                disabled={disabled}
                value={linea.descripcion}
                onChange={(event) => update(linea.key, { descripcion: event.target.value })}
                style={remitoFormStyles.input}
              />
            </label>
            <label style={{ ...remitoFormStyles.field, flex: "1 1 180px" }}>
              <span style={remitoFormStyles.label}>Observaciones</span>
              <input
                aria-label={`Observaciones del ítem ${index + 1}`}
                maxLength={500}
                disabled={disabled}
                value={linea.observaciones}
                onChange={(event) => update(linea.key, { observaciones: event.target.value })}
                style={remitoFormStyles.input}
              />
            </label>
            <label style={{ ...remitoFormStyles.field, flex: "0 1 110px" }}>
              <span style={remitoFormStyles.label}>
                Cantidad <span style={remitoFormStyles.required}>*</span>
              </span>
              <NumberInput
                aria-label={`Cantidad del ítem ${index + 1}`}
                value={linea.cantidad}
                minValue={0}
                step="0.0001"
                disabled={disabled}
                onValueChange={(cantidad) => update(linea.key, { cantidad })}
                style={{ height: 42 }}
              />
            </label>
          </div>
          <IconButton
            icon={<Trash2 />}
            size={18}
            title="Quitar ítem"
            ariaLabel={`Quitar ítem ${index + 1}`}
            hoverColor={COLOR.SEMANTIC.DANGER}
            disabled={disabled || value.length <= 1}
            onClick={() => onChange(value.filter((item) => item.key !== linea.key))}
          />
        </div>
      ))}
      <Button
        type="button"
        text="Agregar ítem"
        icon={<Plus size={16} />}
        outline
        hideTextOnMobile={false}
        disabled={disabled || value.length >= REMITO_MAX_LINEAS}
        onClick={() => onChange([...value, nuevaLineaLibre()])}
      />
    </div>
  );
}

const styles = {
  container: { display: "flex", flexDirection: "column" as const, gap: 12 },
  row: {
    display: "flex",
    alignItems: "flex-end",
    gap: 10,
    padding: 12,
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.BACKGROUND.PRIMARY,
  },
  ordinal: {
    minWidth: 24,
    height: 42,
    display: "flex",
    alignItems: "center",
    color: COLOR.TEXT.TERTIARY,
    fontWeight: 700,
    fontSize: 13,
  },
  fields: { display: "flex", flexWrap: "wrap" as const, gap: 10, flex: 1, minWidth: 0 },
  referenceHelp: { color: COLOR.TEXT.SECONDARY, fontSize: 12 },
} as const;
