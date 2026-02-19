"use client";

import React, { useEffect, useMemo } from "react";
import { BREAKPOINTS, COLOR, REQUIRED_ICON_COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import NumberInput from "@/app/components/ui/NumberInput";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import ProductoFormFields, {
    type ProductoFormFieldsValues,
    validateProductoForm,
} from "@/app/components/productos/ProductoFormFields";
import { useProductos } from "@/app/providers/ProductosProvider";

export const CREATE_PRODUCTO_VALUE = "__create_producto__";

const EMPTY_PRODUCT_DRAFT: ProductoFormFieldsValues = {
    nombre: "",
    codigo: "",
    proveedor: "",
    ubicacion: "",
    precioCompra: 0,
    precioVenta: 0,
    categorias: [],
};

export type StockFormFieldsValues = {
    productId: string;
    productDraft: ProductoFormFieldsValues;
    stockActual: number;
    stockMinimo: number;
    stockMaximo: number;
};

type Props = {
    values: StockFormFieldsValues;
    onChange: (patch: Partial<StockFormFieldsValues>) => void;
    categoriasDisponibles: readonly string[];
    onValidityChange?: (isValid: boolean) => void;
};

export function validateStockForm(
    values: StockFormFieldsValues
): boolean {
    return Boolean(
        values.productId.trim().length > 0 &&
        values.stockActual >= 0 &&
        values.stockMinimo >= 0 &&
        values.stockMaximo >= 0 &&
        (values.stockMinimo <= values.stockMaximo || values.stockMaximo === 0)
    );
}

export default function StockFormFields({
    values,
    onChange,
    categoriasDisponibles,
    onValidityChange,
}: Props) {
    const { productos } = useProductos();

    const isCreatingProducto = values.productId === CREATE_PRODUCTO_VALUE;

    const productoOptions = useMemo<AutocompleteOption[]>(() => {
        return [
            {
                value: CREATE_PRODUCTO_VALUE,
                label: "+ Crear producto",
                secondaryLabel: "Cargar datos del producto nuevo",
            },
            ...productos.map((p) => ({
                value: p.id,
                label: p.nombre,
                secondaryLabel: p.codigo,
            })),
        ];
    }, [productos]);

    const isValid = useMemo(() => {
        const base = validateStockForm(values);
        if (!base) return false;
        if (isCreatingProducto) return validateProductoForm(values.productDraft);
        return true;
    }, [values, isCreatingProducto]);

    useEffect(() => {
        if (onValidityChange) {
            onValidityChange(isValid);
        }
    }, [isValid, onValidityChange]);

    return (
        <>
            <div css={styles.row}>
                <div style={styles.fieldWide}>
                    <label style={styles.label}>Producto</label>
                    <Autocomplete
                        options={productoOptions}
                        value={values.productId}
                        onChange={(next) => {
                            if (next === CREATE_PRODUCTO_VALUE) {
                                onChange({ productId: next });
                                return;
                            }

                            onChange({
                                productId: next,
                                productDraft: EMPTY_PRODUCT_DRAFT,
                            });
                        }}
                        placeholder="Buscar o crear producto..."
                        dataTestId="stock-create-modal-producto-autocomplete"
                    />
                </div>
            </div>

            {isCreatingProducto && (
                <ProductoFormFields
                    categoriasDisponibles={categoriasDisponibles}
                    values={values.productDraft}
                    onChange={(patch) => onChange({ productDraft: { ...values.productDraft, ...patch } })}
                />
            )}

            <div css={styles.row}>
                <div style={styles.field}>
                    <label style={styles.label}>Cantidad actual (opcional)</label>
                    <NumberInput
                        minValue={0}
                        allowDecimals={false}
                        value={values.stockActual}
                        onValueChange={(next) => onChange({ stockActual: Math.round(next) })}
                        style={styles.input}
                        placeholder="Ej: 12"
                    />
                </div>
                <div style={styles.field}>
                    <label style={styles.label}>Mínimo (opcional)</label>
                    <NumberInput
                        minValue={0}
                        allowDecimals={false}
                        value={values.stockMinimo}
                        onValueChange={(next) => onChange({ stockMinimo: Math.round(next) })}
                        style={styles.input}
                        placeholder="Ej: 5"
                    />
                </div>
                <div style={styles.field}>
                    <label style={styles.label}>Máximo (opcional)</label>
                    <NumberInput
                        minValue={0}
                        allowDecimals={false}
                        value={values.stockMaximo}
                        onValueChange={(next) => onChange({ stockMaximo: Math.round(next) })}
                        style={styles.input}
                        placeholder="Ej: 50"
                    />
                </div>
            </div>
        </>
    );
}

const styles = {
    row: css({
        display: "flex",
        gap: 16,
        marginTop: 10,
        width: "auto",
        [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
            width: "100%",
            flexDirection: "column",
            gap: 8,
        },
    }),
    rowLocationPrices: css({
        display: "grid",
        gridTemplateColumns: "4fr 3fr 3fr",
        columnGap: 16,
        marginTop: 10,
        width: "auto",
        [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
            width: "100%",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
        },
    }),
    field: { flex: 1 },
    fieldWide: { flex: 1 },
    locationField: css({
        minWidth: 0,
        [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
            gridColumn: "1 / -1",
        },
    }),
    priceField: css({
        minWidth: 0,
    }),
    label: {
        display: "block",
        fontSize: 13,
        marginBottom: 6,
        color: COLOR.TEXT.SECONDARY,
    },
    required: {
        color: REQUIRED_ICON_COLOR,
        fontWeight: 700,
        marginLeft: 2,
    },
    input: {
        width: "100%",
        padding: "10px 12px",
        borderRadius: 8,
        border: `1px solid ${COLOR.BORDER.SUBTLE}`,
        background: COLOR.INPUT.PRIMARY.BACKGROUND,
        fontSize: 14,
        outline: "none",
    },
} as const;
