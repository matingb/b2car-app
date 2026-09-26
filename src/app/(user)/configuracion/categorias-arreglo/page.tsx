"use client";

import React, { useState } from "react";
import { Info, Loader2, Plus, Tag, Tags, Trash2 } from "lucide-react";
import Button from "@/app/components/ui/Button";
import IconButton from "@/app/components/ui/IconButton";
import ListSpinner from "@/app/components/ui/ListSpinner";
import Card from "@/app/components/ui/Card";
import {
  CategoriasArregloProvider,
  useCategoriasArreglo,
  type CategoriaArreglo,
} from "@/app/providers/CategoriasArregloProvider";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { COLOR } from "@/theme/theme";
import { css } from "@emotion/react";

export default function CategoriasArregloPage() {
  return (
    <CategoriasArregloProvider>
      <CategoriasArregloContent />
    </CategoriasArregloProvider>
  );
}

export function CategoriasArregloContent() {
  const { categorias, isLoading, createCategoria, deleteCategoria } = useCategoriasArreglo();
  const { confirm } = useModalMessage();
  const toast = useToast();

  const [nombreNueva, setNombreNueva] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nombreNueva.trim();
    if (!trimmed) return;

    const exists = categorias.some(
      (c) => c.nombre.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      toast.error("Error de validación", "Ya existe una categoría de arreglo con ese nombre.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { categoria, error } = await createCategoria(trimmed);
      if (error || !categoria) {
        toast.error("No se pudo crear la categoría", error ?? "Ocurrió un error");
      } else {
        toast.success("Categoría creada", `Se agregó "${categoria.nombre}" correctamente.`);
        setNombreNueva("");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error inesperado al crear";
      toast.error("Error", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (categoria: CategoriaArreglo) => {
    const ok = await confirm({
      title: "Eliminar categoría",
      message: (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ margin: 0 }}>
            ¿Estás seguro de que deseás eliminar la categoría <strong>{categoria.nombre}</strong>?
          </p>
          <p style={{ margin: 0, fontSize: 13, color: COLOR.TEXT.SECONDARY }}>
            Las líneas de arreglos que actualmente utilicen esta categoría quedarán sin categoría asignada.
          </p>
        </div>
      ),
      acceptLabel: "Eliminar",
      cancelLabel: "Cancelar",
    });

    if (!ok) return;

    setDeletingId(categoria.id);
    try {
      const { error } = await deleteCategoria(categoria.id);
      if (error) {
        toast.error("No se pudo eliminar la categoría", error);
      } else {
        toast.success("Categoría eliminada", `La categoría "${categoria.nombre}" fue eliminada.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error inesperado al eliminar";
      toast.error("Error", msg);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={styles.container}>
      <main style={styles.content}>
        <section style={styles.card} aria-labelledby="categorias-config-title">
          <header style={styles.cardHeader}>
            <div style={styles.headerLeft}>
              <div style={styles.iconContainer}>
                <Tags size={20} color={COLOR.ACCENT.PRIMARY} />
              </div>
              <div>
                <h2 id="categorias-config-title" style={styles.cardTitle}>
                  Categorías de arreglos
                </h2>
                <p style={styles.cardSubtitle}>
                  Configurá las categorías para clasificar servicios y repuestos
                </p>
              </div>
            </div>
          </header>

          <div style={styles.cardBody}>
            <div style={styles.infoBox}>
              <Info size={18} color={COLOR.ACCENT.PRIMARY} style={{ flexShrink: 0 }} />
              <p style={styles.infoText}>
                Las categorías te permiten organizar y agrupar las intervenciones y repuestos de los arreglos.
                Al eliminar una categoría, los arreglos que la utilizaban mantendrán su historial pero quedarán sin categoría asignada.
              </p>
            </div>

            {/* Formulario inline para agregar */}
            <form onSubmit={handleCreate} css={styles.inlineForm}>
              <input
                type="text"
                value={nombreNueva}
                onChange={(e) => setNombreNueva(e.target.value)}
                placeholder="Nombre de la nueva categoría (ej: Frenos, Service, Chapa y pintura)"
                disabled={isSubmitting}
                style={styles.input}
                aria-label="Nombre de la nueva categoría"
              />
              <Button
                type="submit"
                text={isSubmitting ? "Agregando..." : "Agregar categoría"}
                disabled={isSubmitting || !nombreNueva.trim()}
                icon={
                  isSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )
                }
                hideTextOnMobile={false}
              />
            </form>

            {/* Listado de categorías */}
            <div style={styles.listSection}>
              <div style={styles.resultsHeader}>
                <h3 style={styles.resultsTitle}>Listado</h3>
                <span style={styles.resultsCount}>
                  {categorias.length} {categorias.length === 1 ? "categoría registrada" : "categorías registradas"}
                </span>
              </div>

              {isLoading && categorias.length === 0 ? (
                <div style={styles.spinnerWrapper}>
                  <ListSpinner />
                </div>
              ) : categorias.length === 0 ? (
                <Card style={{ background: COLOR.BACKGROUND.SUBTLE, marginTop: 12 }}>
                  <div style={styles.emptyState}>
                    <Tags size={36} color={COLOR.ICON.MUTED} />
                    <p style={styles.emptyTitle}>No hay categorías de arreglos registradas</p>
                    <p style={styles.emptySub}>Ingresá un nombre arriba para crear la primera categoría.</p>
                  </div>
                </Card>
              ) : (
                <div style={styles.list}>
                  {categorias.map((cat) => {
                    const isDeleting = deletingId === cat.id;
                    return (
                      <div key={cat.id} style={styles.itemRow}>
                        <div style={styles.itemInfo}>
                          <div style={styles.itemTagIcon}>
                            <Tag size={15} color={COLOR.ACCENT.PRIMARY} />
                          </div>
                          <span style={styles.itemNombre}>{cat.nombre}</span>
                        </div>
                        <IconButton
                          icon={isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                          hoverColor={COLOR.ICON.DANGER}
                          title={`Eliminar categoría ${cat.nombre}`}
                          ariaLabel={`Eliminar categoría ${cat.nombre}`}
                          disabled={isDeleting}
                          onClick={() => void handleDelete(cat)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 20,
    paddingBottom: 40,
  },
  content: {
    maxWidth: 900,
    width: "100%",
  },
  card: {
    background: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 12,
    overflow: "hidden" as const,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
  },
  cardHeader: {
    padding: "16px 20px",
    background: COLOR.BACKGROUND.SUBTLE,
    borderBottom: `1px solid ${COLOR.BORDER.SUBTLE}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: COLOR.BACKGROUND.INFO_TINT,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    margin: 0,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    margin: 0,
    marginTop: 2,
  },
  cardBody: {
    padding: 20,
    display: "flex",
    flexDirection: "column" as const,
    gap: 20,
  },
  infoBox: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    borderRadius: 8,
    background: COLOR.BACKGROUND.INFO_TINT,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  infoText: {
    fontSize: 13,
    color: COLOR.TEXT.PRIMARY,
    margin: 0,
    lineHeight: 1.5,
  },
  inlineForm: css({
    display: "flex",
    gap: 12,
    alignItems: "center",
    "@media (max-width: 600px)": {
      flexDirection: "column",
      alignItems: "stretch",
    },
  }),
  input: {
    flex: 1,
    height: 42,
    padding: "0 12px",
    borderRadius: 8,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
    color: COLOR.TEXT.PRIMARY,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box" as const,
  },
  listSection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    paddingTop: 8,
    borderTop: `1px solid ${COLOR.BORDER.SUBTLE}`,
  },
  resultsHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  resultsTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    margin: 0,
  },
  resultsCount: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
  },
  spinnerWrapper: {
    display: "flex",
    justifyContent: "center",
    padding: "32px 0",
  },
  list: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  itemRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 16px",
    borderRadius: 8,
    background: COLOR.BACKGROUND.SECONDARY,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    transition: "background 150ms ease, border-color 150ms ease",
  },
  itemInfo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  itemTagIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    background: COLOR.BACKGROUND.INFO_TINT,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  itemNombre: {
    fontSize: 14,
    fontWeight: 500,
    color: COLOR.TEXT.PRIMARY,
    whiteSpace: "nowrap" as const,
    overflow: "hidden" as const,
    textOverflow: "ellipsis" as const,
  },
  emptyState: {
    padding: 32,
    textAlign: "center" as const,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: COLOR.TEXT.PRIMARY,
    margin: 0,
  },
  emptySub: {
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
    margin: 0,
  },
};
