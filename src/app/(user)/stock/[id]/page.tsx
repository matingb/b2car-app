"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ScreenHeader from "@/app/components/ui/ScreenHeader";
import { useStock } from "@/app/providers/StockProvider";
import type { StockItem } from "@/model/stock";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { css } from "@emotion/react";
import IconButton from "@/app/components/ui/IconButton";
import { Pencil, Save, Trash, X } from "lucide-react";
import StockLevelsCard from "@/app/components/stock/StockLevelsCard";
import StockInfoCard from "@/app/components/stock/StockInfoCard";
import StockPricesCard from "@/app/components/stock/StockPricesCard";
import StockMovementsCard from "@/app/components/stock/StockMovementsCard";
import { useModalMessage } from "@/app/providers/ModalMessageProvider";
import { useToast } from "@/app/providers/ToastProvider";
import { ROUTES } from "@/routing/routes";

export default function StockDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { fetchById, update, remove, loading } = useStock();
  const { confirm } = useModalMessage();
  const { success } = useToast();

  const [item, setItem] = useState<StockItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<StockItem | null>(null);

  const reload = useCallback(async () => {
    const found = await fetchById(params.id);
    setItem(found);
    setDraft(found ? { ...found } : null);
    setIsEditing(false);
  }, [fetchById, params.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const title = useMemo(() => item?.nombre ?? "Detalle", [item?.nombre]);

  const handleDelete = useCallback(async () => {
    if (!item) return;
    const ok = await confirm({
      title: "Eliminar item",
      message: `¿Estás seguro de que deseas eliminar "${item.nombre}"?`,
      acceptLabel: "Eliminar",
      cancelLabel: "Cancelar",
    });
    if (!ok) return;
    await remove(item.id);
    success("Éxito", "El item fue eliminado.");
    router.push(ROUTES.stock);
  }, [confirm, item, remove, router, success]);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    const { id, ...rest } = draft;
    const updated = await update(id, rest);
    if (updated) {
      setItem(updated);
      setDraft({ ...updated });
      setIsEditing(false);
      success("Éxito", "Cambios guardados.");
    }
  }, [draft, success, update]);

  if (loading && !item) {
    return (
      <div>
        <ScreenHeader title="Stock" breadcrumbs={["Detalle"]} hasBackButton />
        <div style={{ marginTop: 16, color: COLOR.TEXT.SECONDARY }}>Cargando...</div>
      </div>
    );
  }

  if (!item || !draft) {
    return (
      <div>
        <ScreenHeader title="Stock" breadcrumbs={["Detalle"]} hasBackButton />
        <div style={{ marginTop: 16 }}>Item no encontrado.</div>
      </div>
    );
  }

  return (
    <div>
      <div css={styles.headerRow}>
        <ScreenHeader title="Stock" breadcrumbs={["Detalle"]} hasBackButton style={{ width: "100%" }} />
        <div style={styles.actions}>
          {isEditing ? (
            <>
              <IconButton
                icon={<X />}
                onClick={() => {
                  setDraft({ ...item });
                  setIsEditing(false);
                }}
                title="Cancelar"
                ariaLabel="Cancelar"
              />
              <IconButton icon={<Save />} onClick={handleSave} title="Guardar" ariaLabel="Guardar" />
            </>
          ) : (
            <>
              <IconButton
                icon={<Trash />}
                onClick={handleDelete}
                title="Eliminar"
                ariaLabel="Eliminar"
                hoverColor={COLOR.ICON.DANGER}
              />
              <IconButton
                icon={<Pencil />}
                onClick={() => setIsEditing(true)}
                title="Editar"
                ariaLabel="Editar"
              />
            </>
          )}
        </div>
      </div>

      <div style={styles.titleBlock}>
        {isEditing ? (
          <input
            style={styles.titleInput}
            value={draft.nombre}
            onChange={(e) => setDraft((p) => (p ? { ...p, nombre: e.target.value } : p))}
          />
        ) : (
          <h2 style={styles.title}>{title}</h2>
        )}
        <div style={styles.code}>{item.codigo}</div>
      </div>

      <div css={styles.grid}>
        <div style={styles.leftCol}>
          <StockLevelsCard
            item={item}
            isEditing={isEditing}
            draft={draft}
            onChange={(patch) => setDraft((p) => (p ? { ...p, ...patch } : p))}
          />
          <div style={{ marginTop: 12 }}>
            <StockMovementsCard movimientos={item.historialMovimientos} />
          </div>
        </div>

        <div style={styles.rightCol}>
          <StockInfoCard
            item={item}
            isEditing={isEditing}
            draft={draft}
            onChange={(patch) => setDraft((p) => (p ? { ...p, ...patch } : p))}
          />
          <div style={{ marginTop: 12 }}>
            <StockPricesCard
              item={item}
              isEditing={isEditing}
              draft={draft}
              onChange={(patch) => setDraft((p) => (p ? { ...p, ...patch } : p))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  headerRow: css({
    display: "flex",
    alignItems: "center",
    gap: 8,
  }),
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  titleBlock: {
    marginTop: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    margin: 0,
  },
  titleInput: {
    width: "100%",
    fontSize: 22,
    fontWeight: 800,
    border: `1px solid ${COLOR.BORDER.SUBTLE}`,
    borderRadius: 8,
    padding: "10px 12px",
    background: COLOR.INPUT.PRIMARY.BACKGROUND,
  },
  code: {
    marginTop: 4,
    fontSize: 13,
    color: COLOR.TEXT.SECONDARY,
  },
  grid: css({
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: 12,
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
      gridTemplateColumns: "1fr",
    },
  }),
  leftCol: { display: "flex", flexDirection: "column" as const, gap: 12 },
  rightCol: { display: "flex", flexDirection: "column" as const, gap: 12 },
} as const;

