"use client";

import React, { useMemo, useState } from "react";
import Card from "@/app/components/ui/Card";
import { COLOR } from "@/theme/theme";
import Autocomplete, { type AutocompleteOption } from "@/app/components/ui/Autocomplete";
import FilterChip from "@/app/components/ui/FilterChip";

export type ProductoInfoDraft = {
  codigo: string;
  proveedor: string;
  ubicacion: string;
  categorias: string[];
};

type Props = {
  codigo: string;
  proveedor: string;
  ubicacion: string;
  categorias: string[];
  categoriasDisponibles: readonly string[];
  ultimaActualizacion?: string;
  isEditing: boolean;
  draft: ProductoInfoDraft;
  onChange: (patch: Partial<ProductoInfoDraft>) => void;
};

function CategoryTag({ text }: { text: string }) {
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${COLOR.BORDER.SUBTLE}`,
        background: COLOR.BACKGROUND.SUBTLE,
        fontSize: 12,
        color: COLOR.TEXT.PRIMARY,
      }}
    >
      {text}
    </span>
  );
}

export default function ProductoInfoCard({
  codigo,
  proveedor,
  ubicacion,
  categorias,
  categoriasDisponibles,
  ultimaActualizacion,
  isEditing,
  draft,
  onChange,
}: Props) {
  const [categoriaToAdd, setCategoriaToAdd] = useState("");

  const categoriasMostradas = useMemo(() => {
    return isEditing ? (draft.categorias ?? []) : (categorias ?? []);
  }, [isEditing, draft.categorias, categorias]);
  const categoriaOptions = useMemo<AutocompleteOption[]>(() => {
    return (categoriasDisponibles ?? [])
      .filter((c) => !categoriasMostradas.includes(c))
      .map((c) => ({ value: c, label: c }));
  }, [categoriasDisponibles, categoriasMostradas]);

  return (
    <div>
      <h3 style={styles.title}>Información general</h3>
      <Card style={{ background: COLOR.BACKGROUND.SECONDARY }}>
        <div style={styles.grid}>
          <div>
            <div style={styles.label}>Código</div>
            {isEditing ? (
              <input
                style={styles.input}
                value={draft.codigo}
                onChange={(e) => onChange({ codigo: e.target.value })}
              />
            ) : (
              <div style={styles.value}>{codigo}</div>
            )}
          </div>

          <div>
            <div style={styles.label}>Proveedor</div>
            {isEditing ? (
              <input
                style={styles.input}
                value={draft.proveedor}
                onChange={(e) => onChange({ proveedor: e.target.value })}
              />
            ) : (
              <div style={styles.value}>{proveedor || "-"}</div>
            )}
          </div>

          <div>
            <div style={styles.label}>Ubicación</div>
            {isEditing ? (
              <input
                style={styles.input}
                value={draft.ubicacion}
                onChange={(e) => onChange({ ubicacion: e.target.value })}
              />
            ) : (
              <div style={styles.value}>{ubicacion || "-"}</div>
            )}
          </div>

          {ultimaActualizacion ? (
            <div>
              <div style={styles.label}>Última actualización</div>
              <div style={styles.value}>{ultimaActualizacion}</div>
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={styles.label}>Categorías</div>
          {isEditing ? (
            <div>
              <Autocomplete
                options={categoriaOptions}
                value={categoriaToAdd}
                onChange={(value) => {
                  if (!value) {
                    setCategoriaToAdd("");
                    return;
                  }
                  if (!categoriasDisponibles.includes(value)) {
                    setCategoriaToAdd("");
                    return;
                  }
                  const next = categoriasMostradas.includes(value)
                    ? categoriasMostradas
                    : [...categoriasMostradas, value];
                  onChange({ categorias: next });
                  setCategoriaToAdd("");
                }}
                placeholder="Agregar categoría..."
              />
              {categoriasMostradas.length > 0 ? (
                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {categoriasMostradas.map((cat) => (
                    <FilterChip
                      key={cat}
                      text={cat}
                      selected
                      onClick={() =>
                        onChange({ categorias: categoriasMostradas.filter((c) => c !== cat) })
                      }
                    />
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: 8, color: COLOR.TEXT.SECONDARY, fontSize: 13 }}>-</div>
              )}
            </div>
          ) : (
            <div style={styles.tags}>
              {categoriasMostradas.length ? (
                categoriasMostradas.map((c) => <CategoryTag key={c} text={c} />)
              ) : (
                <span style={{ color: COLOR.TEXT.SECONDARY, fontSize: 13 }}>-</span>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

const styles = {
  title: { fontSize: 18, fontWeight: 600, margin: "0 0 8px" },
  label: { fontSize: 13, color: COLOR.TEXT.SECONDARY, marginBottom: 6 },
  value: { fontSize: 14, fontWeight: 600 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
  },
  tags: { display: "flex", flexWrap: "wrap" as const, gap: 8 },
} as const;

